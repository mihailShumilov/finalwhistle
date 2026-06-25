"use client";

import { buildCreateMarketIx, describePredicate, marketPda } from "@finalwhistle/sdk";
import { SOCCER_STAT_LABELS } from "@finalwhistle/shared";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Field, inputCls } from "../../components/ui";
import { USDC_MINT } from "../../lib/config";
import { program, useFinalWhistleSender } from "../../lib/sender";

const STAT_OPTIONS = Object.entries(SOCCER_STAT_LABELS).map(([k, v]) => ({
  key: Number(k),
  label: v,
}));

export default function CreatePage() {
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
  const [result, setResult] = useState<string | null>(null);

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
      setResult(`${res.outcome}: market ${market}`);
    } catch (e) {
      setResult(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-[var(--color-muted)] hover:text-[var(--color-chalk)]"
      >
        ← Markets
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Create a market</h1>
      <p className="mb-6 text-sm text-[var(--color-muted)]">
        A market is a predicate over a TxLINE score stat. It self-settles when the proof is verified
        on-chain. USDC-only collateral.
      </p>

      <div className="card space-y-4 p-6">
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

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={twoStat} onChange={(e) => setTwoStat(e.target.checked)} />
          Two-stat market (e.g. goal difference)
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

        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-pitch)] p-3">
          <p className="text-xs uppercase text-[var(--color-muted)]">Predicate preview</p>
          <p className="mono mt-1 text-[var(--color-grass-bright)]">YES ⇔ {title}</p>
        </div>

        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={!connected || busy}
          onClick={create}
        >
          {busy ? "Submitting…" : connected ? "Create market" : "Connect a wallet"}
        </button>
        {result && <p className="mono break-all text-xs text-[var(--color-muted)]">{result}</p>}
      </div>
    </div>
  );
}
