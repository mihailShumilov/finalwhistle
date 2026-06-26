"use client";

import { useEffect, useState } from "react";
import { fetchMarkets, type MarketView } from "../lib/api";

interface Item {
  label: string;
  pct: number;
  status: string;
}

const FALLBACK: Item[] = [
  { label: "TOTAL CORNERS > 10", pct: 62, status: "open" },
  { label: "HOME − AWAY ≥ 2", pct: 38, status: "open" },
  { label: "P1 GOALS > 0", pct: 71, status: "resolved" },
  { label: "TOTAL GOALS > 2", pct: 55, status: "open" },
];

function Cell({ it }: { it: Item }) {
  const settled = it.status === "resolved";
  return (
    <span className="mx-5 inline-flex items-center gap-2 align-middle">
      <span className="text-[var(--color-chalk-faint)]">▪</span>
      <span className="text-[var(--color-chalk)]">{it.label}</span>
      {settled ? (
        <span className="tag-volt term text-[0.6rem]">✓ SETTLED</span>
      ) : (
        <>
          <span className="volt">YES {it.pct}%</span>
          <span className="var">NO {100 - it.pct}%</span>
        </>
      )}
    </span>
  );
}

export function Ticker() {
  const [items, setItems] = useState<Item[]>(FALLBACK);

  useEffect(() => {
    fetchMarkets()
      .then((ms: MarketView[]) => {
        if (!ms.length) return;
        setItems(
          ms.slice(0, 14).map((m) => ({
            label: (m.title || m.predicate).toUpperCase(),
            pct: Math.round(m.impliedYes * 100),
            status: m.status,
          })),
        );
      })
      .catch(() => {
        /* keep fallback */
      });
  }, []);

  const row = [...items, ...items]; // duplicate for seamless loop

  return (
    <div className="marquee overflow-hidden border-y border-[var(--color-line)] bg-[var(--color-ink)] py-2.5 term text-xs">
      <div className="marquee-track">
        {row.map((it, i) => (
          <Cell key={`${it.label}-${String(i)}`} it={it} />
        ))}
      </div>
    </div>
  );
}
