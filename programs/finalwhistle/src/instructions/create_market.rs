use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{ESCROW_SEED, MARKET_SEED, MAX_FEE_BPS, SIDE_NONE};
use crate::error::FinalWhistleError;
use crate::state::{BinaryOp, Comparison, Market, MarketStatus};

/// Immutable predicate + market configuration supplied at creation.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CreateMarketParams {
    pub fixture_id: i64,
    pub seq: u32,
    pub stat_key: u32,
    pub stat_key2: Option<u32>,
    pub op: Option<BinaryOp>,
    pub period: i32,
    pub threshold: i32,
    pub comparison: Comparison,
    pub close_ts: i64,
    pub fee_bps: u16,
    pub title: String,
}

#[derive(Accounts)]
#[instruction(nonce: u64, params: CreateMarketParams)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, creator.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = creator,
        seeds = [ESCROW_SEED, market.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = market,
        token::token_program = token_program,
    )]
    pub escrow: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn create_market_handler(
    ctx: Context<CreateMarket>,
    nonce: u64,
    params: CreateMarketParams,
) -> Result<()> {
    require!(params.fee_bps <= MAX_FEE_BPS, FinalWhistleError::FeeTooHigh);
    require!(params.title.len() <= 80, FinalWhistleError::MathOverflow);

    let now = Clock::get()?.unix_timestamp;
    require!(params.close_ts > now, FinalWhistleError::CloseInPast);

    // A two-stat market must supply BOTH a second key and an operator, or neither.
    require!(
        params.stat_key2.is_some() == params.op.is_some(),
        FinalWhistleError::InconsistentTwoStat
    );

    let market = &mut ctx.accounts.market;
    market.authority = ctx.accounts.creator.key();
    market.usdc_mint = ctx.accounts.usdc_mint.key();
    market.escrow = ctx.accounts.escrow.key();
    market.nonce = nonce;

    market.fixture_id = params.fixture_id;
    market.seq = params.seq;
    market.stat_key = params.stat_key;
    market.stat_key2 = params.stat_key2;
    market.op = params.op;
    market.period = params.period;
    market.threshold = params.threshold;
    market.comparison = params.comparison;

    market.close_ts = params.close_ts;
    market.yes_pool = 0;
    market.no_pool = 0;
    market.fee_bps = params.fee_bps;
    market.status = MarketStatus::Open;
    market.winning_side = SIDE_NONE;
    market.settle_ts = 0;
    market.settle_slot = 0;
    market.fee_collected = 0;
    market.total_payout_pool = 0;
    market.total_claimed = 0;
    market.bump = ctx.bumps.market;
    market.escrow_bump = ctx.bumps.escrow;
    market.title = params.title;

    msg!(
        "Market created: fixture={} seq={} stat={} two_stat={} threshold={} close_ts={}",
        market.fixture_id,
        market.seq,
        market.stat_key,
        market.is_two_stat(),
        market.threshold,
        market.close_ts
    );
    Ok(())
}
