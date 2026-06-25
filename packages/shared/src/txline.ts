/**
 * TxLINE off-chain API response shapes and helpers. These mirror the OpenAPI
 * `ScoresStatValidation` schema (`GET /api/scores/stat-validation`) and the on-chain
 * Merkle hierarchy. Hashes are hex strings (`0x…` or bare 32-byte hex) as returned by the
 * API; the SDK converts them to `[u8; 32]` byte arrays for the on-chain call.
 */

/**
 * A 32-byte hash as returned by the TxLINE API. The OpenAPI schema documents these as
 * `format: binary` (hex string), but the devnet endpoint returns them as raw byte arrays
 * (`number[32]`). We accept both shapes everywhere.
 */
export type Hash = string | number[];

export interface ProofNode {
  hash: Hash;
  isRightSibling: boolean;
}

export interface ScoreStat {
  key: number;
  value: number;
  period: number;
}

export interface ScoresUpdateStats {
  updateCount: number;
  minTimestamp: number;
  maxTimestamp: number;
}

export interface ScoresBatchSummary {
  fixtureId: number;
  updateStats: ScoresUpdateStats;
  eventStatsSubTreeRoot: Hash;
}

/** Full `GET /api/scores/stat-validation` response (single- or two-stat). */
export interface ScoresStatValidation {
  ts: number;
  statToProve: ScoreStat;
  eventStatRoot: Hash;
  summary: ScoresBatchSummary;
  statProof: ProofNode[];
  subTreeProof: ProofNode[];
  mainTreeProof: ProofNode[];
  /** Present only when `statKey2` was requested. */
  statToProve2?: ScoreStat;
  statProof2?: ProofNode[];
}

/** Soccer score game-states (status id → name). FT-equivalent states end a fixture. */
export const SOCCER_GAME_STATES: Record<number, string> = {
  1: "NS",
  2: "H1",
  3: "HT",
  4: "H2",
  5: "F",
  6: "WET",
  7: "ET1",
  8: "HTET",
  9: "ET2",
  10: "FET",
  11: "WPE",
  12: "PE",
  13: "FPE",
  14: "I",
  15: "A",
  16: "C",
  17: "TXCC",
  18: "TXCS",
  19: "P",
};

/** Game-state ids that mean the fixture has finished and is settle-eligible. */
export const FINISHED_GAME_STATES = new Set([5, 10, 13]); // F, FET, FPE

/** Game-state ids that should void a market (postponed / abandoned / cancelled). */
export const VOID_GAME_STATES = new Set([14, 15, 16, 17, 19]); // I, A, C, TXCC, P

/**
 * Soccer base stat keys. Period is encoded into the key as `period*1000 + base`
 * (H1 +1000, H2 +2000, ET1 +3000, ET2 +4000, PE +5000); the bare key is the full-match
 * total.
 */
export const SOCCER_STAT_KEYS = {
  P1_GOALS: 1,
  P2_GOALS: 2,
  P1_YELLOW_CARDS: 3,
  P2_YELLOW_CARDS: 4,
  P1_RED_CARDS: 5,
  P2_RED_CARDS: 6,
  P1_CORNERS: 7,
  P2_CORNERS: 8,
} as const;

export const SOCCER_STAT_LABELS: Record<number, string> = {
  1: "P1 Goals",
  2: "P2 Goals",
  3: "P1 Yellow Cards",
  4: "P2 Yellow Cards",
  5: "P1 Red Cards",
  6: "P2 Red Cards",
  7: "P1 Corners",
  8: "P2 Corners",
};

export function statLabel(key: number): string {
  return SOCCER_STAT_LABELS[key] ?? `stat#${key}`;
}

/** TxLINE epoch day for a millisecond timestamp (used to derive the daily-roots PDA). */
export function epochDayFromMs(tsMillis: number): number {
  return Math.floor(tsMillis / (24 * 60 * 60 * 1000));
}

/**
 * Normalise an API hash to a 32-byte array for the on-chain ProofNode. Accepts either a raw
 * byte array (devnet shape) or a hex string (OpenAPI `binary` shape, with optional `0x`).
 */
export function hashToBytes(hash: Hash): number[] {
  if (Array.isArray(hash)) {
    if (hash.length !== 32) {
      throw new Error(`Expected a 32-byte hash array, got ${hash.length} bytes`);
    }
    return hash;
  }
  const clean = hash.startsWith("0x") ? hash.slice(2) : hash;
  if (clean.length !== 64) {
    throw new Error(`Expected 32-byte hex hash, got ${clean.length / 2} bytes: ${hash}`);
  }
  const out: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    out.push(Number.parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
}
