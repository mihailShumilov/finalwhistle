import { describePredicate, impliedYesProbability } from "@finalwhistle/sdk";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { buildContext, type KeeperContext, type KeeperEnv } from "./context.js";
import { dueForSettlement, scanMarkets } from "./scan.js";
import { type SettleOutcome, settleMarket } from "./settler.js";

const app = new Hono<{ Bindings: KeeperEnv }>();
app.use("*", cors());

app.get("/", (c) =>
  c.json({
    service: "finalwhistle-keeper",
    routes: ["/health", "/markets", "POST /settle/:market", "POST /run"],
  }),
);

app.get("/health", async (c) => {
  try {
    const ctx = await buildContext(c.env);
    return c.json({ ok: true, cluster: ctx.cluster, keeper: ctx.sender.feePayer.address });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

app.get("/markets", async (c) => {
  const ctx = await buildContext(c.env);
  const markets = await scanMarkets(ctx.pool, ctx.coder);
  return c.json(
    markets.map(({ address, market }) => ({
      address,
      title: market.title,
      predicate: describePredicate({
        fixtureId: market.fixtureId.toNumber(),
        seq: market.seq,
        statKey: market.statKey,
        ...(market.statKey2 !== null ? { statKey2: market.statKey2 } : {}),
        ...(market.op ? { op: "subtract" in market.op ? "subtract" : "add" } : {}),
        period: market.period,
        threshold: market.threshold,
        comparison: "greaterThan" in market.comparison ? "greaterThan" : "lessThan",
      }),
      status: Object.keys(market.status)[0],
      yesPool: market.yesPool.toString(),
      noPool: market.noPool.toString(),
      impliedYes: impliedYesProbability(
        BigInt(market.yesPool.toString()),
        BigInt(market.noPool.toString()),
      ),
      closeTs: market.closeTs.toNumber(),
      winningSide: market.winningSide,
    })),
  );
});

app.post("/settle/:market", async (c) => {
  const ctx = await buildContext(c.env);
  const outcome = await runSettle(ctx, c.req.param("market"));
  return c.json(outcome, outcome.status === "failed" ? 502 : 200);
});

/** Manual trigger for the whole due-market sweep (mirrors the cron path). */
app.post("/run", async (c) => {
  const ctx = await buildContext(c.env);
  const results = await sweep(ctx);
  return c.json({ settled: results });
});

async function runSettle(ctx: KeeperContext, marketAddress: string): Promise<SettleOutcome> {
  const key = `settled:${marketAddress}`;
  if (ctx.settled && (await ctx.settled.get(key))) {
    return { market: marketAddress, status: "skipped", reason: "already settled (KV)" };
  }
  const outcome = await settleMarket(
    {
      pool: ctx.pool,
      sender: ctx.sender,
      program: ctx.program,
      coder: ctx.coder,
      session: ctx.session,
      txlineProgram: ctx.txlineProgram,
    },
    marketAddress,
  );
  if (outcome.status === "settled" && ctx.settled) {
    await ctx.settled.put(key, JSON.stringify({ at: Date.now(), signature: outcome.signature }));
  }
  return outcome;
}

async function sweep(ctx: KeeperContext): Promise<SettleOutcome[]> {
  const markets = await scanMarkets(ctx.pool, ctx.coder);
  const due = dueForSettlement(markets);
  const results: SettleOutcome[] = [];
  for (const m of due) {
    try {
      results.push(await runSettle(ctx, m.address));
    } catch (err) {
      results.push({ market: m.address, status: "failed", reason: String(err) });
    }
  }
  return results;
}

export default {
  fetch: app.fetch,
  /** Cron Trigger (every ~1 min): settle every market whose betting window has closed. */
  async scheduled(_event: unknown, env: KeeperEnv, _ctx: unknown): Promise<void> {
    const ctx = await buildContext(env);
    await sweep(ctx);
  },
};
