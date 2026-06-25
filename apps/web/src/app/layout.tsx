import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { WalletButton } from "../components/WalletButton";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "FinalWhistle — proven on-chain, never voted on",
  description:
    "Permissionless parametric prop-bet protocol on Solana that self-settles via TxLINE Merkle proofs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="border-b border-[var(--color-line)]">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
              <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
                <span className="text-[var(--color-grass-bright)] text-xl">⚽️</span>
                <span className="text-lg">
                  Final<span className="text-[var(--color-grass-bright)]">Whistle</span>
                </span>
              </Link>
              <div className="flex items-center gap-5 text-sm">
                <Link
                  href="/"
                  className="text-[var(--color-muted)] hover:text-[var(--color-chalk)]"
                >
                  Markets
                </Link>
                <Link
                  href="/create"
                  className="text-[var(--color-muted)] hover:text-[var(--color-chalk)]"
                >
                  Create
                </Link>
                <WalletButton />
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-5 py-10 text-xs text-[var(--color-muted)]">
            Settled at the final whistle, proven on-chain, never voted on · USDC-only · TxLINE
            cryptographic settlement
          </footer>
        </Providers>
      </body>
    </html>
  );
}
