//! Integration tests for FinalWhistle, driven by LiteSVM against the compiled program.
//!
//! Covers the non-oracle paths and pre-CPI guards: create_market, place_position,
//! void_market, claim-on-void, and every settle pre-CPI guard. The full settle happy
//! path CPIs into TxLINE (unavailable on a local validator) and is proven on devnet;
//! the payout math itself is covered by the pure unit tests in `tests/unit.rs`.

mod common;

use common::*;
use finalwhistle::constants::{MIN_STAKE, SIDE_NO, SIDE_YES};
use finalwhistle::state::{BinaryOp, Comparison, MarketStatus};

// ---------------------------------------------------------------------------
// create_market
// ---------------------------------------------------------------------------

#[test]
fn create_market_happy_path() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let nonce = 7u64;
    let params = MarketParams::default_single();

    let (market_pda, market_bump) = env.market_pda(&creator.pubkey(), nonce);
    let (escrow_pda, escrow_bump) = env.escrow_pda(&market_pda);

    let ix = ix_create_market(&env, &creator.pubkey(), nonce, &params);
    let res = env.send(&[ix], &[]);
    assert!(res.is_ok(), "create_market failed: {res:?}");

    let market = env.read_market(&market_pda);
    assert_eq!(market.authority, creator.pubkey());
    assert_eq!(market.usdc_mint, env.usdc_mint);
    assert_eq!(market.escrow, escrow_pda);
    assert_eq!(market.nonce, nonce);
    assert_eq!(market.fixture_id, params.fixture_id);
    assert_eq!(market.stat_key, params.stat_key);
    assert_eq!(market.stat_key2, None);
    assert_eq!(market.op, None);
    assert_eq!(market.threshold, params.threshold);
    assert_eq!(market.comparison, Comparison::GreaterThan);
    assert_eq!(market.close_ts, params.close_ts);
    assert_eq!(market.fee_bps, params.fee_bps);
    assert_eq!(market.status, MarketStatus::Open);
    assert_eq!(market.yes_pool, 0);
    assert_eq!(market.no_pool, 0);
    assert_eq!(market.winning_side, 0);
    assert_eq!(market.bump, market_bump);
    assert_eq!(market.escrow_bump, escrow_bump);
    assert!(!market.is_two_stat());

    // Escrow token account was created with a zero balance.
    assert_eq!(env.token_balance(&escrow_pda), 0);
}

#[test]
fn create_market_two_stat_happy_path() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let nonce = 1u64;
    let mut params = MarketParams::default_single();
    params.stat_key2 = Some(2);
    params.op = Some(BinaryOp::Add);

    let (market_pda, _) = env.market_pda(&creator.pubkey(), nonce);
    let ix = ix_create_market(&env, &creator.pubkey(), nonce, &params);
    assert!(env.send(&[ix], &[]).is_ok());

    let market = env.read_market(&market_pda);
    assert!(market.is_two_stat());
    assert_eq!(market.stat_key2, Some(2));
    assert_eq!(market.op, Some(BinaryOp::Add));
}

#[test]
fn create_market_fee_too_high() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let mut params = MarketParams::default_single();
    params.fee_bps = 1001; // MAX_FEE_BPS is 1000

    let ix = ix_create_market(&env, &creator.pubkey(), 1, &params);
    let res = env.send(&[ix], &[]);
    assert_anchor_err(&res, err::FEE_TOO_HIGH);
}

#[test]
fn create_market_fee_at_max_is_ok() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let mut params = MarketParams::default_single();
    params.fee_bps = 1000; // exactly MAX_FEE_BPS

    let ix = ix_create_market(&env, &creator.pubkey(), 2, &params);
    assert!(env.send(&[ix], &[]).is_ok());
}

#[test]
fn create_market_close_in_past() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let mut params = MarketParams::default_single();
    params.close_ts = NOW - 1; // already in the past

    let ix = ix_create_market(&env, &creator.pubkey(), 3, &params);
    let res = env.send(&[ix], &[]);
    assert_anchor_err(&res, err::CLOSE_IN_PAST);
}

#[test]
fn create_market_close_equal_now_is_in_past() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let mut params = MarketParams::default_single();
    params.close_ts = NOW; // require!(close_ts > now) is strict

    let ix = ix_create_market(&env, &creator.pubkey(), 4, &params);
    let res = env.send(&[ix], &[]);
    assert_anchor_err(&res, err::CLOSE_IN_PAST);
}

#[test]
fn create_market_inconsistent_two_stat_key_without_op() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let mut params = MarketParams::default_single();
    params.stat_key2 = Some(2);
    params.op = None; // key set but op missing

    let ix = ix_create_market(&env, &creator.pubkey(), 5, &params);
    let res = env.send(&[ix], &[]);
    assert_anchor_err(&res, err::INCONSISTENT_TWO_STAT);
}

#[test]
fn create_market_inconsistent_two_stat_op_without_key() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let mut params = MarketParams::default_single();
    params.stat_key2 = None;
    params.op = Some(BinaryOp::Subtract); // op set but key missing

    let ix = ix_create_market(&env, &creator.pubkey(), 6, &params);
    let res = env.send(&[ix], &[]);
    assert_anchor_err(&res, err::INCONSISTENT_TWO_STAT);
}

// ---------------------------------------------------------------------------
// place_position
// ---------------------------------------------------------------------------

/// Helper: create a default open market with the payer as creator. Returns the market PDA.
fn open_market(env: &mut TestEnv, nonce: u64) -> solana_pubkey::Pubkey {
    let creator = env.payer.insecure_clone();
    let params = MarketParams::default_single();
    let (market_pda, _) = env.market_pda(&creator.pubkey(), nonce);
    let ix = ix_create_market(env, &creator.pubkey(), nonce, &params);
    assert!(env.send(&[ix], &[]).is_ok(), "open_market setup failed");
    market_pda
}

#[test]
fn place_position_yes_happy_path() {
    let mut env = TestEnv::new();
    let market = open_market(&mut env, 10);
    let (escrow, _) = env.escrow_pda(&market);

    let stake = 1_000_000u64;
    let (bettor, bettor_usdc) = env.new_bettor(stake);
    let (position_pda, _) = env.position_pda(&market, &bettor.pubkey());

    let ix = ix_place_position(
        &env,
        &bettor.pubkey(),
        &bettor_usdc,
        &market,
        SIDE_YES,
        stake,
    );
    let res = env.send(&[ix], &[&bettor]);
    assert!(res.is_ok(), "place_position failed: {res:?}");

    // Escrow received the stake; bettor account drained.
    assert_eq!(env.token_balance(&escrow), stake);
    assert_eq!(env.token_balance(&bettor_usdc), 0);

    let m = env.read_market(&market);
    assert_eq!(m.yes_pool, stake);
    assert_eq!(m.no_pool, 0);

    let p = env.read_position(&position_pda);
    assert_eq!(p.market, market);
    assert_eq!(p.owner, bettor.pubkey());
    assert_eq!(p.yes_amount, stake);
    assert_eq!(p.no_amount, 0);
    assert!(!p.claimed);
}

#[test]
fn place_position_no_and_accumulates() {
    let mut env = TestEnv::new();
    let market = open_market(&mut env, 11);
    let (escrow, _) = env.escrow_pda(&market);

    let (bettor, bettor_usdc) = env.new_bettor(5 * MIN_STAKE);
    let (position_pda, _) = env.position_pda(&market, &bettor.pubkey());

    // First a NO stake.
    let ix1 = ix_place_position(
        &env,
        &bettor.pubkey(),
        &bettor_usdc,
        &market,
        SIDE_NO,
        MIN_STAKE,
    );
    assert!(env.send(&[ix1], &[&bettor]).is_ok());
    // Then add a YES stake on the same position (init_if_needed reuse path).
    let ix2 = ix_place_position(
        &env,
        &bettor.pubkey(),
        &bettor_usdc,
        &market,
        SIDE_YES,
        2 * MIN_STAKE,
    );
    assert!(env.send(&[ix2], &[&bettor]).is_ok());

    let m = env.read_market(&market);
    assert_eq!(m.no_pool, MIN_STAKE);
    assert_eq!(m.yes_pool, 2 * MIN_STAKE);
    assert_eq!(env.token_balance(&escrow), 3 * MIN_STAKE);

    let p = env.read_position(&position_pda);
    assert_eq!(p.no_amount, MIN_STAKE);
    assert_eq!(p.yes_amount, 2 * MIN_STAKE);
}

#[test]
fn place_position_stake_too_small() {
    let mut env = TestEnv::new();
    let market = open_market(&mut env, 12);
    let (bettor, bettor_usdc) = env.new_bettor(MIN_STAKE);

    let ix = ix_place_position(
        &env,
        &bettor.pubkey(),
        &bettor_usdc,
        &market,
        SIDE_YES,
        MIN_STAKE - 1,
    );
    let res = env.send(&[ix], &[&bettor]);
    assert_anchor_err(&res, err::STAKE_TOO_SMALL);
}

#[test]
fn place_position_invalid_side_zero() {
    let mut env = TestEnv::new();
    let market = open_market(&mut env, 13);
    let (bettor, bettor_usdc) = env.new_bettor(MIN_STAKE);

    let ix = ix_place_position(&env, &bettor.pubkey(), &bettor_usdc, &market, 0, MIN_STAKE);
    let res = env.send(&[ix], &[&bettor]);
    assert_anchor_err(&res, err::INVALID_SIDE);
}

#[test]
fn place_position_invalid_side_three() {
    let mut env = TestEnv::new();
    let market = open_market(&mut env, 14);
    let (bettor, bettor_usdc) = env.new_bettor(MIN_STAKE);

    let ix = ix_place_position(&env, &bettor.pubkey(), &bettor_usdc, &market, 3, MIN_STAKE);
    let res = env.send(&[ix], &[&bettor]);
    assert_anchor_err(&res, err::INVALID_SIDE);
}

#[test]
fn place_position_after_close_is_market_closed() {
    let mut env = TestEnv::new();
    let market = open_market(&mut env, 15);
    let (bettor, bettor_usdc) = env.new_bettor(MIN_STAKE);

    // Warp past close_ts (NOW + 3600) but the market is still Open.
    env.set_unix_time(NOW + 7_200);

    let ix = ix_place_position(
        &env,
        &bettor.pubkey(),
        &bettor_usdc,
        &market,
        SIDE_YES,
        MIN_STAKE,
    );
    let res = env.send(&[ix], &[&bettor]);
    assert_anchor_err(&res, err::MARKET_CLOSED);
}

// ---------------------------------------------------------------------------
// void_market
// ---------------------------------------------------------------------------

#[test]
fn void_market_by_authority() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let market = open_market(&mut env, 20);

    let ix = ix_void_market(&env, &creator.pubkey(), &market);
    let res = env.send(&[ix], &[]);
    assert!(res.is_ok(), "void failed: {res:?}");

    let m = env.read_market(&market);
    assert_eq!(m.status, MarketStatus::Voided);
    assert_eq!(m.winning_side, 0);
    assert!(m.settle_ts > 0);
}

#[test]
fn void_market_non_authority_rejected() {
    let mut env = TestEnv::new();
    let _creator = env.payer.insecure_clone();
    let market = open_market(&mut env, 21);

    // A different signer attempts to void; `has_one = authority` fails (InvalidSide).
    let intruder = Keypair::new();
    env.svm
        .airdrop(&intruder.pubkey(), LAMPORTS_PER_SOL)
        .unwrap();
    let ix = ix_void_market(&env, &intruder.pubkey(), &market);
    let res = env.send(&[ix], &[&intruder]);
    assert_anchor_err(&res, err::INVALID_SIDE);

    // Market is untouched.
    assert_eq!(env.read_market(&market).status, MarketStatus::Open);
}

#[test]
fn void_market_already_voided_rejected() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let market = open_market(&mut env, 22);

    // First void succeeds.
    let ix = ix_void_market(&env, &creator.pubkey(), &market);
    assert!(env.send(&[ix], &[]).is_ok());

    // Fresh blockhash so the second (otherwise-identical) tx isn't deduped as AlreadyProcessed.
    env.svm.expire_blockhash();

    // Second void on a non-Open market → MarketAlreadyFinalized.
    let ix2 = ix_void_market(&env, &creator.pubkey(), &market);
    let res = env.send(&[ix2], &[]);
    assert_anchor_err(&res, err::MARKET_ALREADY_FINALIZED);
}

// ---------------------------------------------------------------------------
// claim on a voided market (full refund) — the get-value-out path without oracle
// ---------------------------------------------------------------------------

#[test]
fn claim_void_refunds_full_stake() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let market = open_market(&mut env, 30);
    let (escrow, _) = env.escrow_pda(&market);

    // Bettor stakes on both sides.
    let yes_stake = 3 * MIN_STAKE;
    let no_stake = 2 * MIN_STAKE;
    let (bettor, bettor_usdc) = env.new_bettor(yes_stake + no_stake);
    let ix_y = ix_place_position(
        &env,
        &bettor.pubkey(),
        &bettor_usdc,
        &market,
        SIDE_YES,
        yes_stake,
    );
    assert!(env.send(&[ix_y], &[&bettor]).is_ok());
    let ix_n = ix_place_position(
        &env,
        &bettor.pubkey(),
        &bettor_usdc,
        &market,
        SIDE_NO,
        no_stake,
    );
    assert!(env.send(&[ix_n], &[&bettor]).is_ok());

    assert_eq!(env.token_balance(&escrow), yes_stake + no_stake);
    assert_eq!(env.token_balance(&bettor_usdc), 0);

    // Authority voids the market.
    let ix_v = ix_void_market(&env, &creator.pubkey(), &market);
    assert!(env.send(&[ix_v], &[]).is_ok());

    // Bettor claims a full refund (yes + no).
    let ix_c = ix_claim(
        &env,
        &bettor.pubkey(),
        &market,
        &bettor.pubkey(),
        &bettor_usdc,
    );
    let res = env.send(&[ix_c], &[&bettor]);
    assert!(res.is_ok(), "claim refund failed: {res:?}");

    assert_eq!(env.token_balance(&bettor_usdc), yes_stake + no_stake);
    assert_eq!(env.token_balance(&escrow), 0);

    let (pos_pda, _) = env.position_pda(&market, &bettor.pubkey());
    let p = env.read_position(&pos_pda);
    assert!(p.claimed);

    let m = env.read_market(&market);
    assert_eq!(m.total_claimed, yes_stake + no_stake);
}

#[test]
fn claim_void_double_claim_rejected() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let market = open_market(&mut env, 31);

    let stake = 4 * MIN_STAKE;
    let (bettor, bettor_usdc) = env.new_bettor(stake);
    let ix_p = ix_place_position(
        &env,
        &bettor.pubkey(),
        &bettor_usdc,
        &market,
        SIDE_YES,
        stake,
    );
    assert!(env.send(&[ix_p], &[&bettor]).is_ok());

    let ix_v = ix_void_market(&env, &creator.pubkey(), &market);
    assert!(env.send(&[ix_v], &[]).is_ok());

    // First claim ok.
    let ix_c1 = ix_claim(
        &env,
        &bettor.pubkey(),
        &market,
        &bettor.pubkey(),
        &bettor_usdc,
    );
    assert!(env.send(&[ix_c1], &[&bettor]).is_ok());

    // Fresh blockhash so the second (otherwise-identical) tx isn't deduped as AlreadyProcessed.
    env.svm.expire_blockhash();

    // Second claim → AlreadyClaimed.
    let ix_c2 = ix_claim(
        &env,
        &bettor.pubkey(),
        &market,
        &bettor.pubkey(),
        &bettor_usdc,
    );
    let res = env.send(&[ix_c2], &[&bettor]);
    assert_anchor_err(&res, err::ALREADY_CLAIMED);
}

#[test]
fn claim_on_open_market_is_not_resolved() {
    let mut env = TestEnv::new();
    let _creator = env.payer.insecure_clone();
    let market = open_market(&mut env, 32);

    let stake = 2 * MIN_STAKE;
    let (bettor, bettor_usdc) = env.new_bettor(stake);
    let ix_p = ix_place_position(
        &env,
        &bettor.pubkey(),
        &bettor_usdc,
        &market,
        SIDE_YES,
        stake,
    );
    assert!(env.send(&[ix_p], &[&bettor]).is_ok());

    // Market still Open → claim must fail with MarketNotResolved.
    let ix_c = ix_claim(
        &env,
        &bettor.pubkey(),
        &market,
        &bettor.pubkey(),
        &bettor_usdc,
    );
    let res = env.send(&[ix_c], &[&bettor]);
    assert_anchor_err(&res, err::MARKET_NOT_RESOLVED);
}

#[test]
fn claim_wrong_owner_rejected() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let market = open_market(&mut env, 33);

    let stake = 2 * MIN_STAKE;
    let (bettor, bettor_usdc) = env.new_bettor(stake);
    let ix_p = ix_place_position(
        &env,
        &bettor.pubkey(),
        &bettor_usdc,
        &market,
        SIDE_YES,
        stake,
    );
    assert!(env.send(&[ix_p], &[&bettor]).is_ok());

    let ix_v = ix_void_market(&env, &creator.pubkey(), &market);
    assert!(env.send(&[ix_v], &[]).is_ok());

    // An attacker signs as claimant but passes the victim's position (owner = bettor).
    // The `position` PDA is derived from `owner`, so we pass position_owner = bettor but
    // claimant = attacker. The handler's `claimant.key() == position.owner` check fails
    // with NothingToClaim before any transfer.
    let attacker = Keypair::new();
    env.svm
        .airdrop(&attacker.pubkey(), LAMPORTS_PER_SOL)
        .unwrap();
    let attacker_usdc = env.write_token_account(attacker.pubkey(), 0);

    let ix_c = ix_claim(
        &env,
        &attacker.pubkey(),
        &market,
        &bettor.pubkey(),
        &attacker_usdc,
    );
    let res = env.send(&[ix_c], &[&attacker]);
    // `has_one = owner @ NothingToClaim` fires because the passed `owner` account
    // (bettor) does not equal `attacker` when Anchor checks... actually owner == bettor
    // matches position.owner, so the in-handler claimant!=owner check (NothingToClaim) trips.
    assert_anchor_err(&res, err::NOTHING_TO_CLAIM);

    // Victim funds remain claimable (escrow untouched).
    let (escrow, _) = env.escrow_pda(&market);
    assert_eq!(env.token_balance(&escrow), stake);
}
