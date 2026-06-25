use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::{MARKET_SEED, SIDE_NONE, SIDE_YES, TREASURY_SEED, TXLINE_PROGRAM_ID};
use crate::error::FinalWhistleError;
use crate::oracle::{
    cpi_validate_stat, TxBinaryExpression, TxComparison, TxProofNode, TxScoresBatchSummary,
    TxStatTerm, TxTraderPredicate, ValidateStatArgs,
};
use crate::state::{BinaryOp, Comparison, Market, MarketStatus};

/// The proof payload supplied by the keeper at settlement. Mirrors the TxLINE
/// `stat-validation` response. The predicate is NOT included — `settle` builds it from the
/// immutable market config, so the caller can never bias the outcome.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SettleProof {
    pub ts: i64,
    pub fixture_summary: TxScoresBatchSummary,
    pub fixture_proof: Vec<TxProofNode>,
    pub main_tree_proof: Vec<TxProofNode>,
    pub stat_a: TxStatTerm,
    pub stat_b: Option<TxStatTerm>,
    pub op: Option<TxBinaryExpression>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub settler: Signer<'info>,

    #[account(
        mut,
        has_one = usdc_mint @ FinalWhistleError::FixtureMismatch,
        has_one = escrow @ FinalWhistleError::FixtureMismatch,
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub escrow: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: must be owned by the TxLINE program; `validate_stat` checks it is the correct
    /// `daily_scores_roots` PDA for the proof's epoch day (TimestampMismatch otherwise).
    #[account(owner = txline_program.key() @ FinalWhistleError::InvalidOracleAccount)]
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,

    /// CHECK: pinned to the configured TxLINE program id (the CPI target).
    #[account(address = TXLINE_PROGRAM_ID @ FinalWhistleError::InvalidOracleProgram)]
    pub txline_program: UncheckedAccount<'info>,

    /// CHECK: protocol treasury authority PDA (owns the fee vault).
    #[account(seeds = [TREASURY_SEED], bump)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = settler,
        associated_token::mint = usdc_mint,
        associated_token::authority = treasury,
        associated_token::token_program = token_program,
    )]
    pub treasury_usdc: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn settle_handler(ctx: Context<Settle>, proof: SettleProof) -> Result<()> {
    {
        let market = &ctx.accounts.market;
        require!(
            market.status == MarketStatus::Open,
            FinalWhistleError::MarketNotOpen
        );

        let now = Clock::get()?.unix_timestamp;
        require!(now >= market.close_ts, FinalWhistleError::SettleBeforeClose);

        // Bind the proof's stat metadata to THIS market's immutable predicate, so a valid
        // proof for a different stat/fixture can never settle this market.
        require!(
            proof.stat_a.stat_to_prove.key == market.stat_key,
            FinalWhistleError::StatKeyMismatch
        );
        require!(
            proof.stat_a.stat_to_prove.period == market.period,
            FinalWhistleError::PeriodMismatch
        );
        require!(
            proof.fixture_summary.fixture_id == market.fixture_id,
            FinalWhistleError::FixtureMismatch
        );

        // Two-stat consistency.
        match (market.stat_key2, market.op) {
            (Some(key2), Some(market_op)) => {
                let stat_b = proof
                    .stat_b
                    .as_ref()
                    .ok_or(FinalWhistleError::MissingSecondStat)?;
                require!(
                    stat_b.stat_to_prove.key == key2,
                    FinalWhistleError::StatKeyMismatch
                );
                require!(
                    stat_b.stat_to_prove.period == market.period,
                    FinalWhistleError::PeriodMismatch
                );
                let op = proof.op.ok_or(FinalWhistleError::MissingSecondStat)?;
                let ok = matches!(
                    (market_op, op),
                    (BinaryOp::Add, TxBinaryExpression::Add)
                        | (BinaryOp::Subtract, TxBinaryExpression::Subtract)
                );
                require!(ok, FinalWhistleError::OperatorMismatch);
            }
            _ => {
                require!(
                    proof.stat_b.is_none() && proof.op.is_none(),
                    FinalWhistleError::UnexpectedSecondStat
                );
            }
        }
    }

    // Build the YES predicate from the immutable market config (caller cannot influence it).
    let predicate = TxTraderPredicate {
        threshold: ctx.accounts.market.threshold,
        comparison: match ctx.accounts.market.comparison {
            Comparison::GreaterThan => TxComparison::GreaterThan,
            Comparison::LessThan => TxComparison::LessThan,
        },
    };

    let args = ValidateStatArgs {
        ts: proof.ts,
        fixture_summary: proof.fixture_summary,
        fixture_proof: proof.fixture_proof,
        main_tree_proof: proof.main_tree_proof,
        predicate,
        stat_a: proof.stat_a,
        stat_b: proof.stat_b,
        op: proof.op,
    };

    // CPI → validate_stat. Reverts on a tampered proof; otherwise returns the YES result.
    let yes_holds = cpi_validate_stat(
        &ctx.accounts.txline_program.to_account_info(),
        &ctx.accounts.daily_scores_merkle_roots.to_account_info(),
        &args,
    )?;

    let winning_side = if yes_holds {
        SIDE_YES
    } else {
        crate::constants::SIDE_NO
    };
    let (fee, payout_pool) = ctx.accounts.market.settlement_split(winning_side)?;
    let winning_pool = if winning_side == SIDE_YES {
        ctx.accounts.market.yes_pool
    } else {
        ctx.accounts.market.no_pool
    };

    let clock = Clock::get()?;

    // Nobody backed the winning side → void so every bettor refunds their full stake.
    if winning_pool == 0 {
        let market = &mut ctx.accounts.market;
        market.status = MarketStatus::Voided;
        market.winning_side = SIDE_NONE;
        market.settle_ts = clock.unix_timestamp;
        market.settle_slot = clock.slot;
        msg!(
            "settled → VOID (winning side had no stake); yes_holds={}",
            yes_holds
        );
        return Ok(());
    }

    // Transfer the protocol fee from escrow to the treasury vault (signed by the market PDA).
    if fee > 0 {
        let authority = ctx.accounts.market.authority;
        let nonce = ctx.accounts.market.nonce.to_le_bytes();
        let bump = [ctx.accounts.market.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[MARKET_SEED, authority.as_ref(), &nonce, &bump]];
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.escrow.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.treasury_usdc.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                signer_seeds,
            ),
            fee,
            ctx.accounts.usdc_mint.decimals,
        )?;
    }

    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::Resolved;
    market.winning_side = winning_side;
    market.settle_ts = clock.unix_timestamp;
    market.settle_slot = clock.slot;
    market.fee_collected = fee;
    market.total_payout_pool = payout_pool;

    msg!(
        "settled → side={} yes_holds={} fee={} payout_pool={} slot={}",
        winning_side,
        yes_holds,
        fee,
        payout_pool,
        clock.slot
    );
    Ok(())
}
