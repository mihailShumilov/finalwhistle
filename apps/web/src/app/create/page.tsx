"use client";

import { buildCreateMarketIx, describePredicate, marketPda } from "@finalwhistle/sdk";
import { SOCCER_STAT_LABELS } from "@finalwhistle/shared";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Field, inputCls } from "../../components/ui";
import { explorerAddr, explorerTx, USDC_MINT } from "../../lib/config";
import { program, useFinalWhistleSender } from "../../lib/sender";

type CreateResult =
  | { kind: "ok"; outcome: "confirmed" | "expired" | "failed"; market: string; signature: string }
  | { kind: "err"; message: string };

const STAT_OPTIONS = Object.entries(SOCCER_STAT_LABELS).map(([k, v]) => ({
  key: Number(k),
  label: v,
}));

export default function CreatePage() {
  const router = useRouter();
  const { send, connected, address } = useFinalWhistleSender();
  const [fixtureId, setFixtureId] = useState("17588395");
  const [statKey, setStatKey] = useState(1);
  const [comparison, setComparison] = useState<"greaterThan" | "lessThan">("greaterThan");
  const [threshold, setThreshold] = useState("0");
  const [twoStat, setTwoStat] = useState(false);
  const [statKey2, setStatKey2] = useState(2);
  const [op, setOp] = useState<"subtract" | "add">("subtract");
  const [period, setPeriod] = useState("4");
  const [closeIn, setCloseIn] = useState("5");
  const [feeBps, setFeeBps] = useState("200");
  const [usdcMint, setUsdcMint] = useState(USDC_MINT);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);

  const predicate = useMemo(
    () => ({
      fixtureId: Number(fixtureId),
      seq: 0,
      statKey,
      ...(twoStat ? { statKey2, op } : {}),
      period: Number(period),
      threshold: Number(threshold),
      comparison,
    }),
    [fixtureId, statKey, twoStat, statKey2, op, period, threshold, comparison],
  );
  const title = describePredicate(predicate);

  // On a confirmed create, take the user straight to their new market (the manual
  // "View market" link stays as a fallback). The detail page reads the account
  // directly from chain, so a just-confirmed market is immediately available.
  useEffect(() => {
    if (result?.kind !== "ok" || result.outcome !== "confirmed") return;
    const target = `/market?address=${result.market}`;
    const t = setTimeout(() => router.push(target), 1500);
    return () => clearTimeout(t);
  }, [result, router]);

  async function create() {
    if (!address) return;
    setBusy(true);
    setResult(null);
    try {
      const nonce = BigInt(Date.now());
      const creator = new PublicKey(address);
      const closeTs = Math.floor(Date.now() / 1000) + Number(closeIn) * 60;
      const ix = await buildCreateMarketIx(program(), {
        creator,
        usdcMint: new PublicKey(usdcMint),
        nonce,
        fixtureId: Number(fixtureId),
        seq: 0,
        statKey,
        ...(twoStat ? { statKey2, op } : {}),
        period: Number(period),
        threshold: Number(threshold),
        comparison,
        closeTs,
        feeBps: Number(feeBps),
        title,
      });
      const res = await send([ix]);
      const market = marketPda(creator, nonce).toBase58();
      setResult({ kind: "ok", outcome: res.outcome, market, signature: res.signature });
    } catch (e) {
      setResult({ kind: "err", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link
        href="/#fixtures"
        className="term mb-6 inline-block text-xs text-[var(--color-chalk-dim)] transition-colors hover:text-[var(--color-volt)]"
      >
        ← BACK TO THE BOARD
      </Link>
      <h1 className="score text-4xl tracking-wide sm:text-5xl">New market</h1>
      <p className="term mt-2 text-xs leading-relaxed text-[var(--color-chalk-dim)]">
        A market is a predicate over a TxLINE score stat. It self-settles when the proof is verified
        on-chain. USDC-only collateral.
      </p>

      <div className="panel mt-6">
        <div className="led-dim term px-3 py-1.5 text-[0.62rem] font-bold tracking-widest">
          PREDICATE BUILDER
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fixture id">
              <input
                className={inputCls}
                value={fixtureId}
                onChange={(e) => setFixtureId(e.target.value)}
              />
            </Field>
            <Field label="Period">
              <input
                className={inputCls}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Stat">
              <select
                className={inputCls}
                value={statKey}
                onChange={(e) => setStatKey(Number(e.target.value))}
              >
                {STAT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Comparison">
              <select
                className={inputCls}
                value={comparison}
                onChange={(e) => setComparison(e.target.value as "greaterThan" | "lessThan")}
              >
                <option value="greaterThan">greater than</option>
                <option value="lessThan">less than</option>
              </select>
            </Field>
          </div>

          <label className="term flex items-center gap-2 text-xs text-[var(--color-chalk-dim)]">
            <input
              type="checkbox"
              checked={twoStat}
              onChange={(e) => setTwoStat(e.target.checked)}
            />
            TWO-STAT MARKET (e.g. goal difference)
          </label>

          {twoStat && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Operator">
                <select
                  className={inputCls}
                  value={op}
                  onChange={(e) => setOp(e.target.value as "subtract" | "add")}
                >
                  <option value="subtract">subtract (A − B)</option>
                  <option value="add">add (A + B)</option>
                </select>
              </Field>
              <Field label="Second stat">
                <select
                  className={inputCls}
                  value={statKey2}
                  onChange={(e) => setStatKey2(Number(e.target.value))}
                >
                  {STAT_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <Field label="Threshold">
              <input
                className={inputCls}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </Field>
            <Field label="Close in (min)">
              <input
                className={inputCls}
                value={closeIn}
                onChange={(e) => setCloseIn(e.target.value)}
              />
            </Field>
            <Field label="Fee (bps)">
              <input
                className={inputCls}
                value={feeBps}
                onChange={(e) => setFeeBps(e.target.value)}
              />
            </Field>
          </div>

          <Field label="USDC mint">
            <input
              className={inputCls}
              value={usdcMint}
              onChange={(e) => setUsdcMint(e.target.value)}
            />
          </Field>

          <div className="border border-[var(--color-line-2)] bg-[var(--color-pitch)] p-3">
            <p className="label">Predicate preview</p>
            <p className="term mt-1 volt">YES ⇔ {title}</p>
          </div>

          <button
            type="button"
            className="btn btn-primary w-full justify-center"
            disabled={!connected || busy}
            onClick={create}
          >
            {busy ? "Submitting…" : connected ? "Create market" : "Connect a wallet"}
          </button>
          {result && <CreateResultPanel result={result} />}
        </div>
      </div>
    </div>
  );
}

function CreateResultPanel({ result }: { result: CreateResult }) {
  if (result.kind === "err") {
    return (
      <div className="panel panel-var p-3">
        <p className="label var">COULD NOT CREATE MARKET</p>
        <p className="term mt-1 break-words text-xs var">{result.message}</p>
      </div>
    );
  }

  const link = "term break-all underline transition-colors hover:text-[var(--color-volt)]";
  if (result.outcome === "confirmed") {
    return (
      <div className="panel p-3" style={{ borderColor: "var(--color-volt)" }}>
        <p className="label volt">✓ MARKET CREATED — CONFIRMED ON-CHAIN</p>
        <p className="term mt-1 text-xs text-[var(--color-chalk-dim)]">
          Market{" "}
          <a className={link} href={explorerAddr(result.market)} target="_blank" rel="noreferrer">
            {result.market}
          </a>
        </p>
        <p className="term mt-1 text-xs text-[var(--color-chalk-dim)]">
          Tx{" "}
          <a className={link} href={explorerTx(result.signature)} target="_blank" rel="noreferrer">
            {result.signature}
          </a>
        </p>
        <Link
          href={`/market?address=${result.market}`}
          className="btn btn-primary mt-3 w-full justify-center"
        >
          Opening your market… · View now →
        </Link>
      </div>
    );
  }

  // expired / failed: the send left the client but confirmation didn't come back clean —
  // it may still have landed, so point the user at the explorer rather than implying nothing happened.
  return (
    <div className="panel p-3" style={{ borderColor: "var(--color-amber, #d9a441)" }}>
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
