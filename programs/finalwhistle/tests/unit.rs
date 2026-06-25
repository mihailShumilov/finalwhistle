//! Pure unit tests for FinalWhistle's settlement math and predicate orientation.
//!
//! No SVM, no I/O — these exercise the `Market`/`Position` methods directly. They pin the
//! economic invariants (fee = floor(losing * bps / 10000); payout pool = winning +
//! (losing - fee); pro-rata payouts conserve the pool modulo integer dust; overflow is
//! impossible thanks to the u128 intermediates) and the YES/NO predicate negation logic.

use finalwhistle::constants::{BPS_DENOMINATOR, DEFAULT_FEE_BPS, SIDE_NO, SIDE_NONE, SIDE_YES};
use finalwhistle::state::{Comparison, Market, MarketStatus, Position};

/// Build a `Market` with the given pools/fee and otherwise-inert fields.
fn market(yes_pool: u64, no_pool: u64, fee_bps: u16) -> Market {
    Market {
        authority: Default::default(),
        usdc_mint: Default::default(),
        escrow: Default::default(),
        nonce: 0,
        fixture_id: 0,
        seq: 0,
        stat_key: 0,
        stat_key2: None,
        op: None,
        period: 0,
        threshold: 0,
        comparison: Comparison::GreaterThan,
        close_ts: 0,
        yes_pool,
        no_pool,
        fee_bps,
        status: MarketStatus::Open,
        winning_side: SIDE_NONE,
        settle_ts: 0,
        settle_slot: 0,
        fee_collected: 0,
        total_payout_pool: 0,
        total_claimed: 0,
        bump: 0,
        escrow_bump: 0,
        title: String::new(),
    }
}

fn position(yes: u64, no: u64) -> Position {
    Position {
        market: Default::default(),
        owner: Default::default(),
        yes_amount: yes,
        no_amount: no,
        claimed: false,
        bump: 0,
    }
}

// ---------------------------------------------------------------------------
// settlement_split
// ---------------------------------------------------------------------------

#[test]
fn settlement_split_basic_fee_floor() {
    // YES wins. losing = no_pool = 1_000_000, fee = 1_000_000 * 200 / 10000 = 20_000.
    let m = market(3_000_000, 1_000_000, DEFAULT_FEE_BPS);
    let (fee, payout) = m.settlement_split(SIDE_YES).unwrap();
    assert_eq!(fee, 20_000);
    // payout = winning(3_000_000) + (losing(1_000_000) - fee(20_000)) = 3_980_000.
    assert_eq!(payout, 3_980_000);
}

#[test]
fn settlement_split_no_side_wins() {
    // NO wins → losing = yes_pool.
    let m = market(500_000, 2_500_000, DEFAULT_FEE_BPS);
    let (fee, payout) = m.settlement_split(SIDE_NO).unwrap();
    // fee = floor(500_000 * 200 / 10000) = 10_000.
    assert_eq!(fee, 10_000);
    // payout = no_pool(2_500_000) + (yes_pool(500_000) - 10_000) = 2_990_000.
    assert_eq!(payout, 2_990_000);
}

#[test]
fn settlement_split_zero_losing_pool_zero_fee() {
    // Nobody on NO → losing pool 0 → fee 0, payout = winning pool unchanged.
    let m = market(7_777_777, 0, DEFAULT_FEE_BPS);
    let (fee, payout) = m.settlement_split(SIDE_YES).unwrap();
    assert_eq!(fee, 0);
    assert_eq!(payout, 7_777_777);
}

#[test]
fn settlement_split_fee_floor_rounding_edge() {
    // losing = 99 with 200 bps → 99 * 200 / 10000 = 19800/10000 = 1 (floor of 1.98).
    let m = market(0, 99, DEFAULT_FEE_BPS);
    let (fee, payout) = m.settlement_split(SIDE_YES).unwrap();
    assert_eq!(fee, 1);
    // winning pool is 0, so payout = losing(99) - fee(1) = 98.
    assert_eq!(payout, 98);
}

#[test]
fn settlement_split_fee_floor_below_one() {
    // losing = 49 with 200 bps → 9800/10000 = 0 (floor). No fee taken on dust pools.
    let m = market(0, 49, DEFAULT_FEE_BPS);
    let (fee, payout) = m.settlement_split(SIDE_YES).unwrap();
    assert_eq!(fee, 0);
    assert_eq!(payout, 49);
}

#[test]
fn settlement_split_zero_fee_bps() {
    let m = market(1_000, 9_000, 0);
    let (fee, payout) = m.settlement_split(SIDE_YES).unwrap();
    assert_eq!(fee, 0);
    assert_eq!(payout, 10_000); // entire losing pool flows to winners
}

#[test]
fn settlement_split_max_fee_bps() {
    // 1000 bps = 10%. losing = 10_000 → fee = 1_000.
    let m = market(0, 10_000, 1_000);
    let (fee, payout) = m.settlement_split(SIDE_YES).unwrap();
    assert_eq!(fee, 1_000);
    assert_eq!(payout, 9_000);
}

#[test]
fn settlement_split_invalid_side_errors() {
    let m = market(1, 1, DEFAULT_FEE_BPS);
    assert!(m.settlement_split(SIDE_NONE).is_err());
    assert!(m.settlement_split(3).is_err());
}

#[test]
fn settlement_split_near_u64_max_no_panic() {
    // The u128 intermediate makes `losing * fee_bps` impossible to overflow u64-side.
    // With overflow-checks on, a naive u64 multiply would panic; here it must return a
    // Result (Ok or Err) rather than panicking. The fee itself always fits in u64.
    let big = u64::MAX;
    let m = market(big, big, 1_000);
    // This call must NOT panic. With winning = losing = u64::MAX the payout-pool sum
    // overflows u64, so the function returns MathOverflow — calmly, via Result.
    let res = m.settlement_split(SIDE_YES);
    assert!(res.is_err(), "expected MathOverflow, got {res:?}");

    // Verify the fee computation alone (the u128 multiply) is well-defined at the boundary
    // by using pools where only the fee is near the limit but the sum still fits.
    let m2 = market(0, big, 1_000);
    let (fee, payout) = m2.settlement_split(SIDE_YES).unwrap();
    let expected_fee = ((big as u128) * 1000 / (BPS_DENOMINATOR as u128)) as u64;
    assert_eq!(fee, expected_fee);
    assert_eq!(payout, big - expected_fee); // winning is 0 here
}

#[test]
fn settlement_split_overflow_returns_err_not_panic() {
    // winning + net_losing overflows u64 → MathOverflow error, never a Rust panic.
    let big = u64::MAX;
    let m = market(big, big, 1_000);
    let res = m.settlement_split(SIDE_YES);
    assert!(res.is_err(), "expected MathOverflow, got {res:?}");
}

#[test]
fn settlement_split_large_but_fitting() {
    // Pools chosen so the result still fits in u64 (no overflow): winning small, losing huge.
    let losing = u64::MAX / 2;
    let m = market(1_000, losing, DEFAULT_FEE_BPS);
    let (fee, payout) = m.settlement_split(SIDE_YES).unwrap();
    let expected_fee = ((losing as u128) * 200 / 10_000) as u64;
    assert_eq!(fee, expected_fee);
    assert_eq!(payout, 1_000 + (losing - expected_fee));
}

// ---------------------------------------------------------------------------
// Position::payout
// ---------------------------------------------------------------------------

#[test]
fn payout_winning_pool_zero_is_zero() {
    let p = position(1_000, 0);
    assert_eq!(p.payout(SIDE_YES, 0, 5_000_000).unwrap(), 0);
}

#[test]
fn payout_sole_winner_gets_whole_pool() {
    // One winner staked the entire winning pool → gets the whole payout pool.
    let p = position(1_000_000, 0);
    let winning_pool = 1_000_000;
    let payout_pool = 1_980_000;
    assert_eq!(
        p.payout(SIDE_YES, winning_pool, payout_pool).unwrap(),
        payout_pool
    );
}

#[test]
fn payout_pro_rata_split_conserves_pool_modulo_dust() {
    // Three YES winners. winning_pool = 600. payout_pool = 1_000 (after fee on losers).
    let stakes = [100u64, 200u64, 300u64];
    let winning_pool: u64 = stakes.iter().sum(); // 600
    let payout_pool = 1_000u64;

    let mut total = 0u64;
    for s in stakes {
        let p = position(s, 0);
        let out = p.payout(SIDE_YES, winning_pool, payout_pool).unwrap();
        // each winner's payout = floor(stake * payout_pool / winning_pool)
        let expected = ((s as u128) * (payout_pool as u128) / (winning_pool as u128)) as u64;
        assert_eq!(out, expected);
        total += out;
    }
    // Floor division leaves dust (<= number of winners) in escrow; never overpays.
    assert!(total <= payout_pool);
    assert!(payout_pool - total < stakes.len() as u64);
}

#[test]
fn payout_uses_correct_side_stake() {
    let p = position(100, 900);
    // If YES wins, only the yes_amount counts.
    assert_eq!(p.payout(SIDE_YES, 1_000, 1_000).unwrap(), 100);
    // If NO wins, only the no_amount counts.
    assert_eq!(p.payout(SIDE_NO, 1_000, 1_000).unwrap(), 900);
}

#[test]
fn payout_invalid_side_stake_is_zero() {
    let p = position(100, 900);
    // winning_stake for an invalid side is 0, so payout is 0 (no error path here).
    assert_eq!(p.payout(SIDE_NONE, 1_000, 1_000).unwrap(), 0);
}

#[test]
fn payout_near_u64_max_no_panic() {
    // stake * payout_pool overflows u64 but the u128 intermediate keeps it safe;
    // dividing by a large winning_pool brings it back into u64 range.
    let p = position(u64::MAX, 0);
    let winning_pool = u64::MAX;
    let payout_pool = u64::MAX;
    // stake == winning_pool == payout_pool → payout == payout_pool.
    let out = p.payout(SIDE_YES, winning_pool, payout_pool).unwrap();
    assert_eq!(out, payout_pool);
}

#[test]
fn payout_overflow_u64_truncation_returns_err() {
    // Construct a case where stake * payout_pool / winning_pool exceeds u64::MAX so the
    // final `u64::try_from` fails with MathOverflow rather than panicking.
    // stake = u64::MAX, payout_pool = u64::MAX, winning_pool = 1 → result ~ u64::MAX^2 > u64.
    let p = position(u64::MAX, 0);
    let res = p.payout(SIDE_YES, 1, u64::MAX);
    assert!(res.is_err(), "expected MathOverflow, got {res:?}");
}

// ---------------------------------------------------------------------------
// oriented_predicate
// ---------------------------------------------------------------------------

#[test]
fn oriented_yes_is_stored_predicate() {
    let mut m = market(0, 0, DEFAULT_FEE_BPS);
    m.comparison = Comparison::GreaterThan;
    m.threshold = 2;
    assert_eq!(
        m.oriented_predicate(SIDE_YES).unwrap(),
        (Comparison::GreaterThan, 2)
    );

    m.comparison = Comparison::LessThan;
    m.threshold = -5;
    assert_eq!(
        m.oriented_predicate(SIDE_YES).unwrap(),
        (Comparison::LessThan, -5)
    );
}

#[test]
fn oriented_no_of_greater_than_is_less_than_t_plus_1() {
    let mut m = market(0, 0, DEFAULT_FEE_BPS);
    m.comparison = Comparison::GreaterThan;
    m.threshold = 2;
    // NO of (x > 2) is (x <= 2) == (x < 3) == LessThan(3).
    assert_eq!(
        m.oriented_predicate(SIDE_NO).unwrap(),
        (Comparison::LessThan, 3)
    );
}

#[test]
fn oriented_no_of_less_than_is_greater_than_t_minus_1() {
    let mut m = market(0, 0, DEFAULT_FEE_BPS);
    m.comparison = Comparison::LessThan;
    m.threshold = 2;
    // NO of (x < 2) is (x >= 2) == (x > 1) == GreaterThan(1).
    assert_eq!(
        m.oriented_predicate(SIDE_NO).unwrap(),
        (Comparison::GreaterThan, 1)
    );
}

#[test]
fn oriented_invalid_side_errors() {
    let m = market(0, 0, DEFAULT_FEE_BPS);
    assert!(m.oriented_predicate(SIDE_NONE).is_err());
    assert!(m.oriented_predicate(3).is_err());
}

#[test]
fn oriented_no_threshold_overflow_errors() {
    // GreaterThan(i32::MAX): NO would be LessThan(i32::MAX + 1) → checked_add overflows → Err.
    let mut m = market(0, 0, DEFAULT_FEE_BPS);
    m.comparison = Comparison::GreaterThan;
    m.threshold = i32::MAX;
    assert!(m.oriented_predicate(SIDE_NO).is_err());

    // LessThan(i32::MIN): NO would be GreaterThan(i32::MIN - 1) → checked_sub underflows → Err.
    m.comparison = Comparison::LessThan;
    m.threshold = i32::MIN;
    assert!(m.oriented_predicate(SIDE_NO).is_err());
}

/// Evaluate whether a concrete observed value `v` satisfies an oriented `(cmp, threshold)`.
fn predicate_holds(cmp: Comparison, threshold: i32, v: i64) -> bool {
    match cmp {
        Comparison::GreaterThan => v > threshold as i64,
        Comparison::LessThan => v < threshold as i64,
    }
}

#[test]
fn oriented_exactly_one_side_holds_property() {
    // For many thresholds, comparisons, and observed values, EXACTLY ONE of YES/NO holds.
    // This is the core safety property: the two oriented predicates partition the integer line.
    let thresholds = [-3i32, -1, 0, 1, 2, 5, 100];
    let values: Vec<i64> = (-10..=10).collect();
    for cmp in [Comparison::GreaterThan, Comparison::LessThan] {
        for &t in &thresholds {
            let mut m = market(0, 0, DEFAULT_FEE_BPS);
            m.comparison = cmp;
            m.threshold = t;
            let (yes_cmp, yes_t) = m.oriented_predicate(SIDE_YES).unwrap();
            let (no_cmp, no_t) = m.oriented_predicate(SIDE_NO).unwrap();
            for &v in &values {
                let yes = predicate_holds(yes_cmp, yes_t, v);
                let no = predicate_holds(no_cmp, no_t, v);
                assert!(
                    yes ^ no,
                    "exactly one of YES/NO must hold: cmp={cmp:?} t={t} v={v} yes={yes} no={no}"
                );
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Full economic identity: winners' payouts + fee == total pool (modulo dust)
// ---------------------------------------------------------------------------

#[test]
fn full_identity_payouts_plus_fee_equals_total_pool() {
    // Several winners on YES, several losers on NO. Sum of winner payouts + fee should
    // equal the total pool (yes + no) minus integer-division dust left in escrow.
    let yes_stakes = [123_456u64, 1_000_000, 7, 555_555];
    let no_stakes = [2_000_000u64, 999_999, 1];
    let yes_pool: u64 = yes_stakes.iter().sum();
    let no_pool: u64 = no_stakes.iter().sum();
    let total = yes_pool + no_pool;

    let m = market(yes_pool, no_pool, DEFAULT_FEE_BPS);
    let (fee, payout_pool) = m.settlement_split(SIDE_YES).unwrap();
    // payout_pool == yes_pool + (no_pool - fee), and total == payout_pool + fee.
    assert_eq!(payout_pool + fee, total);

    // Sum every YES winner's pro-rata payout.
    let mut paid = 0u64;
    for s in yes_stakes {
        let p = position(s, 0);
        paid += p.payout(SIDE_YES, yes_pool, payout_pool).unwrap();
    }
    // paid <= payout_pool, with the gap being floor-division dust (< number of winners).
    let dust = payout_pool - paid;
    assert!(dust < yes_stakes.len() as u64, "dust {dust} too large");

    // Therefore: paid + fee + dust == total.
    assert_eq!(paid + fee + dust, total);
}

#[test]
fn full_identity_no_side_wins() {
    let yes_stakes = [10_000u64, 30_000, 60_000];
    let no_stakes = [40_000u64, 40_000, 20_000];
    let yes_pool: u64 = yes_stakes.iter().sum(); // losers
    let no_pool: u64 = no_stakes.iter().sum(); // winners
    let total = yes_pool + no_pool;

    let m = market(yes_pool, no_pool, DEFAULT_FEE_BPS);
    let (fee, payout_pool) = m.settlement_split(SIDE_NO).unwrap();
    assert_eq!(payout_pool + fee, total);

    let mut paid = 0u64;
    for s in no_stakes {
        let p = position(0, s);
        paid += p.payout(SIDE_NO, no_pool, payout_pool).unwrap();
    }
    let dust = payout_pool - paid;
    assert!(dust < no_stakes.len() as u64);
    assert_eq!(paid + fee + dust, total);
}

// ---------------------------------------------------------------------------
// winning_pool / losing_pool helpers
// ---------------------------------------------------------------------------

#[test]
fn winning_losing_pool_selectors() {
    let mut m = market(300, 700, DEFAULT_FEE_BPS);
    m.winning_side = SIDE_YES;
    assert_eq!(m.winning_pool(), 300);
    assert_eq!(m.losing_pool(), 700);

    m.winning_side = SIDE_NO;
    assert_eq!(m.winning_pool(), 700);
    assert_eq!(m.losing_pool(), 300);

    m.winning_side = SIDE_NONE;
    assert_eq!(m.winning_pool(), 0);
    assert_eq!(m.losing_pool(), 0);
}

#[test]
fn winning_stake_selectors() {
    let p = position(11, 22);
    assert_eq!(p.winning_stake(SIDE_YES), 11);
    assert_eq!(p.winning_stake(SIDE_NO), 22);
    assert_eq!(p.winning_stake(SIDE_NONE), 0);
}
