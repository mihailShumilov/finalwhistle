# FinalWhistle — Diagrams

## System architecture

```mermaid
flowchart TB
  subgraph TxLINE["TxLINE / TxODDS (oracle)"]
    SSE["Scores + odds SSE\n(free World Cup tier)"]
    API["Off-chain API\n/api/scores/stat-validation"]
    VS["validate_stat\n(on-chain, CPI-able)"]
    ROOTS[("daily_scores_roots PDA\nMerkle roots")]
  end

  subgraph Edge["Cloudflare Workers (edge)"]
    WEB["apps/web — Next.js 16\nMarkets · Create · Receipt verifier"]
    READAPI["apps/api — Hono read API\n/markets · /receipt"]
    KEEPER["apps/keeper — Worker + Cron\nwatch FT → settle"]
  end

  subgraph Chain["Solana"]
    PROG["programs/finalwhistle (Anchor)\ncreate · place · settle · claim · void"]
    ESCROW[("USDC escrow PDA")]
  end

  USER(("User / wallet"))

  USER -->|connect, stake USDC, claim| WEB
  WEB -->|reads markets + receipts| READAPI
  READAPI -->|getProgramAccounts / getAccountInfo| PROG
  SSE --> KEEPER
  KEEPER -->|GET stat-validation proof| API
  KEEPER -->|settle proof| PROG
  WEB -->|place_position / claim| PROG
  PROG -->|CPI| VS
  VS --> ROOTS
  PROG --> ESCROW

  WEB & READAPI & KEEPER -.->|all RPC + sends via\nsolana-resilience-kit| RPC[["ResilientRpcPool\nTransactionSender"]]
  RPC --> Chain
```

## Settlement sequence

```mermaid
sequenceDiagram
  autonumber
  participant K as Keeper (Worker)
  participant T as TxLINE API
  participant S as FinalWhistle.settle
  participant V as TxLINE.validate_stat
  participant R as daily_scores_roots PDA
  participant E as USDC escrow

  K->>T: GET /api/scores/stat-validation (fixtureId, seq, statKey[,statKey2])
  T-->>K: three-stage Merkle proof + statToProve (value, period)
  K->>S: settle(proof)  [via solana-resilience-kit, +1.4M CU]
  Note over S: bind proof to market\n(stat_key / period / fixture / op)
  S->>V: CPI validate_stat(ts=minTimestamp, summary, proofs, YES predicate, statA[,statB,op])
  V->>R: recompute Merkle path vs on-chain root
  alt proof tampered / invalid
    V-->>S: REVERT  ⇒ settle reverts (escrow untouched)
  else proof valid
    V-->>S: return_data = bool (predicate held?)
    S->>S: winning_side = bool ? YES : NO
    S->>E: transfer fee → treasury ; status = Resolved
  end
  Note over K,E: later — winners call claim() → pro-rata USDC ; receipt re-verifies in browser
```

## Oracle comparison

```mermaid
flowchart LR
  subgraph UMA["Polymarket / UMA — optimistic oracle"]
    U1["Result asserted"] --> U2{"Disputed?"}
    U2 -->|yes| U3["Token-weighted VOTE\n(pays the majority, not the truth)"]
    U3 --> U4["Days of delay\n~9 wallets ≈ half the voting power\n→ whale capture ($237M Zelensky)"]
    U2 -->|no| U5["Settles after window"]
  end

  subgraph OP["Kalshi / Drift / SX — operator"]
    O1["Operator confirms"] --> O2["Writes AND judges its own rules\n(single point of failure)"]
  end

  subgraph FW["FinalWhistle — cryptographic proof"]
    F1["Merkle proof submitted"] --> F2["CPI validate_stat\nrecompute vs on-chain root"]
    F2 --> F3["Atomic payout in ONE tx\nno vote · no window · no operator\nanyone can re-verify"]
  end
```
