use anchor_lang::prelude::*;

use crate::constants::{BPS_DENOMINATOR, SIDE_NO, SIDE_YES};
use crate::error::FinalWhistleError;

/// The comparison half of a market predicate. Mirrors TxLINE's `Comparison`, but
/// FinalWhistle deliberately omits `EqualTo`: a two-sided parimutuel market needs a
/// negatable predicate so the losing side can also be proven on-chain, and `!=` is not
/// expressible as a single comparison. `GreaterThan` / `LessThan` cover totals, spreads,
/// goal-difference and corner markets — the compelling, CFTC-friendly cases.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Comparison {
    GreaterThan,
    LessThan,
}

/// The binary operator applied between two stats in a two-stat market
/// (`statA op statB <cmp> threshold`). Mirrors TxLINE's `BinaryExpression`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum BinaryOp {
    Add,
    Subtract,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum MarketStatus {
    Open,
    Resolved,
    Voided,
}

/// A FinalWhistle market: an immutable cryptographic predicate over one or two TxLINE
/// score stats, plus a parimutuel YES/NO USDC pool that self-settles when the predicate
/// is proven against the on-chain Merkle root.
#[account]
#[derive(InitSpace)]
pub struct Market {
    /// Creator / fee-config authority. Markets are permissionless; this is informational.
    pub authority: Pubkey,
    /// USDC mint used for all collateral in this market.
    pub usdc_mint: Pubkey,
    /// The PDA token account holding escrowed USDC.
    pub escrow: Pubkey,
    /// Creator-chosen nonce making `(authority, nonce)` a unique market address.
    pub nonce: u64,

    // ---- Immutable predicate (the "market is a predicate" core) ----
    /// TxLINE fixture id the predicate is evaluated against.
    pub fixture_id: i64,
    /// Score-event sequence number within the fixture.
    pub seq: u32,
    /// Primary stat key (e.g. 1 = Participant1_Score).
    pub stat_key: u32,
    /// Optional second stat key for two-stat predicates.
    pub stat_key2: Option<u32>,
    /// Optional binary operator combining the two stats.
    pub op: Option<BinaryOp>,
    /// Period the stat(s) are measured at (validated against the proof).
    pub period: i32,
    /// Predicate threshold. YES holds iff `(statA [op statB]) <comparison> threshold`.
    pub threshold: i32,
    /// YES-side comparison.
    pub comparison: Comparison,

    // ---- Market lifecycle ----
    /// Unix timestamp after which betting closes and settlement is allowed.
    pub close_ts: i64,
    /// Total USDC staked on YES.
    pub yes_pool: u64,
    /// Total USDC staked on NO.
    pub no_pool: u64,
    /// Protocol fee (basis points) taken from the losing pool at settlement.
    pub fee_bps: u16,
    pub status: MarketStatus,
    /// Winning side once resolved (`SIDE_YES` / `SIDE_NO`); `SIDE_NONE` otherwise.
    pub winning_side: u8,
    /// Proof timestamp recorded at settlement.
    pub settle_ts: i64,
    /// Solana slot at which settlement landed (finality record).
    pub settle_slot: u64,
    /// Fee transferred to the treasury at settlement.
    pub fee_collected: u64,
    /// Escrow available to winners after the fee: `winning_pool + (losing_pool - fee)`.
    pub total_payout_pool: u64,
    /// Running tally of winnings paid out (for observability / dust accounting).
    pub total_claimed: u64,
    pub bump: u8,
    pub escrow_bump: u8,
    /// Short human-readable label for UIs.
    #[max_len(80)]
    pub title: String,
}

impl Market {
    pub const fn is_two_stat(&self) -> bool {
        self.stat_key2.is_some()
    }

    /// The winning pool given a resolved winning side.
    pub fn winning_pool(&self) -> u64 {
        match self.winning_side {
            SIDE_YES => self.yes_pool,
            SIDE_NO => self.no_pool,
            _ => 0,
        }
    }

    /// The losing pool given a resolved winning side.
    pub fn losing_pool(&self) -> u64 {
        match self.winning_side {
            SIDE_YES => self.no_pool,
            SIDE_NO => self.yes_pool,
            _ => 0,
        }
    }

    /// Compute `(comparison, threshold)` oriented to prove that `side` is the TRUE outcome.
    ///
    /// YES is the stored predicate. NO is its exact integer negation:
    /// - `GreaterThan(T)` ⇒ NO is `x <= T` ⇒ `LessThan(T + 1)`
    /// - `LessThan(T)`    ⇒ NO is `x >= T` ⇒ `GreaterThan(T - 1)`
    ///
    /// Because validate_stat reverts on a false predicate, proving the oriented predicate
    /// for a claimed side is a cryptographic proof that the side actually won.
    pub fn oriented_predicate(&self, side: u8) -> Result<(Comparison, i32)> {
        match side {
            SIDE_YES => Ok((self.comparison, self.threshold)),
            SIDE_NO => match self.comparison {
                Comparison::GreaterThan => {
                    let t = self
                        .threshold
                        .checked_add(1)
                        .ok_or(FinalWhistleError::MathOverflow)?;
                    Ok((Comparison::LessThan, t))
                }
                Comparison::LessThan => {
                    let t = self
                        .threshold
                        .checked_sub(1)
                        .ok_or(FinalWhistleError::MathOverflow)?;
                    Ok((Comparison::GreaterThan, t))
                }
            },
            _ => err!(FinalWhistleError::InvalidSide),
        }
    }

    /// Compute the fee (on the losing pool) and the resulting payout pool for winners.
    /// Returns `(fee, total_payout_pool)`.
    pub fn settlement_split(&self, winning_side: u8) -> Result<(u64, u64)> {
        let (winning_pool, losing_pool) = match winning_side {
            SIDE_YES => (self.yes_pool, self.no_pool),
            SIDE_NO => (self.no_pool, self.yes_pool),
            _ => return err!(FinalWhistleError::InvalidSide),
        };

        // No winners on this side → caller must void instead (handled by settle).
        let fee = (losing_pool as u128)
            .checked_mul(self.fee_bps as u128)
            .ok_or(FinalWhistleError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR as u128)
            .ok_or(FinalWhistleError::MathOverflow)? as u64;

        let net_losing = losing_pool
            .checked_sub(fee)
            .ok_or(FinalWhistleError::MathOverflow)?;
        let payout_pool = winning_pool
            .checked_add(net_losing)
            .ok_or(FinalWhistleError::MathOverflow)?;
        Ok((fee, payout_pool))
    }
}

/// A bettor's stake on a single market.
#[account]
#[derive(InitSpace)]
pub struct Position {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub yes_amount: u64,
    pub no_amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl Position {
    /// The bettor's stake on the resolved winning side.
    pub fn winning_stake(&self, winning_side: u8) -> u64 {
        match winning_side {
            SIDE_YES => self.yes_amount,
            SIDE_NO => self.no_amount,
            _ => 0,
        }
    }

    /// Pro-rata winnings = `winning_stake * total_payout_pool / winning_pool` (u128 math).
    pub fn payout(
        &self,
        winning_side: u8,
        winning_pool: u64,
        total_payout_pool: u64,
    ) -> Result<u64> {
        if winning_pool == 0 {
            return Ok(0);
        }
        let stake = self.winning_stake(winning_side);
        let payout = (stake as u128)
            .checked_mul(total_payout_pool as u128)
            .ok_or(FinalWhistleError::MathOverflow)?
            .checked_div(winning_pool as u128)
            .ok_or(FinalWhistleError::MathOverflow)?;
        u64::try_from(payout).map_err(|_| FinalWhistleError::MathOverflow.into())
    }
}
