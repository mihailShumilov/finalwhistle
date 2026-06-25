# FinalWhistle ⚽️🔔

> **Settled at the final whistle, proven on-chain, never voted on.**

FinalWhistle is a **permissionless parametric prop-bet protocol on Solana** whose markets are
cryptographic predicates that **self-settle** the moment a [TxLINE](https://txline-docs.txodds.com)
Merkle proof is verified on-chain — no oracle vote, no dispute window, no operator.

A market is a predicate over one or two TxLINE score stats, e.g. `P1 Corners > 10` or
`P1 Goals − P2 Goals ≥ 2`. Settlement is a **CPI into TxLINE `validate_stat`**: a valid proof
routes USDC to winners atomically; a tampered proof reverts. Every payout ships a
**Verifiable Settlement Receipt** anyone can re-check in the browser.

### Live on devnet ✅

- **FinalWhistle program:** [`GSud9smJwwV6QhDLd2hmSQPShj1w8zYumz5BL3snbmao`](https://explorer.solana.com/address/GSud9smJwwV6QhDLd2hmSQPShj1w8zYumz5BL3snbmao?cluster=devnet)
  (settles via CPI into TxLINE devnet `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`).
- **Proven end-to-end on devnet:** the Phase-1 spike landed real single- and two-stat
  `validate_stat` transactions and confirmed tampered proofs revert; the full lifecycle
  (`create → place → settle(CPI) → claim`) lands and pays out exactly. Reproduce with
  `pnpm --filter @finalwhistle/tests lifecycle`.
- **Tests:** 58 Rust (Mollusk/LiteSVM) + 22 TS (incl. the live golden vector) + a 5/5
  `solana-resilience-kit` fault-harness reliability suite — all green.

| | |
|---|---|
| **Why** | Polymarket/UMA settle by whale-gameable token vote (the $237M Zelensky market); Kalshi/Drift/SX settle by a conflicted operator. For **objective sports stats**, FinalWhistle settles by deterministic cryptographic proof — undisputable. |
| **Collateral** | **USDC only.** The TxL token is never used for wagering (track rule). |
| **Markets** | Objective & score-based (totals, spreads, goal-difference, corners) — CFTC-friendly. |
| **Data** | TxLINE is the sole settlement source; every market + settlement carries a Merkle proof. |

## Architecture

```
TxLINE SSE (scores, free World Cup tier)
        │  live odds / implied probability
        ▼
  apps/web (Next.js 16 + wallet-adapter + solana-resilience-kit)
        │  create market · stake USDC · trigger settle · verify receipt
        ▼
  programs/finalwhistle (Anchor)         packages/sdk (@solana/kit)
   ├─ create_market(predicate)  → Market PDA + USDC escrow
   ├─ place_position(side,amt)  → locks USDC into the parimutuel pool
   ├─ settle(proof, side)       → CPI ─► TxLINE validate_stat ─► atomic payout
   ├─ claim()                   → winners withdraw pro-rata
   └─ void_market()             → refund postponed/abandoned fixtures
        ▲
  apps/keeper (Cloudflare Worker + Cron)  ── watches SSE for FT, fetches the
        proof, submits settle via solana-resilience-kit's TransactionSender
  apps/api (Hono on Workers + D1/KV)      ── market index, odds cache, proof relay
```

Every Solana RPC read and transaction submission goes through
[`solana-resilience-kit`](https://github.com/mihailShumilov/solana-rpc-sdk) (failover, correct
send/confirm, cluster guard, fee estimation, Jito fallback, OTel) — never raw `@solana/kit`.

## TxLINE endpoints used

- `POST {oracle}/auth/guest/start` — anonymous guest JWT
- on-chain `subscribe(serviceLevelId, weeks)` — free World Cup tier (SL 1 / 12, 0 TxL)
- `POST {oracle}/api/token/activate` — exchange tx signature for an API token
- `GET {api}/api/scores/stat-validation` — **three-stage Merkle proof** (the settlement input)
- `GET {api}/api/scores/snapshot/:fixtureId`, `/api/scores/historical/:fixtureId` — market data
- `GET {api}/api/scores/stream` — SSE scores (live odds + FT detection in the keeper)
- on-chain `validate_stat(...)` — the CPI target that proves a predicate against the daily roots PDA

## Monorepo layout

```
programs/finalwhistle/  Anchor program (Rust) — create/place/settle(CPI)/claim/void
packages/shared/        predicate model, canonicalisation, TxLINE types (no deps)
packages/sdk/           TS SDK (@solana/kit) — build/settle txs, proof fetch
apps/web/               Next.js 16 frontend + Verifiable Settlement Receipt
apps/api/               Hono read API (Workers + D1/KV)
apps/keeper/            Worker + Cron settlement bot (solana-resilience-kit)
tests/                  TxLINE validate_stat spike, golden vectors, integration tests
idl/                    vendored TxLINE (txoracle) IDL + generated FinalWhistle IDL
docs/                   technical doc, TxLINE feedback, demo script, diagrams
```

## Quickstart

```bash
pnpm install
anchor build                       # SBF program + IDL
pnpm -r test                       # shared + golden vectors
pnpm --filter @finalwhistle/tests spike   # land a real validate_stat tx on devnet
docker compose up --build          # full local stack on ports 779x / 189xx
```

Pinned toolchain (see `CLAUDE.md` §3): Anchor 1.0.2 · Agave/Solana CLI 3.1.x · Rust 1.93 ·
Node 24 · pnpm 11 · `@solana/kit` 6.10 · Next.js 16.2 · Tailwind 4.3 · Hono 4.12.

## Deploy (Cloudflare Workers, primary)

```bash
anchor deploy --provider.cluster devnet          # program (already live; see DEVNET.md)
pnpm --filter @finalwhistle/api deploy            # read API (wrangler)
pnpm --filter @finalwhistle/keeper deploy         # settlement keeper + Cron
pnpm --filter @finalwhistle/web deploy            # frontend
```

The edge apps are deploy-ready; publishing them to public URLs needs a Cloudflare account
(`wrangler login`) + secrets (`wrangler secret put KEEPER_SECRET_KEY|TXLINE_JWT|TXLINE_API_TOKEN`).
A Hetzner + Docker Compose + Caddy path is the documented fallback.

## Documentation

- [`docs/TECHNICAL.md`](./docs/TECHNICAL.md) — core idea, settlement flow, `validate_stat` CPI, security model, **TxLINE endpoints used**
- [`docs/TXLINE_FEEDBACK.md`](./docs/TXLINE_FEEDBACK.md) — API integration feedback (what we liked + friction)
- [`docs/RESILIENCE_KIT_FINDINGS.md`](./docs/RESILIENCE_KIT_FINDINGS.md) — `solana-resilience-kit` battle-testing log + reliability results
- [`docs/diagrams.md`](./docs/diagrams.md) — architecture, settlement-sequence, oracle-comparison
- [`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md) — ≤5-minute demo walkthrough
- [`docs/COMPLIANCE.md`](./docs/COMPLIANCE.md) — §10 hackathon checklist (status)
- [`DEVNET.md`](./DEVNET.md) — deployed addresses + explorer links

## License

[MIT](./LICENSE).
