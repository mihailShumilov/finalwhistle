import type { Finalwhistle } from "./finalwhistle.types.js";

// Generated from target/idl/finalwhistle.json — do not edit by hand. The Anchor-generated
// type is camelCase while the runtime IDL is snake_case, so the cast goes through unknown.
export const FINALWHISTLE_IDL = {
  "address": "GSud9smJwwV6QhDLd2hmSQPShj1w8zYumz5BL3snbmao",
  "metadata": {
    "name": "finalwhistle",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "FinalWhistle — parametric prop-bet protocol that self-settles via TxLINE validate_stat CPI"
  },
  "instructions": [
    {
      "name": "claim",
      "docs": [
        "Withdraw winnings (resolved market) or a full refund (voided market)."
      ],
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "claimant",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "owner",
          "relations": [
            "position"
          ]
        },
        {
          "name": "escrow",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "claimant_usdc",
          "writable": true
        },
        {
          "name": "usdc_mint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "token_program"
        }
      ],
      "args": []
    },
    {
      "name": "create_market",
      "docs": [
        "Permissionlessly create a market from an immutable predicate and open a USDC escrow."
      ],
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "usdc_mint"
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "token_program"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u64"
        },
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "CreateMarketParams"
            }
          }
        }
      ]
    },
    {
      "name": "place_position",
      "docs": [
        "Stake USDC on the YES or NO side of an open market."
      ],
      "discriminator": [
        218,
        31,
        90,
        75,
        101,
        209,
        5,
        253
      ],
      "accounts": [
        {
          "name": "bettor",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "bettor"
              }
            ]
          }
        },
        {
          "name": "bettor_usdc",
          "writable": true
        },
        {
          "name": "escrow",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "usdc_mint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "token_program"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "side",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "settle",
      "docs": [
        "Self-settle the market: CPI into TxLINE `validate_stat` with the immutable YES",
        "predicate, read the returned bool to resolve the winning side (tampered proof reverts)."
      ],
      "discriminator": [
        175,
        42,
        185,
        87,
        144,
        131,
        102,
        212
      ],
      "accounts": [
        {
          "name": "settler",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "escrow",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "daily_scores_merkle_roots",
          "docs": [
            "`daily_scores_roots` PDA for the proof's epoch day (TimestampMismatch otherwise)."
          ]
        },
        {
          "name": "txline_program",
          "address": "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"
        },
        {
          "name": "treasury",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "treasury_usdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "usdc_mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
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
                89
              ]
            }
          }
        },
        {
          "name": "usdc_mint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "token_program"
        },
        {
          "name": "associated_token_program",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "proof",
          "type": {
            "defined": {
              "name": "SettleProof"
            }
          }
        }
      ]
    },
    {
      "name": "void_market",
      "docs": [
        "Void an open market (postponed / abandoned fixture) so bettors can refund."
      ],
      "discriminator": [
        243,
        175,
        46,
        124,
        95,
        101,
        39,
        69
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "market",
          "writable": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "Market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "Position",
      "discriminator": [
        170,
        188,
        143,
        228,
        122,
        64,
        247,
        208
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "FeeTooHigh",
      "msg": "Fee basis points exceed the protocol maximum"
    },
    {
      "code": 6001,
      "name": "CloseInPast",
      "msg": "Betting close timestamp must be in the future"
    },
    {
      "code": 6002,
      "name": "InconsistentTwoStat",
      "msg": "A two-stat market requires both a second stat key and a binary operator"
    },
    {
      "code": 6003,
      "name": "StakeTooSmall",
      "msg": "Stake amount is below the minimum"
    },
    {
      "code": 6004,
      "name": "MarketClosed",
      "msg": "Betting is closed for this market"
    },
    {
      "code": 6005,
      "name": "MarketNotOpen",
      "msg": "Market is not open"
    },
    {
      "code": 6006,
      "name": "MarketAlreadyFinalized",
      "msg": "Market has already been resolved or voided"
    },
    {
      "code": 6007,
      "name": "MarketNotResolved",
      "msg": "Market is not resolved yet"
    },
    {
      "code": 6008,
      "name": "MarketVoided",
      "msg": "Market was voided; use the void-refund path"
    },
    {
      "code": 6009,
      "name": "MarketNotVoided",
      "msg": "Market is not voided"
    },
    {
      "code": 6010,
      "name": "InvalidSide",
      "msg": "Provided side is invalid (must be YES or NO)"
    },
    {
      "code": 6011,
      "name": "MathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6012,
      "name": "EpochDayMismatch",
      "msg": "The proof timestamp does not fall on the market's settlement epoch day"
    },
    {
      "code": 6013,
      "name": "FixtureMismatch",
      "msg": "The proven fixture does not match the market's fixture"
    },
    {
      "code": 6014,
      "name": "StatKeyMismatch",
      "msg": "The proven stat key does not match the market's predicate"
    },
    {
      "code": 6015,
      "name": "PeriodMismatch",
      "msg": "The proven stat period does not match the market's predicate"
    },
    {
      "code": 6016,
      "name": "SettleBeforeClose",
      "msg": "Settlement may only run after the betting close timestamp"
    },
    {
      "code": 6017,
      "name": "InvalidOracleAccount",
      "msg": "The TxLINE daily-scores-roots account is not owned by the configured oracle program"
    },
    {
      "code": 6018,
      "name": "InvalidOracleProgram",
      "msg": "The supplied oracle program does not match the configured TxLINE program id"
    },
    {
      "code": 6019,
      "name": "NothingToClaim",
      "msg": "Caller has no winnings to claim on this market"
    },
    {
      "code": 6020,
      "name": "AlreadyClaimed",
      "msg": "Winnings already claimed"
    },
    {
      "code": 6021,
      "name": "PositionMarketMismatch",
      "msg": "Position does not belong to this market"
    },
    {
      "code": 6022,
      "name": "EqualityNotSupported",
      "msg": "Equality comparisons are not supported for two-sided settlement"
    },
    {
      "code": 6023,
      "name": "FinalityNotReached",
      "msg": "Settlement has not waited for Solana finality"
    },
    {
      "code": 6024,
      "name": "OracleNoReturnData",
      "msg": "The TxLINE validate_stat CPI returned no data"
    },
    {
      "code": 6025,
      "name": "MissingSecondStat",
      "msg": "A two-stat market requires a second stat term and operator at settlement"
    },
    {
      "code": 6026,
      "name": "UnexpectedSecondStat",
      "msg": "A single-stat market must not receive a second stat term or operator"
    },
    {
      "code": 6027,
      "name": "OperatorMismatch",
      "msg": "The binary operator does not match the market's predicate"
    }
  ],
  "types": [
    {
      "name": "BinaryOp",
      "docs": [
        "The binary operator applied between two stats in a two-stat market",
        "(`statA op statB <cmp> threshold`). Mirrors TxLINE's `BinaryExpression`."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Add"
          },
          {
            "name": "Subtract"
          }
        ]
      }
    },
    {
      "name": "Comparison",
      "docs": [
        "The comparison half of a market predicate. Mirrors TxLINE's `Comparison`, but",
        "FinalWhistle deliberately omits `EqualTo`: a two-sided parimutuel market needs a",
        "negatable predicate so the losing side can also be proven on-chain, and `!=` is not",
        "expressible as a single comparison. `GreaterThan` / `LessThan` cover totals, spreads,",
        "goal-difference and corner markets — the compelling, CFTC-friendly cases."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "GreaterThan"
          },
          {
            "name": "LessThan"
          }
        ]
      }
    },
    {
      "name": "CreateMarketParams",
      "docs": [
        "Immutable predicate + market configuration supplied at creation."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fixture_id",
            "type": "i64"
          },
          {
            "name": "seq",
            "type": "u32"
          },
          {
            "name": "stat_key",
            "type": "u32"
          },
          {
            "name": "stat_key2",
            "type": {
              "option": "u32"
            }
          },
          {
            "name": "op",
            "type": {
              "option": {
                "defined": {
                  "name": "BinaryOp"
                }
              }
            }
          },
          {
            "name": "period",
            "type": "i32"
          },
          {
            "name": "threshold",
            "type": "i32"
          },
          {
            "name": "comparison",
            "type": {
              "defined": {
                "name": "Comparison"
              }
            }
          },
          {
            "name": "close_ts",
            "type": "i64"
          },
          {
            "name": "fee_bps",
            "type": "u16"
          },
          {
            "name": "title",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "Market",
      "docs": [
        "A FinalWhistle market: an immutable cryptographic predicate over one or two TxLINE",
        "score stats, plus a parimutuel YES/NO USDC pool that self-settles when the predicate",
        "is proven against the on-chain Merkle root."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Creator / fee-config authority. Markets are permissionless; this is informational."
            ],
            "type": "pubkey"
          },
          {
            "name": "usdc_mint",
            "docs": [
              "USDC mint used for all collateral in this market."
            ],
            "type": "pubkey"
          },
          {
            "name": "escrow",
            "docs": [
              "The PDA token account holding escrowed USDC."
            ],
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "docs": [
              "Creator-chosen nonce making `(authority, nonce)` a unique market address."
            ],
            "type": "u64"
          },
          {
            "name": "fixture_id",
            "docs": [
              "TxLINE fixture id the predicate is evaluated against."
            ],
            "type": "i64"
          },
          {
            "name": "seq",
            "docs": [
              "Score-event sequence number within the fixture."
            ],
            "type": "u32"
          },
          {
            "name": "stat_key",
            "docs": [
              "Primary stat key (e.g. 1 = Participant1_Score)."
            ],
            "type": "u32"
          },
          {
            "name": "stat_key2",
            "docs": [
              "Optional second stat key for two-stat predicates."
            ],
            "type": {
              "option": "u32"
            }
          },
          {
            "name": "op",
            "docs": [
              "Optional binary operator combining the two stats."
            ],
            "type": {
              "option": {
                "defined": {
                  "name": "BinaryOp"
                }
              }
            }
          },
          {
            "name": "period",
            "docs": [
              "Period the stat(s) are measured at (validated against the proof)."
            ],
            "type": "i32"
          },
          {
            "name": "threshold",
            "docs": [
              "Predicate threshold. YES holds iff `(statA [op statB]) <comparison> threshold`."
            ],
            "type": "i32"
          },
          {
            "name": "comparison",
            "docs": [
              "YES-side comparison."
            ],
            "type": {
              "defined": {
                "name": "Comparison"
              }
            }
          },
          {
            "name": "close_ts",
            "docs": [
              "Unix timestamp after which betting closes and settlement is allowed."
            ],
            "type": "i64"
          },
          {
            "name": "yes_pool",
            "docs": [
              "Total USDC staked on YES."
            ],
            "type": "u64"
          },
          {
            "name": "no_pool",
            "docs": [
              "Total USDC staked on NO."
            ],
            "type": "u64"
          },
          {
            "name": "fee_bps",
            "docs": [
              "Protocol fee (basis points) taken from the losing pool at settlement."
            ],
            "type": "u16"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "MarketStatus"
              }
            }
          },
          {
            "name": "winning_side",
            "docs": [
              "Winning side once resolved (`SIDE_YES` / `SIDE_NO`); `SIDE_NONE` otherwise."
            ],
            "type": "u8"
          },
          {
            "name": "settle_ts",
            "docs": [
              "Proof timestamp recorded at settlement."
            ],
            "type": "i64"
          },
          {
            "name": "settle_slot",
            "docs": [
              "Solana slot at which settlement landed (finality record)."
            ],
            "type": "u64"
          },
          {
            "name": "fee_collected",
            "docs": [
              "Fee transferred to the treasury at settlement."
            ],
            "type": "u64"
          },
          {
            "name": "total_payout_pool",
            "docs": [
              "Escrow available to winners after the fee: `winning_pool + (losing_pool - fee)`."
            ],
            "type": "u64"
          },
          {
            "name": "total_claimed",
            "docs": [
              "Running tally of winnings paid out (for observability / dust accounting)."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "escrow_bump",
            "type": "u8"
          },
          {
            "name": "title",
            "docs": [
              "Short human-readable label for UIs."
            ],
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "MarketStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Open"
          },
          {
            "name": "Resolved"
          },
          {
            "name": "Voided"
          }
        ]
      }
    },
    {
      "name": "Position",
      "docs": [
        "A bettor's stake on a single market."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "yes_amount",
            "type": "u64"
          },
          {
            "name": "no_amount",
            "type": "u64"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "SettleProof",
      "docs": [
        "The proof payload supplied by the keeper at settlement. Mirrors the TxLINE",
        "`stat-validation` response. The predicate is NOT included — `settle` builds it from the",
        "immutable market config, so the caller can never bias the outcome."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ts",
            "type": "i64"
          },
          {
            "name": "fixture_summary",
            "type": {
              "defined": {
                "name": "TxScoresBatchSummary"
              }
            }
          },
          {
            "name": "fixture_proof",
            "type": {
              "vec": {
                "defined": {
                  "name": "TxProofNode"
                }
              }
            }
          },
          {
            "name": "main_tree_proof",
            "type": {
              "vec": {
                "defined": {
                  "name": "TxProofNode"
                }
              }
            }
          },
          {
            "name": "stat_a",
            "type": {
              "defined": {
                "name": "TxStatTerm"
              }
            }
          },
          {
            "name": "stat_b",
            "type": {
              "option": {
                "defined": {
                  "name": "TxStatTerm"
                }
              }
            }
          },
          {
            "name": "op",
            "type": {
              "option": {
                "defined": {
                  "name": "TxBinaryExpression"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "TxBinaryExpression",
      "docs": [
        "Variant order MUST match the TxLINE IDL `BinaryExpression` enum (Add, Subtract)."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Add"
          },
          {
            "name": "Subtract"
          }
        ]
      }
    },
    {
      "name": "TxProofNode",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "is_right_sibling",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "TxScoreStat",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "key",
            "type": "u32"
          },
          {
            "name": "value",
            "type": "i32"
          },
          {
            "name": "period",
            "type": "i32"
          }
        ]
      }
    },
    {
      "name": "TxScoresBatchSummary",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fixture_id",
            "type": "i64"
          },
          {
            "name": "update_stats",
            "type": {
              "defined": {
                "name": "TxScoresUpdateStats"
              }
            }
          },
          {
            "name": "events_sub_tree_root",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "TxScoresUpdateStats",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "update_count",
            "type": "i32"
          },
          {
            "name": "min_timestamp",
            "type": "i64"
          },
          {
            "name": "max_timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "TxStatTerm",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stat_to_prove",
            "type": {
              "defined": {
                "name": "TxScoreStat"
              }
            }
          },
          {
            "name": "event_stat_root",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "stat_proof",
            "type": {
              "vec": {
                "defined": {
                  "name": "TxProofNode"
                }
              }
            }
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "DEFAULT_FEE_BPS",
      "docs": [
        "Protocol fee charged on the losing pool at settlement, in basis points (2.00%)."
      ],
      "type": "u16",
      "value": "200"
    },
    {
      "name": "ESCROW_SEED",
      "docs": [
        "PDA seed for a market's USDC escrow token account."
      ],
      "type": "bytes",
      "value": "[101, 115, 99, 114, 111, 119]"
    },
    {
      "name": "MARKET_SEED",
      "docs": [
        "PDA seed for a market account."
      ],
      "type": "bytes",
      "value": "[109, 97, 114, 107, 101, 116]"
    },
    {
      "name": "MAX_FEE_BPS",
      "docs": [
        "Hard ceiling on the configurable fee (10.00%) — a creator can never set more."
      ],
      "type": "u16",
      "value": "1000"
    },
    {
      "name": "MIN_STAKE",
      "docs": [
        "Minimum stake per position action, in USDC base units (0.01 USDC at 6 decimals)."
      ],
      "type": "u64",
      "value": "10000"
    },
    {
      "name": "POSITION_SEED",
      "docs": [
        "PDA seed for a bettor's per-market position account."
      ],
      "type": "bytes",
      "value": "[112, 111, 115, 105, 116, 105, 111, 110]"
    },
    {
      "name": "TREASURY_SEED",
      "docs": [
        "PDA seed for the protocol treasury authority."
      ],
      "type": "bytes",
      "value": "[116, 114, 101, 97, 115, 117, 114, 121]"
    },
    {
      "name": "TXLINE_DAILY_SCORES_SEED",
      "docs": [
        "PDA seed used by the TxLINE oracle for its daily scores Merkle roots account.",
        "Seed layout: `[\"daily_scores_roots\", epoch_day as u16 little-endian]`."
      ],
      "type": "bytes",
      "value": "[100, 97, 105, 108, 121, 95, 115, 99, 111, 114, 101, 115, 95, 114, 111, 111, 116, 115]"
    }
  ]
} as unknown as Finalwhistle;
