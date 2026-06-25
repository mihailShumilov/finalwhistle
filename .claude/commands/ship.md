---
description: Pre-submission gate — lint, test, build, docker, compliance
---

Run the full pre-submission gate and report a pass/fail per item:

1. `pnpm lint && pnpm -r typecheck && pnpm -r test`
2. `cargo fmt --check && cargo clippy -- -D warnings && anchor build && cargo test`
3. `docker compose build` then `docker compose up -d` + smoke test on the unique ports
   (web 7790, api 7791, validator 18899), then `docker compose down`.
4. Walk the §10 compliance checklist in CLAUDE.md (USDC-only, objective markets, TxLINE
   primary, golden vector green, resilience-kit wired + findings logged, no secrets).
5. Confirm all docs/ deliverables exist and the deployed link resolves.
