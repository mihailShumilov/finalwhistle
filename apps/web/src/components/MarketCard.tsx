"use client";

import { formatUsdc } from "@finalwhistle/sdk";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { MarketView } from "../lib/api";
import { StatusBadge } from "./ui";

/** Odds bar that animates its split on mount for a "live" feel. */
function LiveOdds({ impliedYes }: { impliedYes: number }) {
  const target = Math.round(impliedYes * 100);
  const [w, setW] = useState(50);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs font-semibold">
        <span className="text-[var(--color-yes)]">YES {target}%</span>
        <span className="text-[var(--color-no)]">{100 - target}% NO</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--color-line)]">
        <div
          className="grow-x h-full"
          style={{ width: `${w}%`, background: "linear-gradient(90deg,#16a34a,#2bdc6e)" }}
        />
        <div className="h-full flex-1" style={{ background: "linear-gradient(90deg,#fb5577,#b91c47)" }} />
      </div>
    </div>
  );
}

export function MarketCard({ m }: { m: MarketView }) {
  const pool = formatUsdc(BigInt(m.yesPool) + BigInt(m.noPool));
  const open = m.status === "open";
  const resolved = m.status === "resolved";
  const href = resolved ? `/receipt?address=${m.address}` : `/market?address=${m.address}`;
  const twoStat = m.statKey2 !== null;

  return (
    <Link href={href} className="card card-hover group block p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {open && <span className="live-dot mt-1.5" />}
          <h3 className="display font-semibold leading-tight">{m.title || m.predicate}</h3>
        </div>
        <StatusBadge status={m.status} winningSide={m.winningSide} />
      </div>

      <p className="mono mb-4 line-clamp-1 text-xs text-[var(--color-muted)]">{m.predicate}</p>

      <LiveOdds impliedYes={m.impliedYes} />

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span>
          Pool <span className="mono text-[var(--color-chalk)]">{pool}</span> USDC
        </span>
        <span className="flex items-center gap-1.5">
          {twoStat && <span className="pill px-2 py-0.5 text-[0.65rem]">2-stat</span>}
          <span className="mono">#{m.fixtureId}</span>
        </span>
      </div>

      <div
        className="mt-4 flex items-center gap-1 text-xs font-semibold transition-colors"
        style={{ color: resolved ? "var(--color-proof)" : "var(--color-grass-bright)" }}
      >
        {open && (
          <>
            Place a bet
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </>
        )}
        {resolved && (
          <>
            Verify the settlement receipt
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </>
        )}
        {m.status === "voided" && <span className="text-[var(--color-muted)]">Refund available →</span>}
      </div>
    </Link>
  );
}
