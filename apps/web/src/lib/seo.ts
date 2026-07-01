/**
 * Central SEO / GEO (generative-engine-optimisation) constants and structured data.
 *
 * Everything search engines and AI answer engines read to understand FinalWhistle lives here:
 * the canonical origin, the marketing copy, and the JSON-LD graph injected in the root layout.
 * Keep the facts here truthful and in sync with the product — AI crawlers quote them verbatim.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://finalwhistle-web.mschumilow.workers.dev"
).replace(/\/$/, "");

export const SITE_NAME = "FinalWhistle";

export const SITE_TAGLINE = "Settled by proof, not by vote";

export const SITE_DESCRIPTION =
  "FinalWhistle is a permissionless prediction market for objective sports outcomes — corners, goals, goal difference — that self-settle with a cryptographic TxLINE Merkle proof at the final whistle. No oracle vote, no dispute window, no operator. USDC-only collateral on Solana.";

export const REPO_URL = "https://github.com/mihailShumilov/solana-rpc-sdk";

/**
 * Shared social card. Child route segments that set their own `openGraph`/`twitter` object replace
 * (rather than inherit) the root's file-based image, so they reference these explicitly. Paths
 * resolve to absolute URLs via `metadataBase`.
 */
export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "FinalWhistle — settled by proof, not by vote",
} as const;
export const TWITTER_IMAGE = "/twitter-image";

/** Keywords lean into the differentiators AI/search engines use to place the product. */
export const SITE_KEYWORDS = [
  "prediction market",
  "sports prediction market",
  "Solana prediction market",
  "on-chain settlement",
  "cryptographic settlement",
  "parametric prop bets",
  "TxLINE",
  "Merkle proof oracle",
  "oracle-free settlement",
  "USDC prediction market",
  "self-settling markets",
  "verifiable settlement receipt",
  "decentralized sports betting",
];

/**
 * JSON-LD @graph. Four linked entities so both classic rich results and AI answer engines can
 * model FinalWhistle: the site, the organisation behind it, the software itself, and an FAQ that
 * answers the questions an LLM is most likely to be asked about it.
 */
export function jsonLdGraph() {
  const orgId = `${SITE_URL}/#organization`;
  const siteId = `${SITE_URL}/#website`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        slogan: "Settled at the final whistle. Proven on-chain, never voted on.",
        logo: `${SITE_URL}/icon.svg`,
        sameAs: [REPO_URL],
      },
      {
        "@type": "WebSite",
        "@id": siteId,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": orgId },
      },
      {
        "@type": ["SoftwareApplication", "FinancialProduct"],
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web (Solana devnet)",
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        isAccessibleForFree: true,
        browserRequirements: "Requires a Solana wallet (e.g. Phantom or Solflare).",
        publisher: { "@id": orgId },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "Permissionless — anyone can create or stake in a market with USDC.",
        },
        featureList: [
          "Objective, score-based sports markets (corners, goals, goal difference)",
          "Self-settlement via a TxLINE Merkle proof verified on Solana (validate_stat CPI)",
          "No oracle vote, no dispute window, no operator",
          "USDC-only parimutuel collateral",
          "Verifiable Settlement Receipt anyone can independently re-verify",
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "How does FinalWhistle settle a prediction market?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "When the match ends, a TxLINE Merkle proof of the relevant stat is verified on Solana through a validate_stat CPI. If the proof satisfies the market's predicate, the market resolves and winners are paid automatically. Settlement is deterministic: the same proof always yields the same result.",
            },
          },
          {
            "@type": "Question",
            name: "Does FinalWhistle use an oracle vote or a dispute window?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. Unlike vote-based markets where the biggest token holder can swing a disputed outcome, FinalWhistle settles objective stats from a signed data feed with a cryptographic proof. There is no oracle vote, no dispute window, and no operator who can stall, censor, or overrule a settlement.",
            },
          },
          {
            "@type": "Question",
            name: "What collateral does FinalWhistle use?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "USDC only. Stakes go into a parimutuel YES/NO pool. Collateral is never a governance token whose price and votes a whale could move.",
            },
          },
          {
            "@type": "Question",
            name: "What kinds of markets can I create?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Objective, score-based markets defined as a predicate over a real fixture stat — for example “Total corners > 10” or “Home − Away ≥ 2”. A stat, a comparison, and a number; nothing for a referee or a voter to interpret.",
            },
          },
          {
            "@type": "Question",
            name: "What is a Verifiable Settlement Receipt?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Every settlement produces a receipt showing the predicate, the proven stat values, the Merkle root, and the on-chain transaction. Anyone can re-fetch the proof, recompute the predicate in their browser, and confirm it matches the chain — no trust required.",
            },
          },
          {
            "@type": "Question",
            name: "What blockchain and data source does FinalWhistle use?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "The protocol runs on Solana and uses TxLINE as its data source. Every market and every settlement traces to a TxLINE feed and a verifiable Merkle proof.",
            },
          },
        ],
      },
    ],
  } as const;
}
