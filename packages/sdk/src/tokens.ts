import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";

export {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

/** Associated token account for `(mint, owner)`. Pass the matching token program. */
export function ata(
  mint: PublicKey,
  owner: PublicKey,
  tokenProgram = TOKEN_PROGRAM_ID,
  allowOwnerOffCurve = true,
): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve, tokenProgram);
}
