import type { Metadata } from "next";
import { OG_IMAGE, SITE_URL, TWITTER_IMAGE } from "../../lib/seo";

const description =
  "Build an objective, score-based prediction market on FinalWhistle. Pick a fixture, a stat (corners, goals, goal difference), a comparison and a threshold — it self-settles with a TxLINE Merkle proof at the final whistle.";

export const metadata: Metadata = {
  title: "Create a market",
  description,
  alternates: { canonical: "/create" },
  openGraph: {
    title: "Create a market · FinalWhistle",
    description,
    url: `${SITE_URL}/create`,
    images: [OG_IMAGE],
  },
  twitter: { title: "Create a market · FinalWhistle", description, images: [TWITTER_IMAGE] },
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
