/**
 * Network-level constants for FinalWhistle. Devnet is the primary target for the
 * hackathon submission; mainnet values are included for completeness.
 */

export type Cluster = "devnet" | "mainnet-beta";

/** FinalWhistle Anchor program id (same address on every cluster). */
export const FINALWHISTLE_PROGRAM_ID = "GSud9smJwwV6QhDLd2hmSQPShj1w8zYumz5BL3snbmao";

/** TxLINE (txoracle) program ids — the CPI target of `settle`. */
export const TXLINE_PROGRAM_ID: Record<Cluster, string> = {
  devnet: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
  "mainnet-beta": "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA",
};

/** TxLINE off-chain API base (request/response + SSE). */
export const TXLINE_API_BASE: Record<Cluster, string> = {
  devnet: "https://txline-dev.txodds.com",
  "mainnet-beta": "https://txline.txodds.com",
};

/** TxLINE auth / activation host. */
export const TXLINE_ORACLE_BASE: Record<Cluster, string> = {
  devnet: "https://oracle-dev.txodds.com",
  "mainnet-beta": "https://oracle.txodds.com",
};

/** TxL utility-token mint (NEVER used as collateral — data-authorisation only). */
export const TXL_MINT: Record<Cluster, string> = {
  devnet: "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG",
  "mainnet-beta": "Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL",
};

/**
 * USDC mint used as collateral. Mainnet USDC is canonical; devnet has no universal USDC,
 * so the protocol accepts a configurable mint and the demo mints its own 6-decimal token.
 * Override via `NEXT_PUBLIC_USDC_MINT` / `USDC_MINT`.
 */
export const USDC_MINT: Record<Cluster, string> = {
  devnet: "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

/** Free World Cup tiers: SL1 = 60s delay, SL12 = real-time. Both charge 0 TxL. */
export const WC_SERVICE_LEVEL_DELAYED = 1;
export const WC_SERVICE_LEVEL_REALTIME = 12;

/** Subscriptions are sold in multiples of 4 weeks. */
export const SUBSCRIPTION_MIN_WEEKS = 4;

/** TxLINE PDA seeds. */
export const TXLINE_DAILY_SCORES_SEED = "daily_scores_roots";

/** FinalWhistle PDA seeds. */
export const MARKET_SEED = "market";
export const ESCROW_SEED = "escrow";
export const POSITION_SEED = "position";
export const TREASURY_SEED = "treasury";

/** USDC has 6 decimals. */
export const USDC_DECIMALS = 6;
