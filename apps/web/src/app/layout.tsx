import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import type { Metadata } from "next";
import { Bebas_Neue, Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { WalletButton } from "../components/WalletButton";
import { Providers } from "./providers";

const score = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jet",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "FINALWHISTLE — settled by proof, not by vote",
  description:
    "A prediction market for objective sports outcomes that settle themselves with a cryptographic proof at the final whistle. No oracle vote. No dispute window. No operator.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${score.variable} ${mono.variable} ${sans.variable}`}>
      <body>
        <Providers>
          <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[rgba(7,10,7,0.92)] backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6">
              <Link href="/" className="group flex items-baseline gap-2">
                <span className="anim-whistle text-base">🏟️</span>
                <span className="score text-2xl tracking-wide">
                  Final<span className="volt">Whistle</span>
                </span>
                <span className="label hidden border-l border-[var(--color-line)] pl-2 sm:inline">
                  v1 · devnet
                </span>
              </Link>
              <div className="flex items-center gap-1.5 sm:gap-4">
                <Link
                  href="/#fixtures"
                  className="term hidden text-xs text-[var(--color-chalk-dim)] transition-colors hover:text-[var(--color-volt)] sm:inline"
                >
                  FIXTURES
                </Link>
                <Link
                  href="/#laws"
                  className="term hidden text-xs text-[var(--color-chalk-dim)] transition-colors hover:text-[var(--color-volt)] sm:inline"
                >
                  HOW
                </Link>
                <Link
                  href="/create"
                  className="term hidden text-xs text-[var(--color-chalk-dim)] transition-colors hover:text-[var(--color-volt)] sm:inline"
                >
                  CREATE
                </Link>
                <WalletButton />
              </div>
            </div>
          </header>

          <main>{children}</main>

          <footer className="border-t border-[var(--color-line)] bg-[var(--color-ink)]">
            <div className="led-dim term flex items-center gap-4 overflow-hidden px-4 py-1.5 text-[0.62rem] sm:px-6">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="dot" /> SYSTEM NOMINAL
              </span>
              <span className="whitespace-nowrap">CLUSTER:DEVNET</span>
              <span className="hidden whitespace-nowrap sm:inline">COLLATERAL:USDC</span>
              <span className="hidden whitespace-nowrap sm:inline">ORACLE:TXLINE/MERKLE</span>
              <span className="ml-auto hidden whitespace-nowrap sm:inline">VOTES:0 · OPERATORS:0</span>
            </div>
            <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
              <p className="score text-3xl tracking-wide text-[var(--color-chalk)]">
                Settled at the final whistle.
              </p>
              <p className="term mt-2 max-w-xl text-xs leading-relaxed text-[var(--color-chalk-faint)]">
                Proven on-chain, never voted on. Markets are objective, score-based facts settled by
                TxLINE Merkle proofs on Solana — USDC-only collateral.
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
