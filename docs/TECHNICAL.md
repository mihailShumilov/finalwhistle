# FinalWhistle — Technical Documentation

> Permissionless parametric prop-bet protocol on Solana that **self-settles** via a CPI into
> TxLINE's `validate_stat`. Objective, score-based markets; USDC-only collateral; every
> settlement carries a re-verifiable Merkle proof.

## 1. Core idea

A FinalWhistle market **is** a cryptographic predicate over one or two TxLINE score stats:

```
YES holds  ⇔  (statA  [op statB])  <comparison>  threshold
```

e.g. `P1 Corners > 10`, or two-stat `P1 Goals − P2 Goals ≥ 2`. Bettors stake **USDC** on YES or
NO into a parimutuel pool. After the match, anyone (a keeper bot or a user) submits the TxLINE
three-stage Merkle proof to our `settle` instruction, which **CPIs into TxLINE `validate_stat`**.
The proof is verified against TxLINE's on-chain daily-scores root; the predicate result routes
USDC to the winners atomically. There is **no oracle vote, no dispute window, no operator**.

Every settlement is accompanied by a **Verifiable Settlement Receipt**: the predicate, the proven
stat value(s), the Merkle root, and the settle transaction — re-verifiable by anyone in the
browser.

## 2. Why it wins (business highlights)

On-chain betting solved pricing and trading but **not settlement**:

- **Polymarket / UMA** settle disputes by a **token-weighted vote** that pays voters for matching
  the perceived majority, not the truth — demonstrably whale-captured (the $237M Zelensky "suit"
  market, the $7M Ukraine deal, the $16M UFO market, all resolved against the facts). Disputes
  drag for days.
- **Kalshi / Drift / SX / Azuro** settle by a **centralised operator** that writes *and* judges
  its own rules.

For **objective sports stats this entire problem is unnecessary.** TxLINE uniquely provides the
missing primitive — a `validate_stat` instruction with a built-in predicate engine — so
FinalWhistle settles by **deterministic cryptographic proof**. It is the trustless-and-trustworthy
middle of a market that is otherwise a barbell of *decentralised-but-gameable* vs
*compliant-but-conflicted*. And because settlement is deterministic, the demo reproduces perfectly
after matches end.

## 3. Technical highlights

- **CPI into `validate_stat`** with a manually-vendored argument layout + discriminator
  (`programs/finalwhistle/src/oracle.rs`). TxLINE has no published crate, so we vendor only the
  borsh arg types from its IDL.
- **The caller can never bias the outcome.** `settle` builds the YES predicate from the *immutable*
  market config; the caller supplies only the proof. `validate_stat` reverts on a tampered proof
  and otherwise returns the predicate result via transaction return data — so a successful CPI is
  itself a cryptographic proof of the winning side.
- **Golden-vector determinism.** The Phase-1 spike landed real `validate_stat` transactions on
  devnet (single- and two-stat) and captured a committed golden vector
  (`tests/golden/stat_validation.devnet.json`); a CI test asserts our off-chain evaluation agrees
  with the on-chain return value, byte-for-byte.
- **`solana-resilience-kit` everywhere.** All RPC reads and tx sends go through a
  `ResilientRpcPool` + `TransactionSender` (failover, freshness routing, `maxRetries:0` + bounded
  rebroadcast, cluster guard). A fault-harness suite proves settlement still lands under
  transport-error / 429 failover and slot-lag, and correctly reports `expired` (no double-pay)
  when the blockhash dies.
- **Checked arithmetic, full account validation, no `unwrap`/`expect` on-chain.** `cargo clippy -D
  warnings` + `cargo fmt` clean; TS strict, no-`any`, Biome clean.

## 4. Settlement flow

```
TxLINE scores SSE ──▶ keeper detects fixture FT
                         │
                         ▼  GET /api/scores/stat-validation?fixtureId&seq&statKey[&statKey2]
                    three-stage Merkle proof  (statProof → subTreeProof → mainTreeProof)
                         │
                         ▼  settle(proof)   [tx through solana-resilience-kit, +1.4M CU]
        FinalWhistle.settle ──CPI──▶ TxLINE.validate_stat(ts, summary, proofs, predicate, statA[,statB,op])
                         │                         │
                         │                 verify proof vs daily_scores_roots PDA
                         │                 (reverts if tampered) ; write bool to return_data
                         ▼
        read return_data ⇒ winning_side ; transfer fee → treasury ; status = Resolved
                         │
                         ▼  claim()  → pro-rata USDC to winners (or full refund if Voided)
                         ▼  Verifiable Settlement Receipt (re-verify proof in the browser)
```

Key invariants:
- The canonical timestamp passed to `validate_stat` is `summary.updateStats.minTimestamp` (matching
  TxLINE's `TimestampMismatch` check) and the daily-scores-roots PDA is seeded with
  `["daily_scores_roots", epochDay(minTimestamp) as u16-LE]`.
- `settle` binds the proof to the market: `stat_a.key == market.stat_key`,
  `period == market.period`, `fixture_summary.fixture_id == market.fixture_id`, and the two-stat
  key/operator must match — a valid proof for a *different* stat can never settle this market.
- `validate_stat` is pinned to the configured TxLINE program id; `daily_scores_merkle_roots` is
  owner-checked against it.

## 5. Program interface

| Instruction | Effect |
|---|---|
| `create_market(nonce, params)` | Inits a Market PDA + USDC escrow (Token-2022/Token via `token_interface`); stores the immutable predicate. Permissionless. |
| `place_position(side, amount)` | Transfers USDC into escrow; records per-side stake; updates the parimutuel pools. |
| `settle(proof)` | CPIs `validate_stat`; resolves the winning side from the return-data bool; takes the protocol fee from the losing pool; voids if the winning side had no stake. |
| `claim()` | Winners withdraw pro-rata (`stake × payout_pool / winning_pool`); voided markets refund full stake. |
| `void_market()` | Authority voids an open market (postponed/abandoned fixture) → refunds. |

Payout math (u128 intermediates, checked): `fee = losing_pool × fee_bps / 10_000`;
`payout_pool = winning_pool + (losing_pool − fee)`; a winner receives
`winning_stake × payout_pool / winning_pool`. Last-claimer dust stays in escrow.

## 6. Security model

- **Settlement integrity** rests on TxLINE's Merkle verification: `validate_stat` reverts on a
  tampered proof (proven on devnet), so escrow can only be released for the true outcome.
- **No operator trust:** the only trust assumption is "TxODDS signed the canonical dataset" —
  exactly what books already assume of Sportradar, except now cryptographically re-checkable.
- **Finality / reorg guard:** the keeper submits via `TransactionSender` (bounded by
  `lastValidBlockHeight`, never re-signs → no double-pay) and can confirm at `finalized`; `claim`
  reads `Resolved` status, so a reorg that unwinds `settle` simply blocks claims rather than
  double-paying. `settle_slot` is recorded for auditability.
- **Collateral rule:** USDC only. The TxL token is used solely for the free-tier `subscribe`
  (0 TxL) and never for wagering/escrow/transfer.
- **CFTC posture:** markets are objective and score-based (totals, spreads, goal-difference,
  corners). Injury / referee / discrete in-game props are out of scope by design.

## 7. TxLINE endpoints used

| Purpose | Endpoint / instruction |
|---|---|
| Guest JWT (30-day) | `POST {txline}/auth/guest/start` |
| Free World Cup subscription | on-chain `subscribe(serviceLevelId, weeks)` (SL 1 / 12, **0 TxL**) |
| Activate API token | `POST {txline}/api/token/activate` (signed `txSig:leagues:jwt`) |
| **Settlement proof** | `GET {txline}/api/scores/stat-validation?fixtureId&seq&statKey[&statKey2]` |
| Market data | `GET {txline}/api/scores/snapshot/:id`, `/api/scores/historical/:id`, `/api/fixtures/snapshot` |
| Live odds / FT detection | `GET {txline}/api/scores/stream` (SSE) |
| **On-chain settlement** | CPI → `validate_stat(...)` against the `daily_scores_roots` PDA |

`{txline}` = `https://txline.txodds.com` (mainnet) / `https://txline-dev.txodds.com` (devnet).
See `docs/TXLINE_FEEDBACK.md` for integration notes (host discrepancy, devnet availability,
byte-array hash encoding, the `minTimestamp` canonicalisation).

## 8. Deployment

- **Solana program:** devnet `GSud9smJwwV6QhDLd2hmSQPShj1w8zYumz5BL3snbmao` (see `DEVNET.md`).
- **Edge (primary):** Next.js frontend, Hono read API, and keeper Cron all on **Cloudflare
  Workers** (D1/KV for the market index + idempotency).
- **Fallback:** the same `docker-compose.yml` (unique ports `779x` / `189xx`) behind Caddy on a
  single Hetzner box.

See the top-level `README.md` for the quickstart and `docs/DEMO_SCRIPT.md` for the ≤5-minute demo.
