"use client";

import { buildClaimIx, buildPlacePositionIx, parseUsdc } from "@finalwhistle/sdk";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { inputCls, OddsBar, StatusBadge, Usdc } from "../../components/ui";
import { fetchMarketView, type MarketView } from "../../lib/api";
import { program, useFinalWhistleSender } from "../../lib/sender";

function MarketDetail({ address }: { address: string }) {
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
      setNote(`STAKE ${side}: ${res.outcome} (${res.signature.slice(0, 12)}…)`);
      reload();
    } catch (e) {
      setNote(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
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
      setNote(`CLAIM: ${res.outcome} (${res.signature.slice(0, 12)}…)`);
      reload();
    } catch (e) {
      setNote(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="panel panel-var p-4 term text-xs var">{error}</div>;
  if (!market) return <p className="term text-xs text-[var(--color-chalk-dim)]">LOADING…</p>;

  const open = market.status === "open";
  return (
    <div className="panel crt">
      <div className="led flex items-center justify-between px-3 py-1.5">
        <span className="term text-[0.66rem] font-bold tracking-widest">⬢ MARKET TERMINAL</span>
        <span className="term text-[0.62rem] font-bold tracking-widest opacity-80">
          #{market.fixtureId}
        </span>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="score text-3xl tracking-wide sm:text-4xl">
              {market.title || market.predicate}
            </h1>
            <p className="term mt-1 text-xs text-[var(--color-chalk-faint)]">{market.predicate}</p>
          </div>
          <StatusBadge status={market.status} winningSide={market.winningSide} />
        </div>

        <div className="my-6">
          <OddsBar impliedYes={market.impliedYes} />
        </div>

        <div className="grid grid-cols-3 gap-px border border-[var(--color-line)] bg-[var(--color-line)]">
          <Box k="YES pool">
            <Usdc baseUnits={market.yesPool} />
          </Box>
          <Box k="NO pool">
            <Usdc baseUnits={market.noPool} />
          </Box>
          <Box k="Closes">
            <span className="term text-xs">{new Date(market.closeTs * 1000).toLocaleString()}</span>
          </Box>
        </div>

        {open ? (
          <div className="mt-6 border-t border-[var(--color-line)] pt-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <span className="label mb-1.5 block">Stake (USDC)</span>
                <input
                  className={inputCls}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!connected || busy}
                onClick={() => stake("YES")}
              >
                Stake YES
              </button>
              <button
                type="button"
                className="btn"
                style={{ borderColor: "var(--color-var)", color: "var(--color-var)" }}
                disabled={!connected || busy}
                onClick={() => stake("NO")}
              >
                Stake NO
              </button>
            </div>
            {!connected && (
              <p className="term mt-2 text-xs text-[var(--color-chalk-dim)]">
                Connect a wallet to stake.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-5">
            <Link href={`/receipt?address=${address}`} className="btn btn-primary">
              View settlement receipt
            </Link>
            <button type="button" className="btn" disabled={!connected || busy} onClick={claim}>
              Claim winnings / refund
            </button>
          </div>
        )}
        {(note || status !== "idle") && (
          <p className="term mt-3 text-xs text-[var(--color-chalk-dim)]">
            {note ?? `STATUS: ${status}`}
          </p>
        )}
      </div>
    </div>
  );
}

function Box({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-ink)] px-3 py-2.5">
      <p className="label">{k}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function MarketInner() {
  const address = useSearchParams().get("address");
  if (!address)
    return <p className="term text-xs text-[var(--color-chalk-dim)]">No market address.</p>;
  return <MarketDetail address={address} />;
}

export default function MarketPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/#fixtures"
        className="term mb-6 inline-block text-xs text-[var(--color-chalk-dim)] transition-colors hover:text-[var(--color-volt)]"
      >
        ← BACK TO THE BOARD
      </Link>
      <Suspense fallback={<p className="term text-xs text-[var(--color-chalk-dim)]">LOADING…</p>}>
        <MarketInner />
      </Suspense>
    </div>
  );
}
