# solana-resilience-kit — Integration Findings

We route **every** Solana RPC read and transaction submission in FinalWhistle (SDK, keeper,
frontend) through [`solana-resilience-kit`](https://github.com/mihailShumilov/solana-rpc-sdk)
and battle-test it under real hackathon load. This log records friction, bugs, and fixes, with
a minimal repro and a proposed remedy for each. Version pinned: **`solana-resilience-kit@1.2.0`**.

## Integration map (where it is wired in)

| Surface | Module(s) | Status |
|---|---|---|
| `packages/sdk` | `ResilientRpcPool` (≥2 endpoints, freshness + health + rate limit) as the only RPC; `pool.rpc()` exported | planned |
| `apps/keeper` | `TransactionSender.sendAndConfirm` for every `settle`; `FeeEstimator` + `NativeFeeOracle`; `clusterGuard{mode:"throw"}`; `LifecycleEmitter` logs; fault-harness reliability tests | planned |
| `apps/web` | `WalletAdapterBridge` + `useResilientSender` for `place_position`/`claim`; `transaction:*` UI; `ErrorTranslator` | planned |
| Observability | `OtelMetrics` (landing rate, slot lag, latency) → OTLP | planned |

## Observations

### F-001 — Program deploy on public devnet is exactly the failure class the kit fixes
**Severity:** context / validation (not a kit bug).
**What happened:** `anchor deploy` of the 337 KB program against `api.devnet.solana.com`
failed with `Data writes to account failed: Custom error: Max retries exceeded`, leaking a
2.35 SOL buffer. The buffer-write transactions were silently dropped under congestion — *the
no-mempool + SWQoS failure mode the kit's `TransactionSender` is built around*.
**Workaround that landed it:** resume from the leaked buffer with a priority fee and more sign
attempts:
```
solana program deploy target/deploy/finalwhistle.so \
  --program-id target/deploy/finalwhistle-keypair.json \
  --buffer <leaked-buffer> --keypair .keys/keeper-devnet.json --url devnet \
  --with-compute-unit-price 100000 --max-sign-attempts 500
```
**Takeaway:** this is precisely why our keeper must submit `settle` through the kit
(`maxRetries:0` + bounded rebroadcast + `FeeEstimator` priority fee) rather than a naive
`sendAndConfirm`. The deploy path itself is `solana`/`anchor` tooling we can't route through
the kit, but it independently validates the kit's thesis. We will quantify the contrast in the
keeper fault-harness tests (landing rate with vs without the kit under injected drops).

### F-002 — Devnet RPC is too flaky for a single endpoint
**Severity:** context.
During the spike and lifecycle runs, `api.devnet.solana.com` intermittently rate-limited and
dropped sends. This is the motivation for constructing the SDK pool from **≥2** endpoints with
`freshnessAware` routing and a `CreditRateLimiter`, so reads/sends fail over instead of erroring.

### F-003 — `@opentelemetry/api` is imported eagerly even when unused
**Severity:** low (friction).
`solana-resilience-kit/dist/observability/metrics.js` imports `@opentelemetry/api` at module
load, so even an integration that only uses `InMemoryMetrics` fails with
`Cannot find package '@opentelemetry/api'` until that optional peer is installed. The README
calls it optional, which is true for *using* `OtelMetrics`, but the eager import makes it a
hard requirement for importing the package at all.
**Repro:** `import { InMemoryMetrics } from "solana-resilience-kit"` with no `@opentelemetry/api`
installed → throws on import.
**Proposed fix:** lazy/dynamic-import `@opentelemetry/api` inside `OtelMetrics` only, or guard
the import, so `InMemoryMetrics`-only consumers don't need the peer. Workaround: we pin
`@opentelemetry/api@1.9.1` in the SDK + keeper.

### Keeper reliability suite — PASSING (the headline result)
`apps/keeper/test/reliability.test.ts` drives the keeper's real send path
(`ResilientRpcPool` → `pool.rpc()` → `TransactionSender`, with the SDK's web3→kit instruction
adapter building the CU-budgeted settle tx) through the shipped fault harness. All five pass:

| Scenario | Injected fault | Asserted outcome |
|---|---|---|
| Healthy | none | `confirmed` |
| Broken primary | `errorRate: 1` on primary, healthy backup | `confirmed` (failover) |
| Blockhash death | `dropRate: 1`, clock advanced past `lastValidBlockHeight` | `expired`, **same signature** (never re-signed → no double-pay) |
| Rate limiting | `rate429Rate: 1` on primary, healthy backup | `confirmed`, primary `stats.rateLimited > 0` |
| Lagging node | `slotLag: 250` on one of two endpoints | `confirmed` (freshness routing) |

**Harness modelling note (not a bug):** a `dropRate` silent drop is *terminal for a signature*
— `MockCluster.rpcSendTransaction` records the drop on first accept and a re-send of the same
signature is a no-op. This is exactly correct: a silently-dropped tx whose blockhash later dies
**cannot** be recovered by rebroadcast; the right behaviour (which the kit delivers) is to report
`expired` and force a rebuild with a fresh blockhash, never to re-sign. So "transient recovery"
is correctly modelled as *failover across endpoints* (429 / transport error before the tx is
recorded), not as re-sending a dropped signature. Our tests assert exactly this distinction.

### Integration ergonomics — positive
- `ResilientRpcPool` really is a drop-in: `pool.rpc()` returns a normal `@solana/kit` RPC, so
  our account reads (`getAccountInfo`, `getProgramAccounts`) and `getLatestBlockhash` all flow
  through it with zero special-casing — no raw kit RPC anywhere in the codebase.
- `TransactionSender`'s injected `sleep` made the reliability tests fully deterministic (advance
  the mock clock per loop iteration) with no real timers.
- `clusterGuard: { expected: "devnet", mode: "throw" }` is a one-liner that makes a
  mainnet-intended settle physically unable to land on devnet — exactly our finality/safety need.
