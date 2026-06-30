"use client";

import { formatUsdc } from "@finalwhistle/sdk";
import Link from "next/link";
import type { MarketView } from "../lib/api";

function SegBar({ yes }: { yes: number }) {
  const N = 20;
  const on = Math.round((yes / 100) * N);
  return (
    <div>
      <div className="term mb-1.5 flex justify-between text-[0.7rem] font-bold">
        <span className="volt">YES {yes}</span>
        <span className="var">{100 - yes} NO</span>
      </div>
      <div className="flex h-2.5 gap-0.5">
        {Array.from({ length: N }).map((_, i) => (
          <div
            key={`seg-${String(i)}`}
            className="flex-1"
            style={{ background: i < on ? "var(--color-volt)" : "var(--color-var)" }}
          />
        ))}
      </div>
    </div>
  );
}

export function MarketCard({ m }: { m: MarketView }) {
  const pool = formatUsdc(BigInt(m.yesPool) + BigInt(m.noPool));
  const yes = Math.round(m.impliedYes * 100);
  const open = m.status === "open";
  const resolved = m.status === "resolved";
  const voided = m.status === "voided";
  const href = resolved ? `/receipt?address=${m.address}` : `/market?address=${m.address}`;
  const twoStat = m.statKey2 !== null;
  const winner = m.winningSide === 1 ? "YES" : m.winningSide === 2 ? "NO" : "";

  const ledClass = voided ? "led-var" : "led";
  const ledText = open ? "● LIVE" : resolved ? "✓ FULL TIME" : "✕ VOID";

  return (
    <Link href={href} className={`panel hover-lift block ${voided ? "panel-var" : ""}`}>
      <div className={`${ledClass} flex items-center justify-between px-3 py-1`}>
        <span className="term text-[0.62rem] font-bold tracking-widest">
          {ledText}
          {resolved && winner ? ` · ${winner} WINS` : ""}
        </span>
        <span className="term text-[0.62rem] font-bold tracking-widest opacity-80">
          #{m.fixtureId}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="score text-xl leading-none tracking-wide text-[var(--color-chalk)]">
            {m.title || m.predicate}
          </h3>
          {twoStat && <span className="tag-sky term shrink-0 text-[0.58rem]">2-STAT</span>}
        </div>
        <p className="term mt-1.5 truncate text-[0.7rem] text-[var(--color-chalk-faint)]">
          {m.predicate}
        </p>
        <p className="term mt-1 text-[0.6rem] uppercase tracking-wider text-[var(--color-chalk-faint)]">
          by {m.authority.slice(0, 4)}…{m.authority.slice(-4)}
        </p>

        <div className="my-4">
          <SegBar yes={yes} />
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-3">
          <span className="term text-[0.7rem] text-[var(--color-chalk-dim)]">
            POOL <span className="text-[var(--color-chalk)]">{pool}</span> USDC
          </span>
          <span
            className="term text-[0.7rem] font-bold tracking-wider"
            style={{
              color: resolved
                ? "var(--color-sky)"
                : voided
                  ? "var(--color-var)"
                  : "var(--color-volt)",
            }}
          >
            {open && "PLACE BET →"}
            {resolved && "VERIFY RECEIPT →"}
            {voided && "REFUND →"}
          </span>
        </div>
      </div>
    </Link>
  );
}
