# FinalWhistle — Devnet Deployment

| | |
|---|---|
| **FinalWhistle program** | `GSud9smJwwV6QhDLd2hmSQPShj1w8zYumz5BL3snbmao` |
| **TxLINE (txoracle) program** | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| **Cluster** | devnet |
| **Explorer** | https://explorer.solana.com/address/GSud9smJwwV6QhDLd2hmSQPShj1w8zYumz5BL3snbmao?cluster=devnet |

## Proven on devnet
- Phase 1 spike: `validate_stat` single-stat + two-stat landed; tampered proof reverts; result via return-data.
- Phase 2 lifecycle: create → place(YES+NO) → **settle (CPI into validate_stat)** → claim, end-to-end.
