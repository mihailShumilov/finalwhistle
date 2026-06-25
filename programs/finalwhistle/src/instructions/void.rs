use anchor_lang::prelude::*;

use crate::constants::SIDE_NONE;
use crate::error::FinalWhistleError;
use crate::state::{Market, MarketStatus};

/// Void an open market (postponed / abandoned fixture). Only the market authority may
/// void, and only before resolution; afterwards every bettor refunds their full stake
/// through `claim`. Settlement also voids automatically when the winning pool is empty.
#[derive(Accounts)]
pub struct VoidMarket<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ FinalWhistleError::InvalidSide,
    )]
    pub market: Account<'info, Market>,
}

pub fn void_handler(ctx: Context<VoidMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    require!(
        market.status == MarketStatus::Open,
        FinalWhistleError::MarketAlreadyFinalized
    );

    market.status = MarketStatus::Voided;
    market.winning_side = SIDE_NONE;
    market.settle_ts = Clock::get()?.unix_timestamp;
    market.settle_slot = Clock::get()?.slot;

    msg!("Market voided; bettors may refund full stake via claim");
    Ok(())
}
