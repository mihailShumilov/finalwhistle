# FinalWhistle — Demo Script (≤ 5 minutes)

> Because settlement is deterministic and re-verifiable, this demo reproduces **perfectly after
> matches end** — exactly the judges' stated concern.

## 0. Cold open (15s)
> "On-chain betting solved pricing and trading. It never solved **settlement**. Polymarket
> settles disputes by a token vote that whales captured to pay out a $237M market *against the
> facts*. Kalshi lets one operator write and judge its own rules. For **objective sports stats,
> that whole problem is unnecessary** — and TxLINE gives us the primitive to kill it."

## 1. The villain, split-screen (40s)
- Left: a Polymarket/UMA dispute timeline — assertion → dispute → multi-day token vote.
- Right: FinalWhistle settling the **same class of market in one transaction**, the moment the
  proof exists. Tagline on screen: *Settled at the final whistle, proven on-chain, never voted on.*

## 2. A market is a predicate (45s)
- Open **/create**. Build `P1 Goals > 0` on a real World Cup fixture (e.g. 17588395, South Africa
  v South Korea): pick the stat, comparison, threshold; optionally show the two-stat builder
  (`P1 Goals − P2 Goals ≥ 2`). Note USDC-only collateral.
- Submit `create_market` from the wallet (send routed through `solana-resilience-kit`; watch the
  `transaction:*` lifecycle states). Show the new Market PDA + explorer link.

## 3. Take positions (35s)
- On the market page, stake **2 USDC YES** and **1 USDC NO** (the implied-probability bar moves to
  ~67% YES). Point out the parimutuel pools and the live odds driven by the TxLINE feed.

## 4. Self-settlement (50s) — the core
- Trigger settlement (the keeper's `POST /settle/:market`, or the cron). Narrate the path:
  *"The keeper pulls the TxLINE three-stage Merkle proof and calls `settle`, which **CPIs into
  `validate_stat`**. TxLINE recomputes the proof against its on-chain daily root. A tampered proof
  reverts; a valid proof returns the predicate result. P1 scored 1, 1 > 0, so YES wins — resolved
  in a single transaction, no vote, no operator."*
- Show the settle tx on Solana Explorer (devnet) and the market flip to **Resolved · YES**.

## 5. The Verifiable Settlement Receipt (45s) — the hero
- Open the **Receipt**. It shows: the predicate, the **proven stat value** (P1 Goals = 1), the
  **Merkle root**, the **winning side**, and the **settle transaction**.
- Click **re-verify**: the browser independently re-fetches the proof and recomputes the outcome,
  flipping a big green **"✓ Independently re-verified"** badge. *"Anyone — a bettor, a regulator,
  a journalist — can re-check this result from the cryptographic proof. This is the receipt that
  doesn't exist anywhere else."*

## 6. Claim + close (25s)
- Click **Claim**; winnings land (2.98 of 3.00 USDC; 2% fee from the losing pool to the treasury).
- Close: *"Objective sports markets that self-settle on a TxLINE proof — instant, trustless,
  re-verifiable. Built on TxLINE's `validate_stat`, hardened with our `solana-resilience-kit`,
  deployed on devnet today."*

## Backup / reliability beat (optional, 20s)
- Show `apps/keeper/test/reliability.test.ts` passing: settlement still lands under injected
  RPC failover / 429 / slot-lag, and correctly reports `expired` (never double-pays) when the
  blockhash dies — the production-grade story behind the one-click settle.

---

### Pre-recorded fallback
Every step above is reproducible from committed artifacts: the golden vector
(`tests/golden/stat_validation.devnet.json`), the deployed devnet program, and the
`pnpm --filter @finalwhistle/tests lifecycle` script (create → place → settle(CPI) → claim).
Run it live or play the recording — the on-chain result is identical either way.
