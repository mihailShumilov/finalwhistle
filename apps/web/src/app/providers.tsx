"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { Buffer } from "buffer";
import { useMemo } from "react";
import { RPC } from "../lib/config";

// Browser polyfill — @coral-xyz/anchor / web3.js expect a global Buffer.
if (typeof window !== "undefined") {
  const w = window as unknown as { Buffer?: typeof Buffer };
  if (!w.Buffer) w.Buffer = Buffer;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Phantom + Solflare registered explicitly; other Wallet-Standard wallets (Backpack, …)
  // are auto-detected and de-duplicated by the WalletProvider.
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
