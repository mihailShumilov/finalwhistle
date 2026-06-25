"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { Buffer } from "buffer";
import { useMemo } from "react";
import { RPC } from "../lib/config";

// Browser polyfill — @coral-xyz/anchor / web3.js expect a global Buffer.
if (typeof window !== "undefined") {
  const w = window as unknown as { Buffer?: typeof Buffer };
  if (!w.Buffer) w.Buffer = Buffer;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Phantom / Backpack register via the Wallet Standard automatically; Solflare added explicitly.
  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
