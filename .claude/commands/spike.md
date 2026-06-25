---
description: Run the Phase-1 TxLINE validate_stat spike and refresh the golden vector
---

Run the TxLINE de-risking spike:

1. Ensure a funded devnet wallet exists at `.keys/keeper-devnet.json` (airdrop if needed).
2. `pnpm --filter @finalwhistle/tests spike` — guest auth → subscribe (free WC tier) →
   activate → fetch `/api/scores/stat-validation` → land a `validate_stat` tx on devnet
   (single-stat and two-stat), and write the captured request/response + tx signatures to
   `tests/golden/`.
3. Confirm the committed golden-vector test still agrees byte-for-byte:
   `pnpm --filter @finalwhistle/tests test`.

If the proof/predicate encoding differs from our assumptions, STOP and fix the design
(state.rs / cpi/txline.rs / sdk) before building further.
