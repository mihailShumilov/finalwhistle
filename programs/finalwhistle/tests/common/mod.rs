//! Shared LiteSVM harness + instruction builders for FinalWhistle integration tests.
//!
//! These helpers load the compiled `finalwhistle.so`, fabricate an SPL mint and funded
//! bettor token accounts directly via `set_account` (no on-chain mint ix needed), derive
//! every PDA the program uses, and assemble Anchor-encoded instructions (8-byte
//! discriminator + borsh args) so tests can drive the program end to end.

#![allow(dead_code)]
// `SendResult`'s Err variant (litesvm's FailedTransactionMetadata) is large by design;
// boxing it would only complicate the test helpers. This is test-only code.
#![allow(clippy::result_large_err)]

use anchor_lang::{AccountDeserialize, AnchorSerialize};
use litesvm::types::FailedTransactionMetadata;
use litesvm::LiteSVM;
use solana_account::Account as SolAccount;
use solana_clock::Clock;
use solana_instruction::{AccountMeta, Instruction};
use solana_program_option::COption;
use solana_program_pack::Pack;
use solana_transaction::Transaction;
use solana_transaction_error::TransactionError;
use spl_token_interface::state::{Account as SplTokenAccount, AccountState, Mint as SplMint};

// Re-export commonly used items so test files only need `use common::*`.
pub use solana_keypair::Keypair;
pub use solana_pubkey::Pubkey;
pub use solana_signer::Signer;

use finalwhistle::constants::{ESCROW_SEED, MARKET_SEED, POSITION_SEED, TREASURY_SEED};
use finalwhistle::state::{Market, Position};

/// Classic SPL Token program id (litesvm loads this program by default).
pub const TOKEN_PROGRAM_ID: Pubkey =
    Pubkey::from_str_const("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
/// Associated-token-account program id (also loaded by default).
pub const ATA_PROGRAM_ID: Pubkey =
    Pubkey::from_str_const("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
/// System program id.
pub const SYSTEM_PROGRAM_ID: Pubkey = Pubkey::from_str_const("11111111111111111111111111111111");

/// Anchor instruction discriminators, taken from `idl/finalwhistle.json` (the program's IDL).
pub const DISC_CREATE_MARKET: [u8; 8] = [103, 226, 97, 235, 200, 188, 251, 254];
pub const DISC_PLACE_POSITION: [u8; 8] = [218, 31, 90, 75, 101, 209, 5, 253];
pub const DISC_SETTLE: [u8; 8] = [175, 42, 185, 87, 144, 131, 102, 212];
pub const DISC_CLAIM: [u8; 8] = [62, 198, 214, 193, 213, 159, 108, 210];
pub const DISC_VOID_MARKET: [u8; 8] = [243, 175, 46, 124, 95, 101, 39, 69];

const USDC_DECIMALS: u8 = 6;

/// Path to the compiled program (relative to the program crate root, which is the CWD
/// for `cargo test`).
const PROGRAM_SO: &str = "../../target/deploy/finalwhistle.so";

/// A running test environment.
pub struct TestEnv {
    pub svm: LiteSVM,
    pub program_id: Pubkey,
    pub payer: Keypair,
    pub usdc_mint: Pubkey,
}

impl TestEnv {
    /// Boot a LiteSVM with the program loaded, a funded payer, and a USDC mint.
    pub fn new() -> Self {
        let program_id = finalwhistle::ID;
        let mut svm = LiteSVM::new();
        svm.add_program_from_file(program_id, PROGRAM_SO)
            .expect("load finalwhistle.so");

        let payer = Keypair::new();
        svm.airdrop(&payer.pubkey(), 100 * LAMPORTS_PER_SOL)
            .expect("airdrop payer");

        // Pin the clock to a known wall-clock time so close_ts logic is deterministic.
        let mut clock = svm.get_sysvar::<Clock>();
        clock.unix_timestamp = NOW;
        svm.set_sysvar::<Clock>(&clock);

        let usdc_mint = Pubkey::new_unique();
        let mut env = Self {
            svm,
            program_id,
            payer,
            usdc_mint,
        };
        env.write_mint(usdc_mint, USDC_DECIMALS);
        env
    }

    /// Set the cluster clock's unix timestamp (controls betting-close / settle gates).
    pub fn set_unix_time(&mut self, ts: i64) {
        let mut clock = self.svm.get_sysvar::<Clock>();
        clock.unix_timestamp = ts;
        self.svm.set_sysvar::<Clock>(&clock);
    }

    /// Fabricate an initialized SPL mint at `mint` with the given decimals.
    pub fn write_mint(&mut self, mint: Pubkey, decimals: u8) {
        let state = SplMint {
            mint_authority: COption::Some(self.payer.pubkey()),
            supply: 0,
            decimals,
            is_initialized: true,
            freeze_authority: COption::None,
        };
        let mut data = vec![0u8; SplMint::LEN];
        SplMint::pack(state, &mut data).expect("pack mint");
        self.svm
            .set_account(
                mint,
                SolAccount {
                    lamports: self.svm.minimum_balance_for_rent_exemption(SplMint::LEN),
                    data,
                    owner: TOKEN_PROGRAM_ID,
                    executable: false,
                    rent_epoch: 0,
                },
            )
            .expect("write mint");
    }

    /// Create a fresh, SOL-funded bettor keypair plus a USDC token account holding `amount`.
    /// Returns `(bettor, bettor_usdc_account)`.
    pub fn new_bettor(&mut self, amount: u64) -> (Keypair, Pubkey) {
        let bettor = Keypair::new();
        self.svm
            .airdrop(&bettor.pubkey(), 10 * LAMPORTS_PER_SOL)
            .expect("airdrop bettor");
        let token_acc = self.write_token_account(bettor.pubkey(), amount);
        (bettor, token_acc)
    }

    /// Fabricate an initialized USDC token account owned by `owner` holding `amount`.
    /// Uses a unique address (not an ATA) — the program never derives bettor token PDAs.
    pub fn write_token_account(&mut self, owner: Pubkey, amount: u64) -> Pubkey {
        let addr = Pubkey::new_unique();
        self.write_token_account_at(addr, owner, amount);
        addr
    }

    /// Fabricate an initialized USDC token account at a specific address.
    pub fn write_token_account_at(&mut self, addr: Pubkey, owner: Pubkey, amount: u64) {
        let state = SplTokenAccount {
            mint: self.usdc_mint,
            owner,
            amount,
            delegate: COption::None,
            state: AccountState::Initialized,
            is_native: COption::None,
            delegated_amount: 0,
            close_authority: COption::None,
        };
        let mut data = vec![0u8; SplTokenAccount::LEN];
        SplTokenAccount::pack(state, &mut data).expect("pack token account");
        self.svm
            .set_account(
                addr,
                SolAccount {
                    lamports: self
                        .svm
                        .minimum_balance_for_rent_exemption(SplTokenAccount::LEN),
                    data,
                    owner: TOKEN_PROGRAM_ID,
                    executable: false,
                    rent_epoch: 0,
                },
            )
            .expect("write token account");
    }

    // ---- PDA derivations (mirror the program's seeds) ----

    pub fn market_pda(&self, creator: &Pubkey, nonce: u64) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[MARKET_SEED, creator.as_ref(), &nonce.to_le_bytes()],
            &self.program_id,
        )
    }

    pub fn escrow_pda(&self, market: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[ESCROW_SEED, market.as_ref()], &self.program_id)
    }

    pub fn position_pda(&self, market: &Pubkey, bettor: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[POSITION_SEED, market.as_ref(), bettor.as_ref()],
            &self.program_id,
        )
    }

    pub fn treasury_pda(&self) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[TREASURY_SEED], &self.program_id)
    }

    // ---- Account readers ----

    pub fn read_market(&self, market: &Pubkey) -> Market {
        let acc = self.svm.get_account(market).expect("market account exists");
        Market::try_deserialize(&mut acc.data.as_slice()).expect("deserialize Market")
    }

    pub fn read_position(&self, position: &Pubkey) -> Position {
        let acc = self
            .svm
            .get_account(position)
            .expect("position account exists");
        Position::try_deserialize(&mut acc.data.as_slice()).expect("deserialize Position")
    }

    pub fn token_balance(&self, token_account: &Pubkey) -> u64 {
        let acc = self
            .svm
            .get_account(token_account)
            .expect("token account exists");
        SplTokenAccount::unpack(&acc.data)
            .expect("unpack token account")
            .amount
    }

    // ---- Transaction submission ----

    /// Send a transaction signed by the given signers (payer is always a signer + fee payer).
    pub fn send(&mut self, ixs: &[Instruction], signers: &[&Keypair]) -> SendResult {
        let blockhash = self.svm.latest_blockhash();
        let mut all: Vec<&Keypair> = Vec::with_capacity(signers.len() + 1);
        all.push(&self.payer);
        for s in signers {
            all.push(s);
        }
        let tx =
            Transaction::new_signed_with_payer(ixs, Some(&self.payer.pubkey()), &all, blockhash);
        self.svm.send_transaction(tx)
    }
}

/// Convenience alias for the litesvm transaction result.
pub type SendResult = Result<litesvm::types::TransactionMetadata, FailedTransactionMetadata>;

pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
/// A fixed "now" used as the base wall-clock time in the harness.
pub const NOW: i64 = 1_700_000_000;

/// Builder for `CreateMarketParams` borsh payloads. Mirrors the program's struct field order.
#[derive(Clone)]
pub struct MarketParams {
    pub fixture_id: i64,
    pub seq: u32,
    pub stat_key: u32,
    pub stat_key2: Option<u32>,
    pub op: Option<finalwhistle::state::BinaryOp>,
    pub period: i32,
    pub threshold: i32,
    pub comparison: finalwhistle::state::Comparison,
    pub close_ts: i64,
    pub fee_bps: u16,
    pub title: String,
}

impl MarketParams {
    /// A sane single-stat default: GreaterThan(2) on stat 1, closing in the future.
    pub fn default_single() -> Self {
        Self {
            fixture_id: 42,
            seq: 0,
            stat_key: 1,
            stat_key2: None,
            op: None,
            period: 0,
            threshold: 2,
            comparison: finalwhistle::state::Comparison::GreaterThan,
            close_ts: NOW + 3_600,
            fee_bps: finalwhistle::constants::DEFAULT_FEE_BPS,
            title: "Match goals > 2".to_string(),
        }
    }

    /// Serialize into the on-the-wire borsh layout the program expects.
    fn to_borsh(&self) -> Vec<u8> {
        let mut buf = Vec::new();
        self.fixture_id.serialize(&mut buf).unwrap();
        self.seq.serialize(&mut buf).unwrap();
        self.stat_key.serialize(&mut buf).unwrap();
        self.stat_key2.serialize(&mut buf).unwrap();
        self.op.serialize(&mut buf).unwrap();
        self.period.serialize(&mut buf).unwrap();
        self.threshold.serialize(&mut buf).unwrap();
        self.comparison.serialize(&mut buf).unwrap();
        self.close_ts.serialize(&mut buf).unwrap();
        self.fee_bps.serialize(&mut buf).unwrap();
        self.title.serialize(&mut buf).unwrap();
        buf
    }
}

/// Build a `create_market` instruction. Accounts follow `CreateMarket` field order:
/// creator, usdc_mint, market, escrow, token_program, system_program.
pub fn ix_create_market(
    env: &TestEnv,
    creator: &Pubkey,
    nonce: u64,
    params: &MarketParams,
) -> Instruction {
    let (market, _) = env.market_pda(creator, nonce);
    let (escrow, _) = env.escrow_pda(&market);

    let mut data = DISC_CREATE_MARKET.to_vec();
    nonce.serialize(&mut data).unwrap();
    data.extend_from_slice(&params.to_borsh());

    Instruction {
        program_id: env.program_id,
        accounts: vec![
            AccountMeta::new(*creator, true),
            AccountMeta::new_readonly(env.usdc_mint, false),
            AccountMeta::new(market, false),
            AccountMeta::new(escrow, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
    }
}

/// Build a `place_position` instruction. Accounts follow `PlacePosition` field order:
/// bettor, market, position, bettor_usdc, escrow, usdc_mint, token_program, system_program.
pub fn ix_place_position(
    env: &TestEnv,
    bettor: &Pubkey,
    bettor_usdc: &Pubkey,
    market: &Pubkey,
    side: u8,
    amount: u64,
) -> Instruction {
    let (position, _) = env.position_pda(market, bettor);
    let (escrow, _) = env.escrow_pda(market);

    let mut data = DISC_PLACE_POSITION.to_vec();
    side.serialize(&mut data).unwrap();
    amount.serialize(&mut data).unwrap();

    Instruction {
        program_id: env.program_id,
        accounts: vec![
            AccountMeta::new(*bettor, true),
            AccountMeta::new(*market, false),
            AccountMeta::new(position, false),
            AccountMeta::new(*bettor_usdc, false),
            AccountMeta::new(escrow, false),
            AccountMeta::new_readonly(env.usdc_mint, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
    }
}

/// Build a `void_market` instruction. Accounts: authority, market.
pub fn ix_void_market(env: &TestEnv, authority: &Pubkey, market: &Pubkey) -> Instruction {
    Instruction {
        program_id: env.program_id,
        accounts: vec![
            AccountMeta::new_readonly(*authority, true),
            AccountMeta::new(*market, false),
        ],
        data: DISC_VOID_MARKET.to_vec(),
    }
}

/// Build a `claim` instruction. Accounts follow `Claim` field order:
/// claimant, market, position, owner, escrow, claimant_usdc, usdc_mint, token_program.
pub fn ix_claim(
    env: &TestEnv,
    claimant: &Pubkey,
    market: &Pubkey,
    position_owner: &Pubkey,
    claimant_usdc: &Pubkey,
) -> Instruction {
    let (position, _) = env.position_pda(market, position_owner);
    let (escrow, _) = env.escrow_pda(market);

    Instruction {
        program_id: env.program_id,
        accounts: vec![
            AccountMeta::new(*claimant, true),
            AccountMeta::new(*market, false),
            AccountMeta::new(position, false),
            AccountMeta::new_readonly(*position_owner, false),
            AccountMeta::new(escrow, false),
            AccountMeta::new(*claimant_usdc, false),
            AccountMeta::new_readonly(env.usdc_mint, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
        data: DISC_CLAIM.to_vec(),
    }
}

/// The TxLINE program id the `settle` context pins via `address = TXLINE_PROGRAM_ID`.
pub const TXLINE_PROGRAM_ID: Pubkey =
    Pubkey::from_str_const("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

impl TestEnv {
    /// Fabricate the accounts the `settle` context's account-level constraints require so
    /// that execution reaches the in-handler `require!` guards. Two accounts are written: a
    /// placeholder account at `TXLINE_PROGRAM_ID` (satisfies `address =`), and a
    /// `daily_scores_merkle_roots` account owned by `TXLINE_PROGRAM_ID` (satisfies
    /// `owner = txline_program.key()`).
    ///
    /// Returns the merkle-roots account address. These guards are designed to trip BEFORE
    /// the CPI into TxLINE, so the (non-executable) placeholder program is never invoked.
    pub fn setup_settle_oracle_accounts(&mut self) -> Pubkey {
        // Placeholder at the pinned TxLINE program id (key match is all `address =` needs).
        self.svm
            .set_account(
                TXLINE_PROGRAM_ID,
                SolAccount {
                    lamports: self.svm.minimum_balance_for_rent_exemption(0),
                    data: vec![],
                    owner: SYSTEM_PROGRAM_ID,
                    executable: false,
                    rent_epoch: 0,
                },
            )
            .expect("write txline placeholder");

        let merkle_roots = Pubkey::new_unique();
        self.svm
            .set_account(
                merkle_roots,
                SolAccount {
                    lamports: self.svm.minimum_balance_for_rent_exemption(8),
                    data: vec![0u8; 8],
                    owner: TXLINE_PROGRAM_ID,
                    executable: false,
                    rent_epoch: 0,
                },
            )
            .expect("write merkle roots");
        merkle_roots
    }

    /// The treasury USDC ATA (derived the way the `settle` context derives it).
    pub fn treasury_usdc_ata(&self) -> Pubkey {
        let (treasury, _) = self.treasury_pda();
        spl_associated_token_account_interface::address::get_associated_token_address_with_program_id(
            &treasury,
            &self.usdc_mint,
            &TOKEN_PROGRAM_ID,
        )
    }
}

/// A `SettleProof` builder. Defaults are consistent with `MarketParams::default_single`
/// so individual guard tests only flip the one field they exercise.
pub struct ProofParams {
    pub ts: i64,
    pub fixture_id: i64,
    pub stat_key: u32,
    pub period: i32,
    pub stat_b_key: Option<u32>,
    pub op: Option<finalwhistle::oracle::TxBinaryExpression>,
}

impl ProofParams {
    /// Matches `MarketParams::default_single` (single-stat, fixture 42, stat 1, period 0).
    pub fn matching_single() -> Self {
        Self {
            ts: NOW,
            fixture_id: 42,
            stat_key: 1,
            period: 0,
            stat_b_key: None,
            op: None,
        }
    }

    fn build(&self) -> finalwhistle::SettleProof {
        use finalwhistle::oracle::{
            TxProofNode, TxScoreStat, TxScoresBatchSummary, TxScoresUpdateStats, TxStatTerm,
        };
        let stat_term = |key: u32, period: i32| TxStatTerm {
            stat_to_prove: TxScoreStat {
                key,
                value: 0,
                period,
            },
            event_stat_root: [0u8; 32],
            stat_proof: Vec::<TxProofNode>::new(),
        };
        finalwhistle::SettleProof {
            ts: self.ts,
            fixture_summary: TxScoresBatchSummary {
                fixture_id: self.fixture_id,
                update_stats: TxScoresUpdateStats {
                    update_count: 0,
                    min_timestamp: 0,
                    max_timestamp: 0,
                },
                events_sub_tree_root: [0u8; 32],
            },
            fixture_proof: Vec::new(),
            main_tree_proof: Vec::new(),
            stat_a: stat_term(self.stat_key, self.period),
            stat_b: self.stat_b_key.map(|k| stat_term(k, self.period)),
            op: self.op,
        }
    }
}

/// Build a `settle` instruction. Accounts follow `Settle` field order:
/// settler, market, escrow, daily_scores_merkle_roots, txline_program, treasury,
/// treasury_usdc, usdc_mint, token_program, associated_token_program, system_program.
pub fn ix_settle(
    env: &TestEnv,
    settler: &Pubkey,
    market: &Pubkey,
    merkle_roots: &Pubkey,
    proof: &ProofParams,
) -> Instruction {
    let (escrow, _) = env.escrow_pda(market);
    let (treasury, _) = env.treasury_pda();
    let treasury_usdc = env.treasury_usdc_ata();

    let mut data = DISC_SETTLE.to_vec();
    proof.build().serialize(&mut data).unwrap();

    Instruction {
        program_id: env.program_id,
        accounts: vec![
            AccountMeta::new(*settler, true),
            AccountMeta::new(*market, false),
            AccountMeta::new(escrow, false),
            AccountMeta::new_readonly(*merkle_roots, false),
            AccountMeta::new_readonly(TXLINE_PROGRAM_ID, false),
            AccountMeta::new_readonly(treasury, false),
            AccountMeta::new(treasury_usdc, false),
            AccountMeta::new_readonly(env.usdc_mint, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(ATA_PROGRAM_ID, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
    }
}

/// Extract the Anchor custom error code from a failed transaction, if any.
/// Anchor surfaces program errors as `InstructionError::Custom(code)`.
pub fn anchor_error_code(meta: &FailedTransactionMetadata) -> Option<u32> {
    use solana_instruction::error::InstructionError;
    match &meta.err {
        TransactionError::InstructionError(_, InstructionError::Custom(code)) => Some(*code),
        _ => None,
    }
}

/// Assert that a send result failed with the given Anchor error code.
#[track_caller]
pub fn assert_anchor_err(res: &SendResult, expected_code: u32) {
    match res {
        Ok(_) => panic!("expected failure with code {expected_code}, but tx succeeded"),
        Err(meta) => {
            let got = anchor_error_code(meta);
            assert_eq!(
                got,
                Some(expected_code),
                "expected Anchor error code {expected_code}, got {:?}\nlogs:\n{}",
                meta.err,
                meta.meta.logs.join("\n"),
            );
        }
    }
}

/// Anchor error codes (mirrors `FinalWhistleError`, base 6000), from the IDL.
pub mod err {
    pub const FEE_TOO_HIGH: u32 = 6000;
    pub const CLOSE_IN_PAST: u32 = 6001;
    pub const INCONSISTENT_TWO_STAT: u32 = 6002;
    pub const STAKE_TOO_SMALL: u32 = 6003;
    pub const MARKET_CLOSED: u32 = 6004;
    pub const MARKET_NOT_OPEN: u32 = 6005;
    pub const MARKET_ALREADY_FINALIZED: u32 = 6006;
    pub const MARKET_NOT_RESOLVED: u32 = 6007;
    pub const MARKET_VOIDED: u32 = 6008;
    pub const MARKET_NOT_VOIDED: u32 = 6009;
    pub const INVALID_SIDE: u32 = 6010;
    pub const MATH_OVERFLOW: u32 = 6011;
    pub const EPOCH_DAY_MISMATCH: u32 = 6012;
    pub const FIXTURE_MISMATCH: u32 = 6013;
    pub const STAT_KEY_MISMATCH: u32 = 6014;
    pub const PERIOD_MISMATCH: u32 = 6015;
    pub const SETTLE_BEFORE_CLOSE: u32 = 6016;
    pub const INVALID_ORACLE_ACCOUNT: u32 = 6017;
    pub const INVALID_ORACLE_PROGRAM: u32 = 6018;
    pub const NOTHING_TO_CLAIM: u32 = 6019;
    pub const ALREADY_CLAIMED: u32 = 6020;
    pub const POSITION_MARKET_MISMATCH: u32 = 6021;
    pub const EQUALITY_NOT_SUPPORTED: u32 = 6022;
    pub const FINALITY_NOT_REACHED: u32 = 6023;
    pub const ORACLE_NO_RETURN_DATA: u32 = 6024;
    pub const MISSING_SECOND_STAT: u32 = 6025;
    pub const UNEXPECTED_SECOND_STAT: u32 = 6026;
    pub const OPERATOR_MISMATCH: u32 = 6027;
}
