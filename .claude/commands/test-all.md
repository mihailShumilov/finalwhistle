---
description: Run the full FinalWhistle test matrix (Rust + Anchor + TS)
---

Run, in order, and report any failures:

1. `cargo fmt --check` and `cargo clippy -- -D warnings` (program code quality)
2. `anchor build` (program compiles to SBF + IDL)
3. `cargo test -p finalwhistle` (Mollusk/LiteSVM unit tests)
4. `pnpm -r typecheck` (TS strict, no-any)
5. `pnpm -r test` (shared + SDK + keeper + golden vectors)
6. `pnpm lint` (Biome)
