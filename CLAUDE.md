# FinalWhistle — Autonomous Build Guide for Claude Code

> **What this file is.** A complete, self-contained operating manual for building **FinalWhistle** end-to-end in autonomous mode. Copy this file to the repo root as `CLAUDE.md` so Claude Code loads it every session. It defines the product, the rules, the exact stack versions, the phase-by-phase build with commands + acceptance gates, Dockerization, deployment (Cloudflare Workers primary / Hetzner fallback), documentation, and the hackathon compliance checklist.
>
> **Source documents (full paths — read these first each session):**
> - Strategy / market / competitor / product rationale: `/Users/mihailshumilov/Claude/Projects/Prediction Markets and Settlement/01_STRATEGY_market_competitors_product.md`
> - This build guide: `/Users/mihailshumilov/Claude/Projects/Prediction Markets and Settlement/02_FINALWHISTLE_BUILD_GUIDE.md`
>
> **Read order each session:** this build guide → the strategy doc (path above) → the current open task in the task board → the TxLINE docs (`https://txline-docs.txodds.com/llms.txt`).

---

## 0. Product in one screen

**FinalWhistle** = a permissionless **parametric prop-bet protocol on Solana** whose markets are cryptographic predicates that **self-settle** the moment a TxLINE Merkle proof is verified on-chain — no oracle vote, no dispute window, no operator.

- **Slogan:** *Settled at the final whistle, proven on-chain, never voted on.*
- **Core mechanic:** a market is a `TraderPredicate` (`{threshold, comparison}`) over a score stat, optionally a two-stat `BinaryOperation` (e.g. `Home_goals − Away_goals ≥ 2`, `Total_corners > 10`). Settlement = CPI into TxLINE `validate_stat`; valid proof → atomic USDC payout; invalid proof → revert.
- **Differentiator vs everyone:** Polymarket/UMA settle by whale-gameable token vote (the $237M Zelensky case); Kalshi/Drift/SX settle by a conflicted operator. We settle by **deterministic cryptographic proof** — impossible for objective sports stats to be disputed.
- **Demo climax:** split-screen — a multi-day whale-voted Polymarket dispute vs FinalWhistle settling the same class of market in **one transaction**, with a **Verifiable Settlement Receipt** anyone can re-verify in the browser.

### Hard product constraints (from the track rules — never violate)
1. **Collateral is USDC, never TxL.** The TxL token is locked to data-authorization; using it for wagering/escrow/P2P transfer disqualifies us.
2. **Markets must be objective & score-based** (win/draw/loss, totals, advancement, corners, goal diff). Avoid injury / referee-decision / discrete in-game props (CFTC-banned classes).
3. **TxLINE must be the primary data source.** Every market and every settlement traces to a TxLINE feed + Merkle proof.
4. **Submission must be a working build**, deployed (mainnet or devnet), with demo video + public repo + working link + tech doc + API-feedback note. No concept/wireframe-only.

---

## 1. Operating rules for Claude Code (autonomy contract)

**Work loop.** Always: pick the lowest-ID unblocked task → mark `in_progress` → implement → run the task's **acceptance gate** → only mark `completed` when the gate passes → commit → next task. Never mark a task done with failing tests/build.

**Determinism is sacred (the #1 source of bugs here).**
- The hash/canonicalisation our `settle` path assumes **must match TxLINE byte-for-byte**. Before writing any settlement logic, run the Phase-1 spike and capture a **golden vector** (`given this fixture+seq+statKey → this proof → validate_stat returns OK`). Encode it as a committed test. Re-run it in CI. This mirrors the discipline in the in-house `attestation-oracle` skill (shared commitment module + golden-vector test).
- Never silently change a hash function, field order, or encoding. If the proof format is unclear, re-read the TxLINE example (`examples/validation/validate_scores_onchain.ts`) and the `tx-on-chain` IDL rather than guessing.

**Latest-versions policy.** Use the pinned versions in §3. They were verified for June 2026. Before locking, run the **version-refresh command** (§3) to bump each to its latest patch, then pin exact versions in lockfiles. Never use a deprecated package: `@solana/web3.js` v1 is legacy → use **`@solana/kit`**; `solana-bankrun` is legacy → use **LiteSVM**; the validator is **Agave** (Anza), CLI still `solana`.

**Code quality (non-negotiable).**
- TypeScript `strict: true`, no `any` (use `unknown` + narrowing), no unused exports, ESLint + Prettier clean, Biome optional but if used it's the single formatter.
- Rust: `#![deny(warnings)]` in CI, `cargo clippy -- -D warnings`, `cargo fmt --check`. No `unwrap()`/`expect()` in on-chain code paths — return typed `Err(ErrorCode::…)`. Checked arithmetic only (`checked_add`, `checked_mul`) — overflow on money = critical bug.
- Every Solana instruction validates: account ownership, signer, PDA seeds/bump, mint, and amounts. Reentrancy-safe ordering (effects before external CPI where applicable).
- Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). Small, atomic commits. No secrets in git — ever.
- Public functions documented; non-obvious logic commented with *why*, not *what*.
- Wait for **both** the TxLINE proof and **Solana finality** before releasing escrow (reorg/double-payout guard).

**When blocked:** write one sentence in the task, create a follow-up task describing the blocker, move on. Don't fabricate API shapes — verify against docs/IDL.

---

## 2. Skills, agents & commands to install / use

This project is built with Claude Code + the Cowork skill/agent set already available. Use them as follows.

**Skills (invoke when relevant):**
- `attestation-oracle` — trust mechanics, commitment/golden-vector discipline; read before writing `settle` ↔ `validate_stat`.
- `diagram-creation` — architecture diagram, settlement sequence diagram, oracle-comparison diagram (for README + deck).
- `pptx` — final pitch/interview deck.
- `docx` / markdown — the "Brief Technical Documentation" + API-feedback deliverable.
- `schedule` — optional daily sprint-checklist nudge.

**Agents (spawn for parallel/independent work):**
- A **program agent** (Anchor/Rust) and a **frontend agent** (Next.js) and a **keeper/API agent** (Workers/Hono) can run in parallel once interfaces are frozen (after Phase 2 defines the IDL).
- A **verification agent** (read-only) to fact-check the submission and run a security pass before deadline.
- Use `claude-code-guide` agent for any Claude Code / Agent SDK / config questions.

**MCP / connectors available this session** (use opportunistically): a docs MCP (`resolve-library-id` → `query-docs`) for fetching current library docs — prefer it over guessing API syntax for Anchor, `@solana/kit`, Hono, Next.js, wrangler.

**Recommended Claude Code project setup (commit to repo):**
```
.claude/
  settings.json          # project settings (model, permissions)
  commands/
    spike.md             # /spike  → run Phase-1 validate_stat spike
    test-all.md          # /test-all → cargo test + anchor test + pnpm test
    ship.md              # /ship   → lint+test+build+docker build, pre-submission gate
CLAUDE.md                # this file
```
Add a **pre-commit hook** (husky + lint-staged) and a **CI workflow** (GitHub Actions) that runs `fmt`, `clippy`, `eslint`, `tsc --noEmit`, unit tests, and `anchor build` on every push.

---

## 3. Pinned tech stack (verified June 2026 — bump patches, then lock)

| Layer | Tool | Pinned version | Notes |
|---|---|---|---|
| Toolchain | **Rust** (stable) | `1.95.0` | Pin in `rust-toolchain.toml`. |
| Validator/CLI | **Agave / Solana CLI** | `4.0.x` | Install: `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`. CLI = `solana`. |
| Framework | **Anchor** | `1.0.2` | Repo `solana-foundation/anchor`. Install via `avm`. |
| Client lib | **@solana/kit** | `6.10.x` | web3.js v2 renamed to `@solana/kit`. Use `@solana/web3-compat` only for legacy interop. |
| **Resilience/obs (REQUIRED)** | **solana-resilience-kit** | `1.1.x` | Our own library — **battle-test it** (see §3.5). RPC failover, correct send/confirm, cluster guard, Jito fallback, fee estimation, lifecycle events, wallet-adapter bridge, OTel. Peer dep `@solana/kit ^6.9`. |
| Wallets | **@solana/wallet-adapter** | `0.19.x` | On top of Wallet Standard. |
| Testing | **LiteSVM** (+ **Mollusk** for unit) | latest | `anchor test` for integration; LiteSVM default; bankrun is legacy. |
| Frontend | **Next.js** | `16.2.x` | Turbopack default; min Node 20+. |
| UI | **React** | `19.2.x` | |
| Styling | **Tailwind CSS** | `4.3.x` | v4 engine, CSS-first config. |
| Runtime | **Node.js** | `24 LTS` | Not 26 (Current). |
| Pkg mgr | **pnpm** | `11.x` | Workspaces for the monorepo. |
| Lang | **TypeScript** | `6.0` | Not the 7.0 RC. |
| Edge API/keeper | **Hono** | `4.12.x` | de-facto Workers framework. |
| Deploy CLI | **Wrangler** | `4.x` | Workers, D1, KV, Durable Objects, Cron Triggers. |
| Containers | **Docker** | base `node:24-bookworm-slim`, builder `rust:1.95-bookworm`, runtime `debian:bookworm-slim` | Avoid bullseye (EOL Aug 2026). |

**Version-refresh command (run once at project start, then lock):**
```bash
# JS side — get latest patch within pinned majors, then commit lockfile
pnpm up --latest --filter "./apps/*" --filter "./packages/*"
# Rust side
rustup update stable && cargo update
avm install latest && avm use latest
```
> Patch numbers move weekly. Always confirm against npm / GitHub releases and pin **exact** versions in `pnpm-lock.yaml` / `Cargo.lock`. Never use `^`/`~` ranges for the hackathon build — reproducibility wins.

**TxLINE constants (mainnet):**
- Program ID `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA`
- TxL Mint `sLX1i9dfmsuyFBmJTWuGjjRmG4VPWYK6dRRKSM4BCSx` · USDT Mint `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- API `https://txline.txodds.com/api/` · Auth `https://oracle.txodds.com/auth/guest/start` · Activate `.../api/token/activate`
- DevNet hosts: `oracle-dev.txodds.com` / `txline-dev.txodds.com`
- Daily scores roots PDA seed: `["daily_scores_roots", epochDay as le u16]`
- Reference repo: `github.com/txodds/tx-on-chain` (IDL in `/idl`, examples in `/examples/validation`).
- Free WC tiers: Service Level **1** (60s delay) / **12** (real-time); subscribe = on-chain `subscribe(serviceLevelId, durationWeeks)` charging 0 TxL.

---

## 3.5 REQUIRED library: `solana-resilience-kit` — battle-test & harden

> **Mandate:** every Solana RPC read and every transaction submission in FinalWhistle (keeper, SDK, frontend) goes **through `solana-resilience-kit`** — not raw `@solana/kit` calls. This is a first-party library (author: Mykhailo Shumilov; repo `github.com/mihailShumilov/solana-rpc-sdk`) that we are **deliberately battle-testing under real hackathon load**: use it everywhere it fits, and when you hit a gap, bug, or rough edge, **fix or extend it** (it's our code) and record the finding (see Feedback loop below).

**Install:**
```bash
pnpm add solana-resilience-kit @solana/kit
# optional peers used by our integration:
pnpm add -D @opentelemetry/api          # for OtelMetrics
# react is already present in apps/web for the useResilientSender hook
```
ESM-only, Node ≥ 20. The pool **is** a kit `RpcTransport`, so it drops into existing kit code: build a normal kit RPC with `pool.rpc()`.

**Where to wire it in (mandatory integration points):**
- **`packages/sdk`** — construct one `ResilientRpcPool` from ≥2 RPC endpoints (e.g. primary + backup devnet/Helius) with `freshnessAware`, a `HealthMonitor`, and `CreditRateLimiter`. Export `pool.rpc()` as the project's only RPC. All proof fetches / account reads use it.
- **`apps/keeper` (the critical path)** — submit every `settle` transaction via **`TransactionSender.sendAndConfirm`** (bounded by `lastValidBlockHeight`, `maxRetries:0`, never re-signs → no double-payout, which matches our finality/reorg guard). Use **`FeeEstimator` + `NativeFeeOracle`** to size CU + priority fee (settlement txs carry a raised CU budget for the Merkle verify). Use **`ClusterDetector`/clusterGuard** (`mode:"throw"`) so a mainnet-intended settle can never fire on devnet. Optionally route via **`JitoRouter`** with automatic RPC fallback when settlements must win a contended slot. Subscribe to **`LifecycleEmitter`** events for keeper logs.
- **`apps/web`** — wrap wallet sends (`place_position`, `claim`) with **`WalletAdapterBridge`** + the **`useResilientSender`** React hook (`solana-resilience-kit/react`); surface `transaction:*` lifecycle events in the UI; map failures through **`ErrorTranslator`** for human-readable errors. This also makes the betting UX visibly robust in the demo.
- **Observability** — register an OTel `MeterProvider` and pass **`OtelMetrics`** to the pool/sender so `tx.landings`, `rpc.request.latency_ms`, slot-lag etc. export. A simple dashboard of landing-rate / slot-lag is a strong "production-grade" signal for judges. `InMemoryMetrics` for local/tests.

**Battle-test deliverables (make the testing visible, it's part of the story):**
- Use the shipped **fault harness** `solana-resilience-kit/testing` (`MockCluster`, `MockEndpoint`, `MockJitoEngine`, `MockSubscriptions`) to write FinalWhistle keeper tests that prove settlement still lands under injected drops / 429s / blockhash expiry / slot lag. This doubles as our keeper's reliability test suite.
- Run the diagnostics CLI against our endpoints in the demo/runbook: `npx -p solana-resilience-kit solana-resilience-diagnose probe --rpc <primary> --rpc <backup>` and `... explain --sig <settleSig> --lvbh <n>`.

**Feedback loop (because it's our library — improve it in-flight):**
- Keep `docs/RESILIENCE_KIT_FINDINGS.md`: every friction point, missing helper, type awkwardness, or bug found while integrating. For each: minimal repro + proposed fix.
- If a fix is small and safe, **patch `solana-resilience-kit` directly** (clone the repo, branch, add a failing test against its own harness, fix, `npm run test:cov` must stay ≥ its gate of lines90/funcs90/branches85/stmts90, open a PR / publish a patch `1.1.x`). If larger, file an issue with the repro from our findings doc.
- Pin the exact version used in the FinalWhistle lockfile; if we publish a patched version, bump and re-pin.

---

## 4. Repository setup (git + monorepo)

**Monorepo layout (pnpm workspaces + Anchor):**
```
finalwhistle/
├─ CLAUDE.md                      # = this build guide
├─ README.md                      # public-facing; problem, demo gif, quickstart, TxLINE endpoints used
├─ LICENSE                        # MIT
├─ .gitignore .editorconfig .nvmrc(24) rust-toolchain.toml
├─ pnpm-workspace.yaml  package.json  tsconfig.base.json
├─ .github/workflows/ci.yml
├─ docker-compose.yml             # local stack, UNIQUE PORTS (see §7)
├─ programs/
│  └─ finalwhistle/               # Anchor program (Rust): create_market, place_position, settle (CPI→validate_stat)
│     ├─ src/{lib.rs,state.rs,errors.rs,instructions/*,cpi/txline.rs}
│     └─ Cargo.toml
├─ idl/                           # generated FinalWhistle IDL + vendored TxLINE IDL
├─ tests/                         # anchor + LiteSVM integration tests, golden vectors
├─ packages/
│  ├─ sdk/                        # TS SDK (@solana/kit): build/settle txs, proof fetch, types
│  └─ shared/                     # shared types, predicate encoding, canonicalisation
├─ apps/
│  ├─ web/                        # Next.js 16 frontend (markets, live odds, receipt verifier)
│  ├─ api/                        # Hono on Workers: read API, proof relay, market index (D1/KV)
│  └─ keeper/                     # Worker + Cron Trigger: watch SSE finals → submit settle tx
└─ docs/                          # tech doc, architecture diagrams, demo script, API feedback
```

**Git initialisation:**
```bash
git init -b main
# repo created via the connected git MCP or `gh repo create finalwhistle --public`
git remote add origin <repo-url>
```
- **Branching:** `main` (protected, always green) + short-lived `feat/*` branches → PR → squash-merge. Solo/AI-fast mode may commit to `main` but keep CI green.
- **Conventional Commits** enforced via commitlint. **husky** pre-commit: `lint-staged` (eslint+prettier on staged TS, `cargo fmt`/`clippy` on staged Rust). **pre-push:** unit tests.
- **Secrets:** `.env.local` git-ignored; provide `.env.example`. Wallet keypairs never committed — use `solana-keygen` locally and Wrangler/Hetzner secrets in deploy.

---

## 5. One-time environment bootstrap (commands)

```bash
# 1. Rust + Solana(Agave) + Anchor
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
rustup default 1.95.0
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"      # Agave + solana CLI
cargo install --git https://github.com/solana-foundation/anchor avm --force
avm install latest && avm use latest

# 2. Node 24 LTS + pnpm 11
# (use fnm/nvm) -> node 24 ; then:
corepack enable && corepack prepare pnpm@latest --activate

# 3. Frontend/edge tooling installed per-workspace via pnpm
pnpm i -w

# 4. Local Solana devnet wallet + airdrop (devnet)
solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json
solana config set --url devnet
solana airdrop 5
```

---

## 6. Phase-by-phase autonomous build (commands + acceptance gates)

> Build in this order. Each phase has an **acceptance gate** — do not advance until it passes. This is the spine of autonomous execution.

### Phase 0 — Scaffold & CI (½ day)
- Create the monorepo (§4), `pnpm-workspace.yaml`, `tsconfig.base.json` (`strict`), ESLint/Prettier, husky, commitlint, GitHub Actions CI.
- `anchor init programs/finalwhistle` (or wire an existing Anchor workspace), set `Anchor.toml` clusters (localnet/devnet) and the **unique** local validator ports (§7).
- **Gate:** `pnpm -r lint && pnpm -r typecheck && anchor build` all green in CI.

### Phase 1 — TxLINE spike & GOLDEN VECTOR (de-risk first — highest priority) (1–2 days)
- Clone & study `github.com/txodds/tx-on-chain`; copy `idl/` and `examples/validation/validate_scores_onchain.ts`.
- Subscribe to free WC tier (SL 1 or 12) on devnet, activate API token, fetch a **real** finished-fixture stat proof via `GET /api/scores/stat-validation?fixtureId=…&seq=…&statKey=…`.
- Reproduce a **direct `validate_stat`** call (single-stat predicate, e.g. `value > 0`) against the `daily_scores_roots` PDA on devnet. Then a **two-stat** predicate (`subtract`, `lessThan`).
- Capture the request/response + a passing tx signature as a committed **golden vector** in `tests/golden/`.
- **Gate:** a committed integration test fetches the proof and lands a successful `validateStat` tx on devnet; the two-stat predicate also passes. *(If the proof/predicate encoding differs from our assumption, fix the design now.)*

### Phase 2 — FinalWhistle Anchor program (5–7 days)
Instructions:
- `create_market(predicate, fixture_id, seq, stat_key[, stat_key2, op], close_ts)` → inits a **Market PDA** + a **USDC escrow** (Token-2022/ATA), stores the predicate immutably.
- `place_position(side, amount)` → transfers USDC into escrow, records stake per side (parimutuel pool: YES pool / NO pool; payout = pro-rata of opposing pool minus fee).
- `settle(ts, fixture_summary, fixture_proof, main_tree_proof, predicate, stat_to_prove, [stat2, op])` → **CPI into TxLINE `validate_stat`**; on success set `Resolved(winning_side)`; on failure revert. Guard with finality check + close_ts.
- `claim()` → winners withdraw pro-rata; `void()` path for postponed/abandoned matches (refund).
State: `Market { predicate, fixture_id, seq, stat_keys, pools, status, winning_side, settle_tx }`. Errors typed in `errors.rs`. Checked math everywhere. Fee to a treasury PDA.
- **CPI note:** `validate_stat` is a Merkle-recompute instruction (pure compute, no native sig precompile) → it **is** CPI-able. Vendored TxLINE IDL provides the interface; raise the compute budget (`ComputeBudgetProgram.setComputeUnitLimit`) as the example does.
- **Gate:** `anchor build` clean; program deploys to localnet; happy-path create→place→settle→claim works in a script.

### Phase 3 — Tests (parallel with Phase 2) (ongoing)
- **Mollusk** unit tests for predicate evaluation + payout math (overflow, rounding, fee).
- **LiteSVM / anchor test** integration: full lifecycle, void path, double-settle rejection, wrong-proof rejection, unauthorized claim rejection.
- Re-run the **Phase-1 golden vector** in CI to guarantee proof-format agreement.
- **Gate:** ≥85% logic coverage on the program; all negative tests pass (wrong proof MUST revert).

### Phase 4 — Keeper bot (Cloudflare Worker + Cron) (2 days)
- Worker with a `scheduled` handler (Cron Trigger every ~1 min) + an SSE consumer of TxLINE scores; on a fixture reaching FT, fetch the stat-validation proof and submit `settle` **via `solana-resilience-kit`'s `TransactionSender` over a `ResilientRpcPool`** (NOT raw kit) — with `FeeEstimator` for CU/priority fee and `clusterGuard` set to the target cluster. Persist processed-fixture state in **D1/KV** for idempotency. Manual `POST /settle/:market` endpoint for the demo.
- Add keeper reliability tests using `solana-resilience-kit/testing` (drops / expiry / 429 / slot-lag) proving settlement still lands or correctly reports `expired` (never double-pays).
- **Gate:** `wrangler dev --test-scheduled` triggers a settle against a devnet market end-to-end; the fault-harness reliability tests pass; any issues found are logged in `docs/RESILIENCE_KIT_FINDINGS.md` (and patched upstream if small).

### Phase 5 — Frontend (Next.js 16) (5–7 days, parallelizable)
- Wallet connect (wallet-adapter + Wallet Standard). **Route all wallet sends (`place_position`, `claim`) through `solana-resilience-kit`'s `WalletAdapterBridge` + `useResilientSender` hook**, render `transaction:*` lifecycle states, and translate errors via `ErrorTranslator`. Pages: **Markets** (live odds/implied prob from TxLINE SSE), **Create market** (predicate builder UI: pick fixture, stat, comparison, threshold, optional 2-stat op), **Position** (stake USDC), **Receipt verifier** (paste/lookup a settlement → re-fetch proof → re-verify locally + link to on-chain tx).
- The **Verifiable Settlement Receipt** is the hero UI — show predicate, proven stat values, Merkle root, tx signature, and a green "independently re-verified" check.
- **Gate:** end-to-end on devnet from the deployed frontend: create → bet → (keeper or manual) settle → claim → receipt re-verifies.

### Phase 6 — Read API & market index (Hono on Workers) (2 days)
- Hono API: list/aggregate markets, cache live odds, serve proofs to the receipt verifier, store the market registry in D1. CORS locked to the web origin.
- **Gate:** frontend reads exclusively through the API; cold-start < 50ms; no secrets exposed.

### Phase 7 — Dockerization (1 day) — see §7. **Gate:** `docker compose up` brings the full local stack on the unique ports; smoke test passes.

### Phase 8 — Docs, demo, submission (2–3 days) — see §9 & §10.

---

## 7. Dockerization (local testing + deploy) — UNIQUE PORTS

> **Use a dedicated, uncommon port block so the stack never collides with other local projects.** FinalWhistle reserves the **`779x` app block** and the **`189xx` Solana block**. Do not use defaults (3000/8899/5432/6379).

| Service | Internal | **Host (unique)** | Notes |
|---|---|---|---|
| web (Next.js) | 3000 | **7790** | |
| api (Hono/Workers dev) | 8787 | **7791** | wrangler dev |
| keeper (Workers dev) | 8788 | **7792** | wrangler dev --test-scheduled |
| postgres (optional index) | 5432 | **7795** | if not using D1 locally |
| redis (optional cache) | 6379 | **7796** | optional |
| solana-test-validator RPC | 8899 | **18899** | `--rpc-port 18899` |
| validator WebSocket | 8900 | **18900** | |
| validator faucet | 9900 | **19900** | |
| validator gossip | 8001 | **18001** | |

**`docker-compose.yml` (shape):**
```yaml
name: finalwhistle
services:
  validator:
    image: anzaxyz/agave:4.0.0   # or build from solana CLI
    command: solana-test-validator --rpc-port 18899 --faucet-port 19900 --reset
    ports: ["18899:18899","18900:18900","19900:19900"]
  web:
    build: { context: ., dockerfile: apps/web/Dockerfile }
    ports: ["7790:3000"]
    environment: [ NEXT_PUBLIC_RPC=http://validator:8899 ]
    depends_on: [validator]
  api:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    ports: ["7791:8787"]
# Optionally postgres(7795)/redis(7796) if D1/KV are not emulated locally.
```

**Dockerfiles (multi-stage, latest bases):**
- `apps/web`: builder `node:24-bookworm-slim` (`pnpm build`) → runner `node:24-bookworm-slim`, non-root user, `next start`.
- program build image: `rust:1.95-bookworm` with Agave + Anchor for reproducible `anchor build` in CI.
- Pin base image digests for reproducibility; `.dockerignore` node_modules/target.

**Local run:**
```bash
docker compose up --build       # full stack on 779x / 189xx
# or run pieces natively:
solana-test-validator --rpc-port 18899 --faucet-port 19900 --reset
anchor deploy --provider.cluster localnet
pnpm --filter web dev -- -p 7790
```

---

## 8. Deployment

### Option A — Serverless on Cloudflare (PRIMARY)
The whole off-chain side runs at the edge; only the program lives on Solana.
- **Solana program:** deploy to **devnet** (and optionally mainnet) via `anchor deploy --provider.cluster devnet`. Record the program ID; commit the IDL.
- **Frontend (`apps/web`):** Next.js 16 on **Cloudflare Workers** via the Workers/OpenNext adapter (or Cloudflare Pages). `wrangler deploy`.
- **API (`apps/api`):** Hono Worker → `wrangler deploy`; bind **D1** (market index) + **KV** (odds cache).
- **Keeper (`apps/keeper`):** Worker with **Cron Triggers** (`crons = ["*/1 * * * *"]` in `wrangler.toml`) + a manual settle route. Secrets via `wrangler secret put` (RPC URL, keeper keypair, TxLINE API token). Idempotency state in D1.
- **Custom domain & CORS** via Cloudflare. No servers to manage; scales to zero.
- **Deploy commands:**
```bash
pnpm --filter api deploy        # wrangler deploy
pnpm --filter keeper deploy
pnpm --filter web deploy
wrangler secret put KEEPER_SECRET_KEY --name finalwhistle-keeper
wrangler d1 migrations apply finalwhistle
```

### Option B — Hetzner single-server (FALLBACK / full control)
- **Box:** Hetzner CPX21+ (Ubuntu 24.04). Install Docker + Docker Compose plugin.
- **Run:** the same `docker-compose.yml`, but front it with **Caddy** (auto-HTTPS) reverse-proxying `web`(7790) and `api`(7791); keeper runs as a compose service with an internal cron (e.g. `supercronic`) instead of CF Cron.
- **Hardening:** UFW (allow 22/80/443 only — app ports stay internal), fail2ban, non-root deploy user, unattended-upgrades, secrets in `/etc/finalwhistle/.env` (chmod 600), Docker logs rotated.
- **Deploy flow:** GitHub Actions → SSH → `git pull && docker compose up -d --build`. Caddyfile maps `finalwhistle.<domain>` → web, `api.finalwhistle.<domain>` → api.
- Solana program still deploys to devnet/mainnet exactly as Option A (chain is chain).

> Recommendation: **ship Cloudflare (A)** for the submission link (zero-ops, fast, impressive), keep **Hetzner (B)** documented as the self-host path. Judges get one working URL either way.

---

## 9. Documentation deliverables (hackathon-required)

Produce all of these in `docs/` and the README:
1. **README.md** (public repo): one-line pitch, demo GIF/loom link, the problem (oracle/whale-capture), architecture diagram, quickstart, **explicit list of TxLINE endpoints used**, deployed link, license.
2. **Technical doc** (`docs/TECHNICAL.md` or `.docx`): core idea, business + technical highlights, settlement flow, the `validate_stat` CPI, security model, and **the exact TxLINE endpoints used** (`/auth/guest/start`, `/api/token/activate`, `subscribe` instruction, `/api/scores/stat-validation`, scores/odds SSE, snapshot endpoints).
3. **API-feedback note** (`docs/TXLINE_FEEDBACK.md`): what we liked (canonical schema, free WC tier, predicate engine + three-stage proof, CPI-able validate_stat) and friction points (auth/JWT expiry, proof-format discovery, devnet data coverage, CU costs) — judges explicitly ask for this.
4. **Diagrams** (via `diagram-creation`): system architecture, settlement sequence (SSE→proof→CPI→payout), oracle-comparison (UMA vote vs FinalWhistle proof).
5. **Demo video script** (`docs/DEMO_SCRIPT.md`): ≤5 min — problem (whale-capture villain) → live walkthrough (create → bet → settle → receipt re-verify) → "how TxLINE powers the backend." Because settlement is deterministic, **the demo reproduces perfectly after matches end** (the judges' stated concern).
6. **Pitch deck** (via `pptx`) for the live interview round.

---

## 10. Hackathon compliance checklist (gate before submitting)

- [ ] Deployed build on devnet **or** mainnet, reachable by a working link (CF Workers URL or Hetzner domain).
- [ ] Public GitHub repo, MIT, clean history, CI green, this `CLAUDE.md` + README present.
- [ ] **Demo video ≤5 min** (Loom/YouTube) — problem, live walkthrough, TxLINE backend. *(Absolute screening requirement.)*
- [ ] Working app link **or** functional API/devnet endpoint for judges to test.
- [ ] Technical doc with core idea + highlights + **list of TxLINE endpoints used**.
- [ ] API-feedback section completed.
- [ ] **USDC** collateral only — **zero** TxL used for wagering/escrow/transfers.
- [ ] Markets are objective/score-based (no injury/referee/in-game props).
- [ ] TxLINE is the primary data source; every settlement carries a verifiable proof.
- [ ] Determinism: golden-vector test green; `settle` rejects tampered proofs; finality waited.
- [ ] `solana-resilience-kit` wired into keeper + SDK + frontend; fault-harness reliability tests pass; `docs/RESILIENCE_KIT_FINDINGS.md` filled in (and any small fixes patched upstream).
- [ ] Submitted via Superteam Earn before **19 Jul 2026, 23:59 UTC**, owned by an eligible person/entity.
- [ ] Security pass (verification agent): no secrets in repo, checked math, account validation, no `unwrap` in on-chain paths.

---

## 11. Quick command reference

```bash
# Build & test everything
anchor build && anchor test
pnpm -r lint && pnpm -r typecheck && pnpm -r test
cargo clippy -- -D warnings && cargo fmt --check

# Local full stack (unique ports)
docker compose up --build            # web:7790 api:7791 validator:18899
# Devnet program deploy
anchor deploy --provider.cluster devnet
# Edge deploy
pnpm --filter api deploy && pnpm --filter keeper deploy && pnpm --filter web deploy
# Pre-submission gate
/ship                                 # lint+test+build+docker+compliance
```

---

### Appendix — TxLINE `validate_stat` call shape (from the on-chain-validation example, vendor IDL)
`program.methods.validateStat(ts, fixtureSummary, fixtureProof, mainTreeProof, predicate, statToProve, stat2|null, op|null).accounts({ dailyScoresMerkleRoots: dailyScoresRootsPda }).preInstructions([ComputeBudgetProgram.setComputeUnitLimit({units})])` where `predicate = { threshold, comparison: { lessThan|greaterThan|... : {} } }`, `statToProve = { statToProve:{key,value,period}, eventStatRoot, statProof:[{hash,isRightSibling}] }`, proofs come from `GET /api/scores/stat-validation`. Our `settle` wraps this as a **CPI** rather than a direct call, then moves escrow. Reproduce & golden-vector it in Phase 1 before building on top.
