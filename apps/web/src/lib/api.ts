import type { ScoresStatValidation } from "@finalwhistle/sdk";
import { API_BASE } from "./config";

export interface MarketView {
  address: string;
  title: string;
  status: "open" | "resolved" | "voided" | string;
  fixtureId: number;
  seq: number;
  statKey: number;
  statKey2: number | null;
  op: "add" | "subtract" | null;
  period: number;
  threshold: number;
  comparison: "greaterThan" | "lessThan";
  closeTs: number;
  yesPool: string;
  noPool: string;
  feeBps: number;
  winningSide: number;
  settleTs: number;
  settleSlot: number;
  usdcMint: string;
  predicate: string;
  impliedYes: number;
}

export interface ReceiptView {
  market: MarketView;
  outcome: {
    winningSide: number;
    provenValue: number | null;
    provenSide: "YES" | "NO" | null;
    settleSlot: number;
    settleTs: number;
    settleSignature: string | null;
  };
  proof: ScoresStatValidation | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

export const fetchMarkets = () => get<MarketView[]>("/markets");
export const fetchMarketView = (address: string) => get<MarketView>(`/markets/${address}`);
export const fetchReceipt = (address: string) => get<ReceiptView>(`/receipt/${address}`);
