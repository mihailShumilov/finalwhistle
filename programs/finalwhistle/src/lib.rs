//! FinalWhistle — a permissionless parametric prop-bet protocol on Solana.
//!
//! A market is an immutable cryptographic predicate over one or two TxLINE score stats.
//! It self-settles when the predicate is proven against TxLINE's on-chain Merkle root via
//! a CPI into `validate_stat` — no oracle vote, no dispute window, no operator. Collateral
//! is USDC only; the TxL token is never used for wagering (track rule).

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("GSud9smJwwV6QhDLd2hmSQPShj1w8zYumz5BL3snbmao");

#[program]
pub mod finalwhistle {
    use super::*;

    /// Permissionlessly create a market from an immutable predicate and open a USDC escrow.
    pub fn create_market(
        ctx: Context<CreateMarket>,
        nonce: u64,
        params: CreateMarketParams,
    ) -> Result<()> {
        instructions::create_market::create_market_handler(ctx, nonce, params)
    }

    /// Stake USDC on the YES or NO side of an open market.
    pub fn place_position(ctx: Context<PlacePosition>, side: u8, amount: u64) -> Result<()> {
        instructions::place_position::place_position_handler(ctx, side, amount)
    }

    /// Withdraw winnings (resolved market) or a full refund (voided market).
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim::claim_handler(ctx)
    }

    /// Void an open market (postponed / abandoned fixture) so bettors can refund.
    pub fn void_market(ctx: Context<VoidMarket>) -> Result<()> {
        instructions::void::void_handler(ctx)
    }
}
