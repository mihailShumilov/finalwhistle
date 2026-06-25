"use client";

import dynamic from "next/dynamic";

// Load client-side only to avoid SSR hydration mismatches in the wallet adapter UI.
export const WalletButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <span className="text-[var(--color-muted)] text-sm">Wallet…</span> },
);
