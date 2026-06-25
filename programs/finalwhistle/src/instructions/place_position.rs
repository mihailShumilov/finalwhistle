use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::{MIN_STAKE, POSITION_SEED, SIDE_NO, SIDE_YES};
use crate::error::FinalWhistleError;
use crate::state::{Market, MarketStatus, Position};

#[derive(Accounts)]
pub struct PlacePosition<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(
        mut,
        has_one = usdc_mint @ FinalWhistleError::FixtureMismatch,
        has_one = escrow @ FinalWhistleError::FixtureMismatch,
    )]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = bettor,
        space = 8 + Position::INIT_SPACE,
        seeds = [POSITION_SEED, market.key().as_ref(), bettor.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = bettor,
        token::token_program = token_program,
    )]
    pub bettor_usdc: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub escrow: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn place_position_handler(ctx: Context<PlacePosition>, side: u8, amount: u64) -> Result<()> {
    require!(
        ctx.accounts.market.status == MarketStatus::Open,
        FinalWhistleError::MarketNotOpen
    );
    require!(
        side == SIDE_YES || side == SIDE_NO,
        FinalWhistleError::InvalidSide
    );
    require!(amount >= MIN_STAKE, FinalWhistleError::StakeTooSmall);

    let now = Clock::get()?.unix_timestamp;
    require!(
        now < ctx.accounts.market.close_ts,
        FinalWhistleError::MarketClosed
    );

    // Move USDC into escrow before recording the stake (effects after the external CPI is
    // safe here because the transfer either fully succeeds or the whole ix reverts).
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.bettor_usdc.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
                authority: ctx.accounts.bettor.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    let position = &mut ctx.accounts.position;
    // Initialise on first stake (init_if_needed leaves zeroed fields on re-use).
    if position.market == Pubkey::default() {
        position.market = ctx.accounts.market.key();
        position.owner = ctx.accounts.bettor.key();
        position.bump = ctx.bumps.position;
    }
    require_keys_eq!(
        position.market,
        ctx.accounts.market.key(),
        FinalWhistleError::PositionMarketMismatch
    );

    let market = &mut ctx.accounts.market;
    if side == SIDE_YES {
        position.yes_amount = position
            .yes_amount
            .checked_add(amount)
            .ok_or(FinalWhistleError::MathOverflow)?;
        market.yes_pool = market
            .yes_pool
            .checked_add(amount)
            .ok_or(FinalWhistleError::MathOverflow)?;
    } else {
        position.no_amount = position
            .no_amount
            .checked_add(amount)
            .ok_or(FinalWhistleError::MathOverflow)?;
        market.no_pool = market
            .no_pool
            .checked_add(amount)
            .ok_or(FinalWhistleError::MathOverflow)?;
    }

    msg!(
        "Position: side={} amount={} yes_pool={} no_pool={}",
        side,
        amount,
        market.yes_pool,
        market.no_pool
    );
    Ok(())
}
