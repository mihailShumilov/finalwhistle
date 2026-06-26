import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import fwIdl from "../../../idl/finalwhistle.json" with { type: "json" };
import type { Finalwhistle } from "../../../idl/finalwhistle.ts";
import { loadKeeperKeypair, RPC_URL } from "../spike/config.ts";

/** Void open markets (authority = keeper) by address. Usage: pnpm … void <addr> [addr…] */
async function main(): Promise<void> {
  const addresses = process.argv.slice(2);
  if (addresses.length === 0) throw new Error("pass one or more market addresses");

  const keypair = loadKeeperKeypair();
  const connection = new anchor.web3.Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(keypair), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = new anchor.Program<Finalwhistle>(fwIdl as Finalwhistle, provider);

  for (const addr of addresses) {
    try {
      const sig = await program.methods
        .voidMarket()
        .accountsPartial({ authority: keypair.publicKey, market: new PublicKey(addr) })
        .rpc();
      console.log(`✓ voided ${addr} (${sig.slice(0, 12)}…)`);
    } catch (e) {
      console.log(`✗ ${addr}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

main().catch((err: unknown) => {
  console.error("✗ void failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
