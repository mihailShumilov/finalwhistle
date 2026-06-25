# FinalWhistle — Hackathon Compliance Checklist (§10)

Status as of this commit. ✅ done · 🟡 ready, needs a credential · ⬜ outstanding.

| | Item | Status | Evidence |
|---|---|---|---|
| ✅ | **USDC collateral only** — zero TxL for wagering/escrow/transfer | done | Program escrow + all transfers use the market's USDC mint; TxL appears only in the free-tier `subscribe` (0 TxL). `programs/finalwhistle/src/*`. |
| ✅ | **Objective, score-based markets** (no injury/referee/in-game props) | done | Predicate model restricted to score stats + Gt/Lt over totals/spreads/diff/corners. `packages/shared/src/predicate.ts`, `txline.ts`. |
| ✅ | **TxLINE is the primary data source**; every settlement carries a proof | done | `settle` CPIs `validate_stat`; receipt re-verifies the Merkle proof. `docs/TECHNICAL.md` §7. |
| ✅ | **Determinism: golden-vector test green** | done | `tests/golden/stat_validation.devnet.json` + `tests/src/golden.test.ts` (live devnet vector asserts return-data ↔ off-chain agreement). |
| ✅ | **`settle` rejects tampered proofs; finality respected** | done | Tamper-revert proven on devnet (spike); keeper sends via `TransactionSender` (bounded by `lastValidBlockHeight`, no re-sign); `claim` gates on `Resolved`. |
| ✅ | **`solana-resilience-kit` wired into keeper + SDK + frontend** | done | `packages/sdk` (pool + sender), `apps/keeper` (settle), `apps/web` (wallet bridge). All RPC reads + sends route through it. |
| ✅ | **Fault-harness reliability tests pass** | done | `apps/keeper/test/reliability.test.ts` 5/5: failover (transport-error/429), slot-lag freshness, and `expired` (no double-pay) on blockhash death. |
| ✅ | **`docs/RESILIENCE_KIT_FINDINGS.md` filled in** | done | F-001..F-003 + the passing suite + the silent-drop-is-terminal modelling note. |
| ✅ | **Public GitHub repo, MIT, CI, `CLAUDE.md` + README present** | done | `github.com/mihailShumilov/finalwhistle`; `.github/workflows/ci.yml`; MIT `LICENSE`. |
| ✅ | **Deployed program on devnet, testable** | done | `GSud9smJwwV6QhDLd2hmSQPShj1w8zYumz5BL3snbmao` (`DEVNET.md`); full create→place→settle→claim proven via `pnpm --filter @finalwhistle/tests lifecycle`. |
| ✅ | **Technical doc + API-feedback + diagrams + demo script** | done | `docs/TECHNICAL.md`, `docs/TXLINE_FEEDBACK.md`, `docs/diagrams.md`, `docs/DEMO_SCRIPT.md`. |
| ✅ | **Security pass** — no secrets in repo, checked math, account validation, no on-chain `unwrap`/`expect` | done | Keypairs git-ignored (`.keys/`); `checked_*` math; full PDA/owner/signer checks; `clippy -D warnings` + `cargo fmt` clean; 58 Rust tests. |
| 🟡 | **Working public link** (frontend/API/keeper on Cloudflare Workers) | ready, needs CF login | `apps/web` builds (`next build` green); `apps/api`/`apps/keeper` are Workers; deploy with `wrangler deploy` once a **Cloudflare account / `wrangler login`** is available. Local stack runs via `docker compose up` or `pnpm --filter … dev`. |
| ⬜ | **Demo video ≤5 min** | outstanding | Script ready in `docs/DEMO_SCRIPT.md`; record against the deployed link or the local stack. |
| ⬜ | **Submit via Superteam Earn before 19 Jul 2026** | outstanding | Submission action by the team. |

## Blockers requiring a credential (autonomy contract)

1. **Cloudflare account / `wrangler login`** — to publish the frontend, read API, and keeper Cron
   to public Workers URLs (and create the D1/KV namespaces referenced in `wrangler.toml`). Code is
   deploy-ready; only the account + `wrangler secret put` values (KEEPER_SECRET_KEY, TXLINE_JWT,
   TXLINE_API_TOKEN) are missing.
2. **Demo recording + Superteam submission** — team actions.

Everything else — program, SDK, keeper, API, frontend, tests, docs, devnet deployment — is
complete and verified.
