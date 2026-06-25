//! Settle PRE-CPI guard tests.
//!
//! Every test here is designed so a guard inside `settle_handler` trips BEFORE the CPI into
//! TxLINE (which is not loaded on a local validator). We assert the specific FinalWhistle
//! error code. Account-level constraints are satisfied via `setup_settle_oracle_accounts`,
//! so the only thing that fails is the targeted in-handler `require!`.

mod common;

use common::*;
use finalwhistle::constants::MIN_STAKE;
use finalwhistle::oracle::TxBinaryExpression;
use finalwhistle::state::BinaryOp;

/// Create an open single-stat market (payer = creator), staked on both sides, then warp
/// past close so settle is allowed. Returns the market PDA.
fn staked_market(env: &mut TestEnv, nonce: u64, params: MarketParams) -> Pubkey {
    let creator = env.payer.insecure_clone();
    let (market, _) = env.market_pda(&creator.pubkey(), nonce);
    let close_ts = params.close_ts;
    let ix = ix_create_market(env, &creator.pubkey(), nonce, &params);
    assert!(env.send(&[ix], &[]).is_ok(), "market setup failed");

    // Stake on both sides so the winning pool is non-empty regardless of outcome.
    let (b1, b1_usdc) = env.new_bettor(10 * MIN_STAKE);
    let ix_y = ix_place_position(env, &b1.pubkey(), &b1_usdc, &market, 1, 5 * MIN_STAKE);
    assert!(env.send(&[ix_y], &[&b1]).is_ok());
    let (b2, b2_usdc) = env.new_bettor(10 * MIN_STAKE);
    let ix_n = ix_place_position(env, &b2.pubkey(), &b2_usdc, &market, 2, 5 * MIN_STAKE);
    assert!(env.send(&[ix_n], &[&b2]).is_ok());

    // Move clock to/after close so settle's SettleBeforeClose guard passes.
    env.set_unix_time(close_ts + 10);
    market
}

#[test]
fn settle_before_close_rejected() {
    let mut env = TestEnv::new();
    let params = MarketParams::default_single();
    let close_ts = params.close_ts;
    let market = staked_market(&mut env, 100, params);
    let merkle = env.setup_settle_oracle_accounts();
    let settler = env.payer.insecure_clone();

    // Move the clock back to BEFORE close to trip SettleBeforeClose.
    env.set_unix_time(close_ts - 100);

    let proof = ProofParams::matching_single();
    let ix = ix_settle(&env, &settler.pubkey(), &market, &merkle, &proof);
    let res = env.send(&[ix], &[]);
    assert_anchor_err(&res, err::SETTLE_BEFORE_CLOSE);
}

#[test]
fn settle_stat_key_mismatch_rejected() {
    let mut env = TestEnv::new();
    let market = staked_market(&mut env, 101, MarketParams::default_single());
    let merkle = env.setup_settle_oracle_accounts();
    let settler = env.payer.insecure_clone();

    let mut proof = ProofParams::matching_single();
    proof.stat_key = 999; // market.stat_key is 1
    let ix = ix_settle(&env, &settler.pubkey(), &market, &merkle, &proof);
    let res = env.send(&[ix], &[]);
    assert_anchor_err(&res, err::STAT_KEY_MISMATCH);
}

#[test]
fn settle_period_mismatch_rejected() {
    let mut env = TestEnv::new();
    let market = staked_market(&mut env, 102, MarketParams::default_single());
    let merkle = env.setup_settle_oracle_accounts();
    let settler = env.payer.insecure_clone();

    let mut proof = ProofParams::matching_single();
    proof.period = 7; // market.period is 0
    let ix = ix_settle(&env, &settler.pubkey(), &market, &merkle, &proof);
    let res = env.send(&[ix], &[]);
    assert_anchor_err(&res, err::PERIOD_MISMATCH);
}

#[test]
fn settle_fixture_mismatch_rejected() {
    let mut env = TestEnv::new();
    let market = staked_market(&mut env, 103, MarketParams::default_single());
    let merkle = env.setup_settle_oracle_accounts();
    let settler = env.payer.insecure_clone();

    let mut proof = ProofParams::matching_single();
    proof.fixture_id = 7777; // market.fixture_id is 42
    let ix = ix_settle(&env, &settler.pubkey(), &market, &merkle, &proof);
    let res = env.send(&[ix], &[]);
    assert_anchor_err(&res, err::FIXTURE_MISMATCH);
}

#[test]
fn settle_two_stat_market_missing_stat_b_rejected() {
    let mut env = TestEnv::new();
    let mut params = MarketParams::default_single();
    params.stat_key2 = Some(2);
    params.op = Some(BinaryOp::Add);
    let market = staked_market(&mut env, 104, params);
    let merkle = env.setup_settle_oracle_accounts();
    let settler = env.payer.insecure_clone();

    // Two-stat market but the proof omits stat_b → MissingSecondStat.
    let proof = ProofParams::matching_single(); // stat_b_key = None
    let ix = ix_settle(&env, &settler.pubkey(), &market, &merkle, &proof);
    let res = env.send(&[ix], &[]);
    assert_anchor_err(&res, err::MISSING_SECOND_STAT);
}

#[test]
fn settle_single_stat_market_with_unexpected_stat_b_rejected() {
    let mut env = TestEnv::new();
    let market = staked_market(&mut env, 105, MarketParams::default_single());
    let merkle = env.setup_settle_oracle_accounts();
    let settler = env.payer.insecure_clone();

    // Single-stat market but the proof carries a stat_b → UnexpectedSecondStat.
    let mut proof = ProofParams::matching_single();
    proof.stat_b_key = Some(2);
    proof.op = Some(TxBinaryExpression::Add);
    let ix = ix_settle(&env, &settler.pubkey(), &market, &merkle, &proof);
    let res = env.send(&[ix], &[]);
    assert_anchor_err(&res, err::UNEXPECTED_SECOND_STAT);
}

#[test]
fn settle_market_not_open_rejected() {
    let mut env = TestEnv::new();
    let creator = env.payer.insecure_clone();
    let params = MarketParams::default_single();
    let close_ts = params.close_ts;
    let market = staked_market(&mut env, 106, params);
    let merkle = env.setup_settle_oracle_accounts();
    let settler = env.payer.insecure_clone();

    // Void the market first (now it's not Open). Voiding requires the market be Open; it is.
    // settle's first guard is `status == Open` → MarketNotOpen.
    env.set_unix_time(NOW); // void doesn't care about close, but keep clock sane
    let ix_v = ix_void_market(&env, &creator.pubkey(), &market);
    assert!(env.send(&[ix_v], &[]).is_ok());

    env.set_unix_time(close_ts + 10);
    let proof = ProofParams::matching_single();
    let ix = ix_settle(&env, &settler.pubkey(), &market, &merkle, &proof);
    let res = env.send(&[ix], &[]);
    assert_anchor_err(&res, err::MARKET_NOT_OPEN);
}

#[test]
fn settle_invalid_oracle_account_owner_rejected() {
    // Account-level constraint: daily_scores_merkle_roots must be owned by txline_program.
    // Here we pass a roots account owned by the system program → InvalidOracleAccount.
    let mut env = TestEnv::new();
    let market = staked_market(&mut env, 107, MarketParams::default_single());
    // Set up the placeholder txline program but a WRONG-owner merkle account.
    let _ = env.setup_settle_oracle_accounts();
    let bad_roots = Pubkey::new_unique();
    env.write_token_account_at(bad_roots, env.payer.pubkey(), 0); // owned by TOKEN program, not txline

    let settler = env.payer.insecure_clone();
    let proof = ProofParams::matching_single();
    let ix = ix_settle(&env, &settler.pubkey(), &market, &bad_roots, &proof);
    let res = env.send(&[ix], &[]);
    assert_anchor_err(&res, err::INVALID_ORACLE_ACCOUNT);
}
