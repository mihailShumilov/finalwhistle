# FinalWhistle — Devnet Deployment

## Live links (Cloudflare)

| Surface | URL |
|---|---|
| **Frontend** (static-export Worker) | https://finalwhistle-web.mschumilow.workers.dev |
| **Read API** (Hono Worker, Helius RPC) | https://finalwhistle-api.mschumilow.workers.dev |
| **Keeper** (Worker + Cron `*/1 * * * *`) | https://finalwhistle-keeper.mschumilow.workers.dev |

Open the frontend → the resolved **P1 Goals > 0** market → its **Verifiable Settlement
Receipt** → the green "✓ Independently re-verified" badge (the browser re-computes the outcome
from the TxLINE proof and matches the on-chain resolution).

## On-chain

| | |
|---|---|
| **FinalWhistle program** | `GSud9smJwwV6QhDLd2hmSQPShj1w8zYumz5BL3snbmao` |
| **TxLINE (txoracle) program** | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| **Cluster** | devnet |
| **Explorer** | https://explorer.solana.com/address/GSud9smJwwV6QhDLd2hmSQPShj1w8zYumz5BL3snbmao?cluster=devnet |

> Worker-side reads use a Helius devnet RPC (Worker secret) because Solana's public
> `api.devnet.solana.com` 403-blocks Cloudflare egress IPs; browser-side wallet sends use the
> public endpoint directly (not blocked).

## Proven on devnet
- Phase 1 spike: `validate_stat` single-stat + two-stat landed; tampered proof reverts; result via return-data.
- Phase 2 lifecycle: create → place(YES+NO) → **settle (CPI into validate_stat)** → claim, end-to-end.
