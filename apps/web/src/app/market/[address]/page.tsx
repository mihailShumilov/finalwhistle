"use client";

import { buildClaimIx, buildPlacePositionIx, parseUsdc } from "@finalwhistle/sdk";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { inputCls, OddsBar, StatusBadge, Usdc } from "../../../components/ui";
import { fetchMarketView, type MarketView } from "../../../lib/api";
import { program, useFinalWhistleSender } from "../../../lib/sender";

export default function MarketPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const [market, setMarket] = useState<MarketView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { send, status, address: wallet, connected } = useFinalWhistleSender();

  const reload = useCallback(() => {
    fetchMarketView(address)
      .then(setMarket)
      .catch((e) => setError(String(e)));
  }, [address]);
  useEffect(reload, [reload]);

  async function stake(side: "YES" | "NO") {
    if (!market || !wallet) return;
    setBusy(true);
    setNote(null);
    try {
      const ix = await buildPlacePositionIx(program(), {
        bettor: new PublicKey(wallet),
        market: new PublicKey(address),
        usdcMint: new PublicKey(market.usdcMint),
        side,
        amount: parseUsdc(amount),
      });
      const res = await send([ix]);
      setNote(`Stake ${side}: ${res.outcome} (${res.signature.slice(0, 12)}…)`);
      reload();
    } catch (e) {
      setNote(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    if (!market || !wallet) return;
    setBusy(true);
    setNote(null);
    try {
      const me = new PublicKey(wallet);
      const ix = await buildClaimIx(program(), {
        claimant: me,
        market: new PublicKey(address),
        owner: me,
        usdcMint: new PublicKey(market.usdcMint),
      });
      const res = await send([ix]);
      setNote(`Claim: ${res.outcome} (${res.signature.slice(0, 12)}…)`);
      reload();
    } catch (e) {
      setNote(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="card p-4 text-sm text-[var(--color-no)]">{error}</div>;
  if (!market) return <p className="text-[var(--color-muted)]">Loading…</p>;

  const open = market.status === "open";
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-[var(--color-muted)] hover:text-[var(--color-chalk)]"
      >
        ← Markets
      </Link>
      <div className="card p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{market.title || market.predicate}</h1>
            <p className="mono mt-1 text-sm text-[var(--color-muted)]">{market.predicate}</p>
          </div>
          <StatusBadge status={market.status} winningSide={market.winningSide} />
        </div>
        <OddsBar impliedYes={market.impliedYes} />
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-[var(--color-muted)]">YES pool</p>
            <Usdc baseUnits={market.yesPool} />
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)]">NO pool</p>
            <Usdc baseUnits={market.noPool} />
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)]">Closes</p>
            <span className="mono">{new Date(market.closeTs * 1000).toLocaleString()}</span>
          </div>
        </div>

        {open ? (
          <div className="mt-6 border-t border-[var(--color-line)] pt-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <span className="mb-1 block text-xs uppercase text-[var(--color-muted)]">
                  Stake (USDC)
                </span>
                <input
                  className={inputCls}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <button
                type="button"
                className="btn"
                style={{ background: "var(--color-yes)", color: "#06140c" }}
                disabled={!connected || busy}
                onClick={() => stake("YES")}
              >
                Stake YES
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: "var(--color-no)", color: "#1a0a0e" }}
                disabled={!connected || busy}
                onClick={() => stake("NO")}
              >
                Stake NO
              </button>
            </div>
            {!connected && (
              <p className="mt-2 text-xs text-[var(--color-muted)]">Connect a wallet to stake.</p>
            )}
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-5">
            <Link href={`/receipt/${address}`} className="btn btn-primary">
              View settlement receipt
            </Link>
            <button type="button" className="btn" disabled={!connected || busy} onClick={claim}>
              Claim winnings / refund
            </button>
          </div>
        )}
        {(note || status !== "idle") && (
          <p className="mt-3 text-xs text-[var(--color-muted)]">{note ?? `status: ${status}`}</p>
        )}
      </div>
    </div>
  );
}
