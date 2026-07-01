import type { Metadata } from "next";
import { OG_IMAGE, SITE_URL, TWITTER_IMAGE } from "../../lib/seo";

const description =
  "Look up a FinalWhistle settlement and independently re-verify it: re-fetch the TxLINE proof, recompute the predicate in your browser, and confirm it matches the on-chain result. No trust required.";

export const metadata: Metadata = {
  title: "Verifiable Settlement Receipt",
  description,
  alternates: { canonical: "/receipt" },
  openGraph: {
    title: "Verifiable Settlement Receipt · FinalWhistle",
    description,
    url: `${SITE_URL}/receipt`,
    images: [OG_IMAGE],
  },
  twitter: {
    title: "Verifiable Settlement Receipt · FinalWhistle",
    description,
    images: [TWITTER_IMAGE],
  },
};

export default function ReceiptLayout({ children }: { children: React.ReactNode }) {
  return children;
}
