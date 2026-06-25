/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/finalwhistle.json`.
 */
export type Finalwhistle = {
  address: "GSud9smJwwV6QhDLd2hmSQPShj1w8zYumz5BL3snbmao";
  metadata: {
    name: "finalwhistle";
    version: "0.1.0";
    spec: "0.1.0";
    description: "FinalWhistle — parametric prop-bet protocol that self-settles via TxLINE validate_stat CPI";
  };
  instructions: [
    {
      name: "claim";
      docs: ["Withdraw winnings (resolved market) or a full refund (voided market)."];
      discriminator: [62, 198, 214, 193, 213, 159, 108, 210];
      accounts: [
        {
          name: "claimant";
          writable: true;
          signer: true;
        },
        {
          name: "market";
          writable: true;
        },
        {
          name: "position";
          writable: true;
        },
        {
          name: "owner";
          relations: ["position"];
        },
        {
          name: "escrow";
          writable: true;
          relations: ["market"];
        },
        {
          name: "claimantUsdc";
          writable: true;
        },
        {
          name: "usdcMint";
          relations: ["market"];
        },
        {
          name: "tokenProgram";
        },
      ];
      args: [];
    },
    {
      name: "createMarket";
      docs: [
        "Permissionlessly create a market from an immutable predicate and open a USDC escrow.",
      ];
      discriminator: [103, 226, 97, 235, 200, 188, 251, 254];
      accounts: [
        {
          name: "creator";
          writable: true;
          signer: true;
        },
        {
          name: "usdcMint";
        },
        {
          name: "market";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: "account";
                path: "creator";
              },
              {
                kind: "arg";
                path: "nonce";
              },
            ];
          };
        },
        {
          name: "escrow";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [101, 115, 99, 114, 111, 119];
              },
              {
                kind: "account";
                path: "market";
              },
            ];
          };
        },
        {
          name: "tokenProgram";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "nonce";
          type: "u64";
        },
        {
          name: "params";
          type: {
            defined: {
              name: "createMarketParams";
            };
          };
        },
      ];
    },
    {
      name: "placePosition";
      docs: ["Stake USDC on the YES or NO side of an open market."];
      discriminator: [218, 31, 90, 75, 101, 209, 5, 253];
      accounts: [
        {
          name: "bettor";
          writable: true;
          signer: true;
        },
        {
          name: "market";
          writable: true;
        },
        {
          name: "position";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "market";
              },
              {
                kind: "account";
                path: "bettor";
              },
            ];
          };
        },
        {
          name: "bettorUsdc";
          writable: true;
        },
        {
          name: "escrow";
          writable: true;
          relations: ["market"];
        },
        {
          name: "usdcMint";
          relations: ["market"];
        },
        {
          name: "tokenProgram";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "side";
          type: "u8";
        },
        {
          name: "amount";
          type: "u64";
        },
      ];
    },
    {
      name: "settle";
      docs: [
        "Self-settle the market: CPI into TxLINE `validate_stat` with the immutable YES",
        "predicate, read the returned bool to resolve the winning side (tampered proof reverts).",
      ];
      discriminator: [175, 42, 185, 87, 144, 131, 102, 212];
      accounts: [
        {
          name: "settler";
          writable: true;
          signer: true;
        },
        {
          name: "market";
          writable: true;
        },
        {
          name: "escrow";
          writable: true;
          relations: ["market"];
        },
        {
          name: "dailyScoresMerkleRoots";
          docs: [
            "`daily_scores_roots` PDA for the proof's epoch day (TimestampMismatch otherwise).",
          ];
        },
        {
          name: "txlineProgram";
          address: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
        },
        {
          name: "treasury";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [116, 114, 101, 97, 115, 117, 114, 121];
              },
            ];
          };
        },
        {
          name: "treasuryUsdc";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "treasury";
              },
              {
                kind: "account";
                path: "tokenProgram";
              },
              {
                kind: "account";
                path: "usdcMint";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "usdcMint";
          relations: ["market"];
        },
        {
          name: "tokenProgram";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "proof";
          type: {
            defined: {
              name: "settleProof";
            };
          };
        },
      ];
    },
    {
      name: "voidMarket";
      docs: ["Void an open market (postponed / abandoned fixture) so bettors can refund."];
      discriminator: [243, 175, 46, 124, 95, 101, 39, 69];
      accounts: [
        {
          name: "authority";
          signer: true;
          relations: ["market"];
        },
        {
          name: "market";
          writable: true;
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: "market";
      discriminator: [219, 190, 213, 55, 0, 227, 198, 154];
    },
    {
      name: "position";
      discriminator: [170, 188, 143, 228, 122, 64, 247, 208];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "feeTooHigh";
      msg: "Fee basis points exceed the protocol maximum";
    },
    {
      code: 6001;
      name: "closeInPast";
      msg: "Betting close timestamp must be in the future";
    },
    {
      code: 6002;
      name: "inconsistentTwoStat";
      msg: "A two-stat market requires both a second stat key and a binary operator";
    },
    {
      code: 6003;
      name: "stakeTooSmall";
      msg: "Stake amount is below the minimum";
    },
    {
      code: 6004;
      name: "marketClosed";
      msg: "Betting is closed for this market";
    },
    {
      code: 6005;
      name: "marketNotOpen";
      msg: "Market is not open";
    },
    {
      code: 6006;
      name: "marketAlreadyFinalized";
      msg: "Market has already been resolved or voided";
    },
    {
      code: 6007;
      name: "marketNotResolved";
      msg: "Market is not resolved yet";
    },
    {
      code: 6008;
      name: "marketVoided";
      msg: "Market was voided; use the void-refund path";
    },
    {
      code: 6009;
      name: "marketNotVoided";
      msg: "Market is not voided";
    },
    {
      code: 6010;
      name: "invalidSide";
      msg: "Provided side is invalid (must be YES or NO)";
    },
    {
      code: 6011;
      name: "mathOverflow";
      msg: "Arithmetic overflow";
    },
    {
      code: 6012;
      name: "epochDayMismatch";
      msg: "The proof timestamp does not fall on the market's settlement epoch day";
    },
    {
      code: 6013;
      name: "fixtureMismatch";
      msg: "The proven fixture does not match the market's fixture";
    },
    {
      code: 6014;
      name: "statKeyMismatch";
      msg: "The proven stat key does not match the market's predicate";
    },
    {
      code: 6015;
      name: "periodMismatch";
      msg: "The proven stat period does not match the market's predicate";
    },
    {
      code: 6016;
      name: "settleBeforeClose";
      msg: "Settlement may only run after the betting close timestamp";
    },
    {
      code: 6017;
      name: "invalidOracleAccount";
      msg: "The TxLINE daily-scores-roots account is not owned by the configured oracle program";
    },
    {
      code: 6018;
      name: "invalidOracleProgram";
      msg: "The supplied oracle program does not match the configured TxLINE program id";
    },
    {
      code: 6019;
      name: "nothingToClaim";
      msg: "Caller has no winnings to claim on this market";
    },
    {
      code: 6020;
      name: "alreadyClaimed";
      msg: "Winnings already claimed";
    },
    {
      code: 6021;
      name: "positionMarketMismatch";
      msg: "Position does not belong to this market";
    },
    {
      code: 6022;
      name: "equalityNotSupported";
      msg: "Equality comparisons are not supported for two-sided settlement";
    },
    {
      code: 6023;
      name: "finalityNotReached";
      msg: "Settlement has not waited for Solana finality";
    },
    {
      code: 6024;
      name: "oracleNoReturnData";
      msg: "The TxLINE validate_stat CPI returned no data";
    },
    {
      code: 6025;
      name: "missingSecondStat";
      msg: "A two-stat market requires a second stat term and operator at settlement";
    },
    {
      code: 6026;
      name: "unexpectedSecondStat";
      msg: "A single-stat market must not receive a second stat term or operator";
    },
    {
      code: 6027;
      name: "operatorMismatch";
      msg: "The binary operator does not match the market's predicate";
    },
  ];
  types: [
    {
      name: "binaryOp";
      docs: [
        "The binary operator applied between two stats in a two-stat market",
        "(`statA op statB <cmp> threshold`). Mirrors TxLINE's `BinaryExpression`.",
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "add";
          },
          {
            name: "subtract";
          },
        ];
      };
    },
    {
      name: "comparison";
      docs: [
        "The comparison half of a market predicate. Mirrors TxLINE's `Comparison`, but",
        "FinalWhistle deliberately omits `EqualTo`: a two-sided parimutuel market needs a",
        "negatable predicate so the losing side can also be proven on-chain, and `!=` is not",
        "expressible as a single comparison. `GreaterThan` / `LessThan` cover totals, spreads,",
        "goal-difference and corner markets — the compelling, CFTC-friendly cases.",
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "greaterThan";
          },
          {
            name: "lessThan";
          },
        ];
      };
    },
    {
      name: "createMarketParams";
      docs: ["Immutable predicate + market configuration supplied at creation."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "fixtureId";
            type: "i64";
          },
          {
            name: "seq";
            type: "u32";
          },
          {
            name: "statKey";
            type: "u32";
          },
          {
            name: "statKey2";
            type: {
              option: "u32";
            };
          },
          {
            name: "op";
            type: {
              option: {
                defined: {
                  name: "binaryOp";
                };
              };
            };
          },
          {
            name: "period";
            type: "i32";
          },
          {
            name: "threshold";
            type: "i32";
          },
          {
            name: "comparison";
            type: {
              defined: {
                name: "comparison";
              };
            };
          },
          {
            name: "closeTs";
            type: "i64";
          },
          {
            name: "feeBps";
            type: "u16";
          },
          {
            name: "title";
            type: "string";
          },
        ];
      };
    },
    {
      name: "market";
      docs: [
        "A FinalWhistle market: an immutable cryptographic predicate over one or two TxLINE",
        "score stats, plus a parimutuel YES/NO USDC pool that self-settles when the predicate",
        "is proven against the on-chain Merkle root.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            docs: [
              "Creator / fee-config authority. Markets are permissionless; this is informational.",
            ];
            type: "pubkey";
          },
          {
            name: "usdcMint";
            docs: ["USDC mint used for all collateral in this market."];
            type: "pubkey";
          },
          {
            name: "escrow";
            docs: ["The PDA token account holding escrowed USDC."];
            type: "pubkey";
          },
          {
            name: "nonce";
            docs: ["Creator-chosen nonce making `(authority, nonce)` a unique market address."];
            type: "u64";
          },
          {
            name: "fixtureId";
            docs: ["TxLINE fixture id the predicate is evaluated against."];
            type: "i64";
          },
          {
            name: "seq";
            docs: ["Score-event sequence number within the fixture."];
            type: "u32";
          },
          {
            name: "statKey";
            docs: ["Primary stat key (e.g. 1 = Participant1_Score)."];
            type: "u32";
          },
          {
            name: "statKey2";
            docs: ["Optional second stat key for two-stat predicates."];
            type: {
              option: "u32";
            };
          },
          {
            name: "op";
            docs: ["Optional binary operator combining the two stats."];
            type: {
              option: {
                defined: {
                  name: "binaryOp";
                };
              };
            };
          },
          {
            name: "period";
            docs: ["Period the stat(s) are measured at (validated against the proof)."];
            type: "i32";
          },
          {
            name: "threshold";
            docs: [
              "Predicate threshold. YES holds iff `(statA [op statB]) <comparison> threshold`.",
            ];
            type: "i32";
          },
          {
            name: "comparison";
            docs: ["YES-side comparison."];
            type: {
              defined: {
                name: "comparison";
              };
            };
          },
          {
            name: "closeTs";
            docs: ["Unix timestamp after which betting closes and settlement is allowed."];
            type: "i64";
          },
          {
            name: "yesPool";
            docs: ["Total USDC staked on YES."];
            type: "u64";
          },
          {
            name: "noPool";
            docs: ["Total USDC staked on NO."];
            type: "u64";
          },
          {
            name: "feeBps";
            docs: ["Protocol fee (basis points) taken from the losing pool at settlement."];
            type: "u16";
          },
          {
            name: "status";
            type: {
              defined: {
                name: "marketStatus";
              };
            };
          },
          {
            name: "winningSide";
            docs: ["Winning side once resolved (`SIDE_YES` / `SIDE_NO`); `SIDE_NONE` otherwise."];
            type: "u8";
          },
          {
            name: "settleTs";
            docs: ["Proof timestamp recorded at settlement."];
            type: "i64";
          },
          {
            name: "settleSlot";
            docs: ["Solana slot at which settlement landed (finality record)."];
            type: "u64";
          },
          {
            name: "feeCollected";
            docs: ["Fee transferred to the treasury at settlement."];
            type: "u64";
          },
          {
            name: "totalPayoutPool";
            docs: [
              "Escrow available to winners after the fee: `winning_pool + (losing_pool - fee)`.",
            ];
            type: "u64";
          },
          {
            name: "totalClaimed";
            docs: ["Running tally of winnings paid out (for observability / dust accounting)."];
            type: "u64";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "escrowBump";
            type: "u8";
          },
          {
            name: "title";
            docs: ["Short human-readable label for UIs."];
            type: "string";
          },
        ];
      };
    },
    {
      name: "marketStatus";
      type: {
        kind: "enum";
        variants: [
          {
            name: "open";
          },
          {
            name: "resolved";
          },
          {
            name: "voided";
          },
        ];
      };
    },
    {
      name: "position";
      docs: ["A bettor's stake on a single market."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "market";
            type: "pubkey";
          },
          {
            name: "owner";
            type: "pubkey";
          },
          {
            name: "yesAmount";
            type: "u64";
          },
          {
            name: "noAmount";
            type: "u64";
          },
          {
            name: "claimed";
            type: "bool";
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "settleProof";
      docs: [
        "The proof payload supplied by the keeper at settlement. Mirrors the TxLINE",
        "`stat-validation` response. The predicate is NOT included — `settle` builds it from the",
        "immutable market config, so the caller can never bias the outcome.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "ts";
            type: "i64";
          },
          {
            name: "fixtureSummary";
            type: {
              defined: {
                name: "txScoresBatchSummary";
              };
            };
          },
          {
            name: "fixtureProof";
            type: {
              vec: {
                defined: {
                  name: "txProofNode";
                };
              };
            };
          },
          {
            name: "mainTreeProof";
            type: {
              vec: {
                defined: {
                  name: "txProofNode";
                };
              };
            };
          },
          {
            name: "statA";
            type: {
              defined: {
                name: "txStatTerm";
              };
            };
          },
          {
            name: "statB";
            type: {
              option: {
                defined: {
                  name: "txStatTerm";
                };
              };
            };
          },
          {
            name: "op";
            type: {
              option: {
                defined: {
                  name: "txBinaryExpression";
                };
              };
            };
          },
        ];
      };
    },
    {
      name: "txBinaryExpression";
      docs: ["Variant order MUST match the TxLINE IDL `BinaryExpression` enum (Add, Subtract)."];
      type: {
        kind: "enum";
        variants: [
          {
            name: "add";
          },
          {
            name: "subtract";
          },
        ];
      };
    },
    {
      name: "txProofNode";
      type: {
        kind: "struct";
        fields: [
          {
            name: "hash";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "isRightSibling";
            type: "bool";
          },
        ];
      };
    },
    {
      name: "txScoreStat";
      type: {
        kind: "struct";
        fields: [
          {
            name: "key";
            type: "u32";
          },
          {
            name: "value";
            type: "i32";
          },
          {
            name: "period";
            type: "i32";
          },
        ];
      };
    },
    {
      name: "txScoresBatchSummary";
      type: {
        kind: "struct";
        fields: [
          {
            name: "fixtureId";
            type: "i64";
          },
          {
            name: "updateStats";
            type: {
              defined: {
                name: "txScoresUpdateStats";
              };
            };
          },
          {
            name: "eventsSubTreeRoot";
            type: {
              array: ["u8", 32];
            };
          },
        ];
      };
    },
    {
      name: "txScoresUpdateStats";
      type: {
        kind: "struct";
        fields: [
          {
            name: "updateCount";
            type: "i32";
          },
          {
            name: "minTimestamp";
            type: "i64";
          },
          {
            name: "maxTimestamp";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "txStatTerm";
      type: {
        kind: "struct";
        fields: [
          {
            name: "statToProve";
            type: {
              defined: {
                name: "txScoreStat";
              };
            };
          },
          {
            name: "eventStatRoot";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "statProof";
            type: {
              vec: {
                defined: {
                  name: "txProofNode";
                };
              };
            };
          },
        ];
      };
    },
  ];
  constants: [
    {
      name: "defaultFeeBps";
      docs: ["Protocol fee charged on the losing pool at settlement, in basis points (2.00%)."];
      type: "u16";
      value: "200";
    },
    {
      name: "escrowSeed";
      docs: ["PDA seed for a market's USDC escrow token account."];
      type: "bytes";
      value: "[101, 115, 99, 114, 111, 119]";
    },
    {
      name: "marketSeed";
      docs: ["PDA seed for a market account."];
      type: "bytes";
      value: "[109, 97, 114, 107, 101, 116]";
    },
    {
      name: "maxFeeBps";
      docs: ["Hard ceiling on the configurable fee (10.00%) — a creator can never set more."];
      type: "u16";
      value: "1000";
    },
    {
      name: "minStake";
      docs: ["Minimum stake per position action, in USDC base units (0.01 USDC at 6 decimals)."];
      type: "u64";
      value: "10000";
    },
    {
      name: "positionSeed";
      docs: ["PDA seed for a bettor's per-market position account."];
      type: "bytes";
      value: "[112, 111, 115, 105, 116, 105, 111, 110]";
    },
    {
      name: "treasurySeed";
      docs: ["PDA seed for the protocol treasury authority."];
      type: "bytes";
      value: "[116, 114, 101, 97, 115, 117, 114, 121]";
    },
    {
      name: "txlineDailyScoresSeed";
      docs: [
        "PDA seed used by the TxLINE oracle for its daily scores Merkle roots account.",
        'Seed layout: `["daily_scores_roots", epoch_day as u16 little-endian]`.',
      ];
      type: "bytes";
      value: "[100, 97, 105, 108, 121, 95, 115, 99, 111, 114, 101, 115, 95, 114, 111, 111, 116, 115]";
    },
  ];
};
