# TxLINE API — Integration Feedback

Notes captured while building FinalWhistle against TxLINE. Judges explicitly ask for this.

## What we liked

- **CPI-able `validate_stat`.** It is a pure Merkle-recompute instruction (no native sig
  precompile), so a custom settlement program can CPI into it directly. This is the single
  feature our whole design rests on, and it works exactly as advertised.
- **The predicate engine is the differentiator.** `TraderPredicate { threshold, comparison }`
  plus an optional second stat and `BinaryExpression` (Add/Subtract) lets the chain natively
  prove compound props like `P1 Goals − P2 Goals ≥ 2` or `Total Corners > 10` — not just a
  yes/no score. No other sports oracle on Solana ships this.
- **Three-stage proof is clean.** `statProof → subTreeProof → mainTreeProof` connecting a
  single stat up to the on-chain daily root is easy to reason about and to vendor.
- **Free World Cup tier really is free.** `subscribe(serviceLevelId, weeks)` registers the
  subscription on-chain and charges **0 TxL** for SL 1 / SL 12 — confirmed by a landed devnet
  subscribe tx. No payment rail needed to build.
- **Canonical, deterministic schema.** `ScoresStatValidation` maps 1:1 onto the on-chain
  `validate_stat` args, so the off-chain → on-chain hand-off needs no reshaping beyond hex →
  `[u8; 32]`.
- **`validate_stat` reverts on a false predicate** (no boolean return value in the IDL). This
  is actually ideal for settlement: a successful CPI *is* a cryptographic proof that the side
  we claimed won — we never have to trust an off-chain "who won" flag.

## Friction points

- **Auth/activate host mismatch.** The on-chain example
  (`examples/validation/validate_scores_onchain.ts`) and the build notes point auth +
  activation at `oracle(-dev).txodds.com`, but those hosts have **flaky DNS** and the working
  endpoints are actually on `txline(-dev).txodds.com` (`/auth/guest/start`,
  `/api/token/activate`) — which is what the *Quickstart* / *World Cup* docs use. The two
  references disagree; aligning them would save integrators an hour.
- **Devnet data backend instability.** During our build window the **devnet** edge
  (`txline-dev.txodds.com`) served `/auth/guest/start` (200) and accepted the on-chain
  `subscribe` tx, but returned **`503 Service Temporarily Unavailable`** for
  `/api/token/activate` and every `/api/scores/*` data endpoint. Mainnet
  (`txline.txodds.com`) was up (401 without a token) throughout. A status page or a documented
  devnet data-availability window would help, since the whole proof-fetch path depends on it.
- **JWT vs API-token roles are easy to conflate.** The data endpoints need **both** the guest
  `Authorization: Bearer <jwt>` **and** `X-Api-Token: <apiToken>`; a missing `X-Api-Token`
  surfaces as a generic error rather than a specific "missing api token" message.
- **CU budget.** `validate_stat` recomputes the full Merkle path; the example sets a 10M CU
  limit, but the per-transaction ceiling is 1.4M. We set `setComputeUnitLimit(1_400_000)` and
  document that settlement transactions must raise the budget.
- **Proof-format discovery.** `eventStatRoot` is shared between `statToProve` and
  `statToProve2` in a two-stat response, which isn't obvious from the schema; the example made
  it clear but the OpenAPI doc alone wouldn't.

## Endpoints used

| Purpose | Endpoint |
|---|---|
| Guest JWT | `POST {txline}/auth/guest/start` |
| Subscribe (free WC tier) | on-chain `subscribe(serviceLevelId, weeks)` (0 TxL) |
| Activate API token | `POST {txline}/api/token/activate` |
| Settlement proof | `GET {txline}/api/scores/stat-validation?fixtureId&seq&statKey[&statKey2]` |
| Market data | `GET {txline}/api/scores/snapshot/:id`, `/api/scores/historical/:id` |
| Live odds / FT detection | `GET {txline}/api/scores/stream` (SSE) |
| On-chain settlement | CPI → `validate_stat(...)` against the `daily_scores_roots` PDA |

`{txline}` = `https://txline.txodds.com` (mainnet) / `https://txline-dev.txodds.com` (devnet).
