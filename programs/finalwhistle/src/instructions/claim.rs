use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::MARKET_SEED;
use crate::error::FinalWhistleError;
use crate::state::{Market, MarketStatus, Position};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub claimant: Signer<'info>,

    #[account(
        mut,
        has_one = usdc_mint @ FinalWhistleError::FixtureMismatch,
        has_one = escrow @ FinalWhistleError::FixtureMismatch,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        has_one = owner @ FinalWhistleError::NothingToClaim,
        constraint = position.market == market.key() @ FinalWhistleError::PositionMarketMismatch,
    )]
    pub position: Account<'info, Position>,

    /// CHECK: matched against `position.owner` via `has_one = owner`.
    pub owner: UncheckedAccount<'info>,

    #[account(mut)]
    pub escrow: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::token_program = token_program,
    )]
    pub claimant_usdc: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn claim_handler(ctx: Context<Claim>) -> Result<()> {
    let market = &ctx.accounts.market;
    require!(
        ctx.accounts.claimant.key() == ctx.accounts.position.owner,
        FinalWhistleError::NothingToClaim
    );
    require!(
        !ctx.accounts.position.claimed,
        FinalWhistleError::AlreadyClaimed
    );

    let payout: u64 = match market.status {
        MarketStatus::Resolved => ctx.accounts.position.payout(
            market.winning_side,
            market.winning_pool(),
            market.total_payout_pool,
        )?,
        MarketStatus::Voided => ctx
            .accounts
            .position
            .yes_amount
            .checked_add(ctx.accounts.position.no_amount)
            .ok_or(FinalWhistleError::MathOverflow)?,
        MarketStatus::Open => return err!(FinalWhistleError::MarketNotResolved),
    };

    require!(payout > 0, FinalWhistleError::NothingToClaim);

    let authority = market.authority;
    let nonce = market.nonce.to_le_bytes();
    let bump = [market.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[MARKET_SEED, authority.as_ref(), &nonce, &bump]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.escrow.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.claimant_usdc.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            signer_seeds,
        ),
        payout,
        ctx.accounts.usdc_mint.decimals,
    )?;

    ctx.accounts.position.claimed = true;
    let market = &mut ctx.accounts.market;
    market.total_claimed = market
        .total_claimed
        .checked_add(payout)
        .ok_or(FinalWhistleError::MathOverflow)?;

    msg!("Claimed {} USDC base units", payout);
    Ok(())
}
