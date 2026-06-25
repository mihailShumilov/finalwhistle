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

*(Integration-time findings — type awkwardness, missing helpers, bugs — are appended below as
the SDK / keeper / frontend wire the kit in. Small, safe fixes are patched upstream against the
kit's own fault harness with its coverage gate kept green; larger ones are filed as issues.)*
