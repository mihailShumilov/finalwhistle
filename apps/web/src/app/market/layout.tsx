import type { Metadata } from "next";
import { OG_IMAGE, SITE_URL, TWITTER_IMAGE } from "../../lib/seo";

const description =
  "Stake USDC on YES or NO in a FinalWhistle prediction market and watch it self-settle with a cryptographic TxLINE Merkle proof at the final whistle — no oracle vote, no dispute window, no operator.";

export const metadata: Metadata = {
  title: "Market",
  description,
  alternates: { canonical: "/market" },
  openGraph: {
    title: "Market · FinalWhistle",
    description,
    url: `${SITE_URL}/market`,
    images: [OG_IMAGE],
  },
  twitter: { title: "Market · FinalWhistle", description, images: [TWITTER_IMAGE] },
};

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return children;
}
