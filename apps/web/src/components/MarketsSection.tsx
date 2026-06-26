"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchMarkets, type MarketView } from "../lib/api";
import { MarketCard } from "./MarketCard";
import { Reveal } from "./motion";

type Filter = "all" | "open" | "resolved" | "voided";

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "open", label: "LIVE" },
  { key: "resolved", label: "FULL TIME" },
  { key: "voided", label: "VOID" },
];

function Skeleton() {
  return (
    <div className="panel-flat p-4">
      <div className="skeleton mb-3 h-3 w-1/3" />
      <div className="skeleton mb-2 h-6 w-2/3" />
      <div className="skeleton mb-4 h-2.5 w-full" />
      <div className="skeleton h-3 w-1/2" />
    </div>
  );
}

export function MarketsSection() {
  const [markets, setMarkets] = useState<MarketView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetchMarkets()
      .then(setMarkets)
      .catch((e) => setError(String(e)));
  }, []);

  const counts = useMemo(() => {
    const c = { all: 0, open: 0, resolved: 0, voided: 0 } as Record<Filter, number>;
    for (const m of markets ?? []) {
      c.all++;
      if (m.status in c) c[m.status as Filter]++;
    }
    return c;
  }, [markets]);

  const shown = useMemo(
    () => (markets ?? []).filter((m) => filter === "all" || m.status === filter),
    [markets, filter],
  );

  return (
    <section id="fixtures" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 sm:px-6">
      <Reveal>
        <div className="flex flex-col gap-4 border-b border-[var(--color-line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label flex items-center gap-2">
              <span className="dot" /> LIVE BOARD · DEVNET
            </p>
            <h2 className="score mt-2 text-5xl tracking-wide sm:text-6xl">
              Today&apos;s <span className="volt">fixtures</span>
            </h2>
            <p className="term mt-2 max-w-xl text-xs leading-relaxed text-[var(--color-chalk-dim)]">
              Each fixture is a cryptographic predicate over a real TxLINE match stat. Back YES or NO
              with USDC — settlement is automatic and re-verifiable.
            </p>
          </div>
          <Link href="/create" className="btn btn-primary self-start">
            + New market
          </Link>
        </div>
      </Reveal>

      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className="tag"
              style={{
                borderColor: active ? "var(--color-volt)" : "var(--color-line-2)",
                color: active ? "var(--color-volt)" : "var(--color-chalk-dim)",
                background: active ? "rgba(200,255,45,0.06)" : "transparent",
              }}
            >
              {t.label}
              <span className="opacity-60">[{counts[t.key]}]</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="panel panel-var mt-6 p-4 term text-xs var">
          FEED ERROR — could not reach the read API ({error}).
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {!markets && !error &&
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={`sk-${String(i)}`} />)}
        {shown.map((m, i) => (
          <Reveal key={m.address} delay={Math.min(i, 5) * 55}>
            <MarketCard m={m} />
          </Reveal>
        ))}
      </div>

      {markets && shown.length === 0 && !error && (
        <div className="panel-flat mt-6 p-10 text-center term text-xs text-[var(--color-chalk-dim)]">
          NO {filter === "all" ? "" : `${filter.toUpperCase()} `}FIXTURES ON THE BOARD ·{" "}
          <Link href="/create" className="volt hover:underline">
            CREATE ONE →
          </Link>
        </div>
      )}
    </section>
  );
}
