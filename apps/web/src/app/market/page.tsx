"use client";

import { buildClaimIx, buildPlacePositionIx, parseUsdc } from "@finalwhistle/sdk";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { inputCls, OddsBar, StatusBadge, Usdc } from "../../components/ui";
import { fetchMarketView, type MarketView } from "../../lib/api";
import { explorerTx } from "../../lib/config";
import { program, useFinalWhistleSender } from "../../lib/sender";

type TxResult =
  | { kind: "ok"; label: string; outcome: "confirmed" | "expired" | "failed"; signature: string }
  | { kind: "err"; message: string };

function MarketDetail({ address }: { address: string }) {
  const [market, setMarket] = useState<MarketView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const { send, status, address: wallet, connected } = useFinalWhistleSender();

  const reload = useCallback(() => {
    fetchMarketView(address)
      .then(setMarket)
      .catch((e) => setError(String(e)));
  }, [address]);
  useEffect(reload, [reload]);

  // Refresh the market after a write lands so the new pools / resolved state show. A second,
  // delayed read covers the case where the API's RPC node hasn't caught up to the just-confirmed slot.
  const refreshMarket = useCallback(() => {
    reload();
    const t = setTimeout(reload, 1500);
    return () => clearTimeout(t);
  }, [reload]);

  async function stake(side: "YES" | "NO") {
    if (!market || !wallet) return;
    setBusy(true);
    setTxResult(null);
    try {
      const ix = await buildPlacePositionIx(program(), {
        bettor: new PublicKey(wallet),
        market: new PublicKey(address),
        usdcMint: new PublicKey(market.usdcMint),
        side,
        amount: parseUsdc(amount),
      });
      const res = await send([ix]);
      setTxResult({
        kind: "ok",
        label: `Stake ${side}`,
        outcome: res.outcome,
        signature: res.signature,
      });
      refreshMarket();
    } catch (e) {
      setTxResult({ kind: "err", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    if (!market || !wallet) return;
    setBusy(true);
    setTxResult(null);
    try {
      const me = new PublicKey(wallet);
      const ix = await buildClaimIx(program(), {
        claimant: me,
        market: new PublicKey(address),
        owner: me,
        usdcMint: new PublicKey(market.usdcMint),
      });
      const res = await send([ix]);
      setTxResult({ kind: "ok", label: "Claim", outcome: res.outcome, signature: res.signature });
      refreshMarket();
    } catch (e) {
      setTxResult({ kind: "err", message: e instanceof Error ? e.message : String(e) });
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
        {txResult ? (
          <TxResultPanel result={txResult} />
        ) : status !== "idle" ? (
          <p className="term mt-3 text-xs text-[var(--color-chalk-dim)]">STATUS: {status}</p>
        ) : null}
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

function TxResultPanel({ result }: { result: TxResult }) {
  const link = "term break-all underline transition-colors hover:text-[var(--color-volt)]";
  if (result.kind === "err") {
    return (
      <div className="panel panel-var mt-3 p-3">
        <p className="label var">TRANSACTION FAILED</p>
        <p className="term mt-1 break-words text-xs var">{result.message}</p>
      </div>
    );
  }
  if (result.outcome === "confirmed") {
    return (
      <div className="panel mt-3 p-3" style={{ borderColor: "var(--color-volt)" }}>
        <p className="label volt">✓ {result.label.toUpperCase()} — CONFIRMED ON-CHAIN</p>
        <p className="term mt-1 text-xs text-[var(--color-chalk-dim)]">
          Tx{" "}
          <a className={link} href={explorerTx(result.signature)} target="_blank" rel="noreferrer">
            {result.signature}
          </a>
        </p>
      </div>
    );
  }
  return (
    <div className="panel mt-3 p-3" style={{ borderColor: "var(--color-amber, #d9a441)" }}>
      <p className="label" style={{ color: "var(--color-amber, #d9a441)" }}>
        ⚠ NOT CONFIRMED ({result.outcome.toUpperCase()})
      </p>
      <p className="term mt-1 text-xs text-[var(--color-chalk-dim)]">
        The transaction was submitted but confirmation didn’t come back. It may still have landed —
        check the explorer, then retry if it didn’t.
      </p>
      <p className="term mt-1 text-xs text-[var(--color-chalk-dim)]">
        Tx{" "}
        <a className={link} href={explorerTx(result.signature)} target="_blank" rel="noreferrer">
          {result.signature}
        </a>
      </p>
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
