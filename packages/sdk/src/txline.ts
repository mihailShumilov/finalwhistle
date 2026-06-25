import { hashToBytes, type ScoreStat, type ScoresStatValidation } from "@finalwhistle/shared";
import BN from "bn.js";
import nacl from "tweetnacl";

/** Bounded retry on transient 5xx / 429 (the devnet edge 503s intermittently). */
async function fetchRetry(url: string | URL, init: RequestInit, label: string, attempts = 5) {
  let last = 0;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      last = res.status;
      if (res.status < 500 && res.status !== 429) {
        throw new Error(`${label} failed: ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      if (i === attempts - 1) throw err;
    }
    await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** i, 8000)));
  }
  throw new Error(`${label} failed after ${attempts} attempts (last ${last})`);
}

export interface TxlineSession {
  jwt: string;
  apiToken: string;
  apiBase: string;
}

/** Anonymous guest JWT (30-day expiry). */
export async function guestAuth(apiBase: string): Promise<string> {
  const res = await fetchRetry(`${apiBase}/auth/guest/start`, { method: "POST" }, "guest auth");
  return ((await res.json()) as { token: string }).token;
}

/** Activate the subscription: sign `txSig:leagues:jwt` and exchange for an API token. */
export async function activate(
  apiBase: string,
  txSig: string,
  leagues: number[],
  jwt: string,
  secretKey: Uint8Array,
): Promise<string> {
  const message = new TextEncoder().encode(`${txSig}:${leagues.join(",")}:${jwt}`);
  const walletSignature = Buffer.from(nacl.sign.detached(message, secretKey)).toString("base64");
  const res = await fetchRetry(
    `${apiBase}/api/token/activate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ txSig, walletSignature, leagues }),
    },
    "activate",
  );
  const text = (await res.text()).trim();
  try {
    return (JSON.parse(text) as { token?: string }).token ?? text;
  } catch {
    return text;
  }
}

function authHeaders(s: TxlineSession): Record<string, string> {
  return { Authorization: `Bearer ${s.jwt}`, "X-Api-Token": s.apiToken };
}

export interface StatValidationQuery {
  fixtureId: number;
  seq: number;
  statKey: number;
  statKey2?: number;
}

/** The three-stage Merkle proof for a single (or two) score stat — the settlement input. */
export async function fetchStatValidation(
  s: TxlineSession,
  q: StatValidationQuery,
): Promise<ScoresStatValidation> {
  const url = new URL("/api/scores/stat-validation", s.apiBase);
  url.searchParams.set("fixtureId", String(q.fixtureId));
  url.searchParams.set("seq", String(q.seq));
  url.searchParams.set("statKey", String(q.statKey));
  if (q.statKey2 !== undefined) url.searchParams.set("statKey2", String(q.statKey2));
  const res = await fetchRetry(url, { headers: authHeaders(s) }, "stat-validation");
  return (await res.json()) as ScoresStatValidation;
}

/** Full historical score-update sequence (start time 6h–2w ago). */
export async function fetchHistorical(s: TxlineSession, fixtureId: number): Promise<unknown[]> {
  const res = await fetchRetry(
    `${s.apiBase}/api/scores/historical/${fixtureId}`,
    { headers: authHeaders(s) },
    "historical",
  );
  return (await res.json()) as unknown[];
}

/** Latest fixtures snapshot (used to discover markets and finished fixtures). */
export async function fetchFixturesSnapshot(s: TxlineSession): Promise<unknown[]> {
  const res = await fetchRetry(
    `${s.apiBase}/api/fixtures/snapshot`,
    { headers: authHeaders(s) },
    "fixtures-snapshot",
  );
  return (await res.json()) as unknown[];
}

type ApiProofNode = { hash: string | number[]; isRightSibling: boolean };
type OnChainProofNode = { hash: number[]; isRightSibling: boolean };

const toProof = (nodes: ApiProofNode[]): OnChainProofNode[] =>
  nodes.map((n) => ({ hash: hashToBytes(n.hash), isRightSibling: n.isRightSibling }));

const toStatTerm = (stat: ScoreStat, eventStatRoot: number[], proof: OnChainProofNode[]) => ({
  statToProve: { key: stat.key, value: stat.value, period: stat.period },
  eventStatRoot,
  statProof: proof,
});

/**
 * Build the `settle` instruction's `proof` argument from a TxLINE stat-validation response.
 * The canonical timestamp is `summary.updateStats.minTimestamp` (matching the on-chain
 * TimestampMismatch check, confirmed by the Phase-1 golden vector).
 */
export function buildSettleProof(v: ScoresStatValidation, opts?: { op?: "add" | "subtract" }) {
  const eventStatRoot = hashToBytes(v.eventStatRoot);
  const statA = toStatTerm(v.statToProve, eventStatRoot, toProof(v.statProof));
  const hasSecond = v.statToProve2 !== undefined && v.statProof2 !== undefined;
  const statB = hasSecond
    ? toStatTerm(
        v.statToProve2 as ScoreStat,
        eventStatRoot,
        toProof(v.statProof2 as ApiProofNode[]),
      )
    : null;
  const op = hasSecond ? (opts?.op === "add" ? { add: {} } : { subtract: {} }) : null;

  return {
    ts: new BN(v.summary.updateStats.minTimestamp),
    fixtureSummary: {
      fixtureId: new BN(v.summary.fixtureId),
      updateStats: {
        updateCount: v.summary.updateStats.updateCount,
        minTimestamp: new BN(v.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(v.summary.updateStats.maxTimestamp),
      },
      eventsSubTreeRoot: hashToBytes(v.summary.eventStatsSubTreeRoot),
    },
    fixtureProof: toProof(v.subTreeProof),
    mainTreeProof: toProof(v.mainTreeProof),
    statA,
    statB,
    op,
  };
}

/** Epoch day for the daily-scores-roots PDA from a stat-validation response. */
export function epochDayForValidation(v: ScoresStatValidation): number {
  return Math.floor(v.summary.updateStats.minTimestamp / (24 * 60 * 60 * 1000));
}
