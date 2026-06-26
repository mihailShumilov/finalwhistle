import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { WalletButton } from "../components/WalletButton";
import { Providers } from "./providers";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space",
  display: "swap",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "FinalWhistle — proven on-chain, never voted on",
  description:
    "Bet USDC on objective sports outcomes that settle themselves with a cryptographic proof at the final whistle. No oracle vote. No dispute window. No operator.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <Providers>
          <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[rgba(6,10,7,0.72)] backdrop-blur-xl">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
              <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
                <span className="anim-whistle text-xl">🏟️</span>
                <span className="display text-lg">
                  Final<span className="gradient-text">Whistle</span>
                </span>
              </Link>
              <div className="flex items-center gap-2 sm:gap-5 text-sm">
                <Link
                  href="/#markets"
                  className="hidden text-[var(--color-muted)] transition-colors hover:text-[var(--color-chalk)] sm:inline"
                >
                  Markets
                </Link>
                <Link
                  href="/#how"
                  className="hidden text-[var(--color-muted)] transition-colors hover:text-[var(--color-chalk)] sm:inline"
                >
                  How it works
                </Link>
                <Link
                  href="/create"
                  className="hidden text-[var(--color-muted)] transition-colors hover:text-[var(--color-chalk)] sm:inline"
                >
                  Create
                </Link>
                <WalletButton />
              </div>
            </nav>
          </header>
          <main>{children}</main>
          <footer className="border-t border-[var(--color-line)] bg-[var(--color-pitch-2)]">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
              <p>
                <span className="display font-semibold text-[var(--color-chalk)]">FinalWhistle</span>{" "}
                — settled at the final whistle, proven on-chain, never voted on.
              </p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="pill">
                  <span className="live-dot" /> Solana devnet
                </span>
                <span>USDC-only collateral</span>
                <span>·</span>
                <span>Powered by TxLINE Merkle proofs</span>
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
