//! Manual CPI into the TxLINE (`txoracle`) `validate_stat` instruction.
//!
//! We vendor only the borsh-compatible argument types and the instruction discriminator
//! from the TxLINE IDL (`idl/txoracle.json`) — there is no published `txoracle` crate to
//! generate Anchor CPI helpers from. The Phase-1 spike proved on devnet that `validate_stat`
//! (1) REVERTS on a tampered/invalid Merkle proof (the settlement security boundary), and
//! (2) on a valid proof, SUCCEEDS regardless of the predicate and writes the predicate result
//! as a 1-byte bool to the transaction return data.
//!
//! So `settle` CPIs with the market's YES predicate and reads the returned bool to decide the
//! winning side. The caller supplies only the proof, never the predicate or the side.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::{get_return_data, invoke};

use crate::error::FinalWhistleError;

/// `validate_stat` Anchor discriminator (from `idl/txoracle.json`).
pub const VALIDATE_STAT_DISCRIMINATOR: [u8; 8] = [107, 197, 232, 90, 191, 136, 105, 185];

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TxProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TxScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TxScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TxScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: TxScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

/// Variant order MUST match the TxLINE IDL `Comparison` enum (GreaterThan, LessThan, EqualTo).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub enum TxComparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TxTraderPredicate {
    pub threshold: i32,
    pub comparison: TxComparison,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TxStatTerm {
    pub stat_to_prove: TxScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<TxProofNode>,
}

/// Variant order MUST match the TxLINE IDL `BinaryExpression` enum (Add, Subtract).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub enum TxBinaryExpression {
    Add,
    Subtract,
}

/// All `validate_stat` arguments, mirroring the IDL arg order exactly.
pub struct ValidateStatArgs {
    pub ts: i64,
    pub fixture_summary: TxScoresBatchSummary,
    pub fixture_proof: Vec<TxProofNode>,
    pub main_tree_proof: Vec<TxProofNode>,
    pub predicate: TxTraderPredicate,
    pub stat_a: TxStatTerm,
    pub stat_b: Option<TxStatTerm>,
    pub op: Option<TxBinaryExpression>,
}

/// CPI into `validate_stat` and return the predicate result.
///
/// On a tampered/invalid proof the CPI reverts and this whole instruction reverts (safe).
/// On a valid proof it returns `Ok(true/false)` decoded from the callee's return data.
pub fn cpi_validate_stat<'info>(
    txline_program: &AccountInfo<'info>,
    daily_scores_roots: &AccountInfo<'info>,
    args: &ValidateStatArgs,
) -> Result<bool> {
    let mut data = Vec::with_capacity(512);
    data.extend_from_slice(&VALIDATE_STAT_DISCRIMINATOR);
    args.ts.serialize(&mut data)?;
    args.fixture_summary.serialize(&mut data)?;
    args.fixture_proof.serialize(&mut data)?;
    args.main_tree_proof.serialize(&mut data)?;
    args.predicate.serialize(&mut data)?;
    args.stat_a.serialize(&mut data)?;
    args.stat_b.serialize(&mut data)?;
    args.op.serialize(&mut data)?;

    let ix = Instruction {
        program_id: *txline_program.key,
        accounts: vec![AccountMeta::new_readonly(*daily_scores_roots.key, false)],
        data,
    };

    // Reverts the caller on a tampered/invalid proof — the settlement security boundary.
    invoke(&ix, &[daily_scores_roots.clone(), txline_program.clone()])?;

    let (ret_program, ret_data) =
        get_return_data().ok_or(error!(FinalWhistleError::OracleNoReturnData))?;
    require_keys_eq!(
        ret_program,
        *txline_program.key,
        FinalWhistleError::InvalidOracleProgram
    );
    // validate_stat returns a borsh bool (1 byte: 0x01 = predicate held).
    Ok(ret_data.first().copied() == Some(1))
}
