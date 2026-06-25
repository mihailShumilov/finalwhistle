use anchor_lang::prelude::*;

/// PDA seed for a market account.
#[constant]
pub const MARKET_SEED: &[u8] = b"market";

/// PDA seed for a market's USDC escrow token account.
#[constant]
pub const ESCROW_SEED: &[u8] = b"escrow";

/// PDA seed for a bettor's per-market position account.
#[constant]
pub const POSITION_SEED: &[u8] = b"position";

/// PDA seed for the protocol treasury authority.
#[constant]
pub const TREASURY_SEED: &[u8] = b"treasury";

/// PDA seed used by the TxLINE oracle for its daily scores Merkle roots account.
/// Seed layout: `["daily_scores_roots", epoch_day as u16 little-endian]`.
#[constant]
pub const TXLINE_DAILY_SCORES_SEED: &[u8] = b"daily_scores_roots";

/// Protocol fee charged on the losing pool at settlement, in basis points (2.00%).
#[constant]
pub const DEFAULT_FEE_BPS: u16 = 200;

/// Hard ceiling on the configurable fee (10.00%) — a creator can never set more.
#[constant]
pub const MAX_FEE_BPS: u16 = 1_000;

/// Basis-points denominator.
pub const BPS_DENOMINATOR: u64 = 10_000;

/// Minimum stake per position action, in USDC base units (0.01 USDC at 6 decimals).
#[constant]
pub const MIN_STAKE: u64 = 10_000;

/// Side discriminants stored in `Market::winning_side`.
pub const SIDE_NONE: u8 = 0;
pub const SIDE_YES: u8 = 1;
pub const SIDE_NO: u8 = 2;

/// The TxLINE (`txoracle`) program id we CPI into for settlement. This is the **devnet**
/// address — FinalWhistle's hackathon target — and the same address is cloned into the local
/// test validator. A mainnet build must change this constant (and redeploy).
pub const TXLINE_PROGRAM_ID: Pubkey = pubkey!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
