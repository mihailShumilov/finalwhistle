import type * as anchor from "@coral-xyz/anchor";
import {
  createRpcPool,
  describePredicate,
  FINALWHISTLE_IDL,
  FINALWHISTLE_PROGRAM,
  fetchMarket,
  fetchStatValidation,
  impliedYesProbability,
  type MarketSummary,
  makeAccountsCoder,
  scanMarkets,
  summarizeMarket,
  type TxlineSession,
  winningSide,
} from "@finalwhistle/sdk";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ResilientRpcPool } from "solana-resilience-kit";

interface ApiEnv {
  CLUSTER?: string;
  RPC_PRIMARY?: string;
  RPC_BACKUP?: string;
  TXLINE_PROGRAM_ID?: string;
  TXLINE_API_BASE?: string;
  TXLINE_JWT?: string;
  TXLINE_API_TOKEN?: string;
  WEB_ORIGIN?: string;
  SETTLED?: { get(k: string): Promise<string | null> };
}

interface ReadContext {
  cluster: string;
  pool: ResilientRpcPool;
  coder: anchor.BorshAccountsCoder;
  session: TxlineSession;
  env: ApiEnv;
}

function buildContext(env: ApiEnv): ReadContext {
  const cluster = env.CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet";
  const endpoints = [env.RPC_PRIMARY, env.RPC_BACKUP].filter((u): u is string => Boolean(u));
  if (endpoints.length === 0) endpoints.push("https://api.devnet.solana.com");
  const pool = createRpcPool({ endpoints });
  const coder = makeAccountsCoder(FINALWHISTLE_IDL as anchor.Idl);
  const apiBase =
    env.TXLINE_API_BASE ??
    (cluster === "mainnet-beta" ? "https://txline.txodds.com" : "https://txline-dev.txodds.com");
  const session: TxlineSession = {
    jwt: env.TXLINE_JWT ?? "",
    apiToken: env.TXLINE_API_TOKEN ?? "",
    apiBase,
  };
  return { cluster, pool, coder, session, env };
}

const predicateOf = (m: MarketSummary) =>
  describePredicate({
    fixtureId: m.fixtureId,
    seq: m.seq,
    statKey: m.statKey,
    ...(m.statKey2 !== null ? { statKey2: m.statKey2 } : {}),
    ...(m.op ? { op: m.op } : {}),
    period: m.period,
    threshold: m.threshold,
    comparison: m.comparison,
  });

const withOdds = (m: MarketSummary) => ({
  ...m,
  predicate: predicateOf(m),
  impliedYes: impliedYesProbability(BigInt(m.yesPool), BigInt(m.noPool)),
});

const app = new Hono<{ Bindings: ApiEnv }>();
app.use("*", (c, next) => cors({ origin: c.env.WEB_ORIGIN ?? "*" })(c, next));

app.get("/", (c) =>
  c.json({
    service: "finalwhistle-api",
    routes: ["/health", "/markets", "/markets/:address", "/receipt/:address"],
  }),
);

app.get("/health", (c) => {
  const ctx = buildContext(c.env);
  return c.json({ ok: true, cluster: ctx.cluster, program: FINALWHISTLE_PROGRAM.toBase58() });
});

app.get("/markets", async (c) => {
  const ctx = buildContext(c.env);
  const markets = await scanMarkets(ctx.pool.rpc(), ctx.coder, FINALWHISTLE_PROGRAM.toBase58());
  return c.json(markets.map(({ address, market }) => withOdds(summarizeMarket(address, market))));
});

app.get("/markets/:address", async (c) => {
  const ctx = buildContext(c.env);
  const market = await fetchMarket(ctx.pool.rpc(), ctx.coder, c.req.param("address"));
  if (!market) return c.json({ error: "not found" }, 404);
  return c.json(withOdds(summarizeMarket(c.req.param("address"), market)));
});

/**
 * Verifiable Settlement Receipt data: the market summary, the recorded outcome, and the
 * re-fetched TxLINE proof so the client can independently re-verify (re-derive the daily-roots
 * PDA + re-run validate_stat). The settle signature comes from the keeper's KV, if present.
 */
app.get("/receipt/:address", async (c) => {
  const ctx = buildContext(c.env);
  const address = c.req.param("address");
  const market = await fetchMarket(ctx.pool.rpc(), ctx.coder, address);
  if (!market) return c.json({ error: "not found" }, 404);
  const summary = withOdds(summarizeMarket(address, market));

  let proof = null;
  let provenValue: number | null = null;
  let provenSide: "YES" | "NO" | null = null;
  if (summary.status === "resolved" && ctx.session.apiToken) {
    try {
      const validation = await fetchStatValidation(ctx.session, {
        fixtureId: summary.fixtureId,
        seq: summary.seq,
        statKey: summary.statKey,
        ...(summary.statKey2 !== null ? { statKey2: summary.statKey2 } : {}),
      });
      proof = validation;
      const a = validation.statToProve.value;
      const b = validation.statToProve2?.value;
      provenValue =
        summary.op === "subtract" ? a - (b ?? 0) : summary.op === "add" ? a + (b ?? 0) : a;
      provenSide = winningSide(
        {
          fixtureId: summary.fixtureId,
          seq: summary.seq,
          statKey: summary.statKey,
          ...(summary.statKey2 !== null ? { statKey2: summary.statKey2 } : {}),
          ...(summary.op ? { op: summary.op } : {}),
          period: summary.period,
          threshold: summary.threshold,
          comparison: summary.comparison,
        },
        a,
        b,
      );
    } catch {
      /* proof temporarily unavailable */
    }
  }

  const settledRaw = ctx.env.SETTLED ? await ctx.env.SETTLED.get(`settled:${address}`) : null;
  const settleSignature = settledRaw
    ? (JSON.parse(settledRaw) as { signature?: string }).signature
    : null;

  return c.json({
    market: summary,
    outcome: {
      winningSide: summary.winningSide,
      provenValue,
      provenSide,
      settleSlot: summary.settleSlot,
      settleTs: summary.settleTs,
      settleSignature,
    },
    proof,
  });
});

export default { fetch: app.fetch };
