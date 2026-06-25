export const CLUSTER = (process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") as "devnet" | "mainnet-beta";
export const RPC = process.env.NEXT_PUBLIC_RPC ?? "https://api.devnet.solana.com";
export const RPC_BACKUP = process.env.NEXT_PUBLIC_RPC_BACKUP ?? RPC;
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:7791";
export const PROGRAM_ID =
  process.env.NEXT_PUBLIC_FINALWHISTLE_PROGRAM_ID ?? "GSud9smJwwV6QhDLd2hmSQPShj1w8zYumz5BL3snbmao";
export const TXLINE_PROGRAM_ID =
  process.env.NEXT_PUBLIC_TXLINE_PROGRAM_ID ?? "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
export const USDC_MINT =
  process.env.NEXT_PUBLIC_USDC_MINT ?? "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";

export const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
export const explorerAddr = (addr: string) =>
  `https://explorer.solana.com/address/${addr}?cluster=${CLUSTER}`;
