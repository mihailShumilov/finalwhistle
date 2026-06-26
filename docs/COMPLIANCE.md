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
| ✅ | **Working public link** (frontend/API/keeper on Cloudflare Workers) | done | Frontend https://finalwhistle-web.mschumilow.workers.dev · API https://finalwhistle-api.mschumilow.workers.dev (live `/markets` + `/receipt`) · keeper https://finalwhistle-keeper.mschumilow.workers.dev. Worker reads use a Helius devnet RPC (secret). |
| ⬜ | **Demo video ≤5 min** | outstanding | Script ready in `docs/DEMO_SCRIPT.md`; record against the live link. |
| ⬜ | **Submit via Superteam Earn before 19 Jul 2026** | outstanding | Submission action by the team. |

## Remaining (team actions, not blockers)

1. **Demo recording** — record the ≤5-min walkthrough against the live link (`docs/DEMO_SCRIPT.md`).
2. **Superteam Earn submission** — submit before the deadline.

Everything buildable — program, SDK, keeper, API, frontend, tests, docs, **devnet program +
Cloudflare deployment** — is complete and verified live.
