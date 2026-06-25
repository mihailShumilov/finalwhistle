use anchor_lang::prelude::*;

#[error_code]
pub enum FinalWhistleError {
    #[msg("Fee basis points exceed the protocol maximum")]
    FeeTooHigh,
    #[msg("Betting close timestamp must be in the future")]
    CloseInPast,
    #[msg("A two-stat market requires both a second stat key and a binary operator")]
    InconsistentTwoStat,
    #[msg("Stake amount is below the minimum")]
    StakeTooSmall,
    #[msg("Betting is closed for this market")]
    MarketClosed,
    #[msg("Market is not open")]
    MarketNotOpen,
    #[msg("Market has already been resolved or voided")]
    MarketAlreadyFinalized,
    #[msg("Market is not resolved yet")]
    MarketNotResolved,
    #[msg("Market was voided; use the void-refund path")]
    MarketVoided,
    #[msg("Market is not voided")]
    MarketNotVoided,
    #[msg("Provided side is invalid (must be YES or NO)")]
    InvalidSide,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("The proof timestamp does not fall on the market's settlement epoch day")]
    EpochDayMismatch,
    #[msg("The proven fixture does not match the market's fixture")]
    FixtureMismatch,
    #[msg("The proven stat key does not match the market's predicate")]
    StatKeyMismatch,
    #[msg("The proven stat period does not match the market's predicate")]
    PeriodMismatch,
    #[msg("Settlement may only run after the betting close timestamp")]
    SettleBeforeClose,
    #[msg("The TxLINE daily-scores-roots account is not owned by the configured oracle program")]
    InvalidOracleAccount,
    #[msg("The supplied oracle program does not match the configured TxLINE program id")]
    InvalidOracleProgram,
    #[msg("Caller has no winnings to claim on this market")]
    NothingToClaim,
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
    #[msg("Position does not belong to this market")]
    PositionMarketMismatch,
    #[msg("Equality comparisons are not supported for two-sided settlement")]
    EqualityNotSupported,
    #[msg("Settlement has not waited for Solana finality")]
    FinalityNotReached,
}
