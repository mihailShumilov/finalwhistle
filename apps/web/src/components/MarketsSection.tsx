"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchMarkets, type MarketView } from "../lib/api";
import { MarketCard } from "./MarketCard";
import { Reveal } from "./motion";

type Filter = "all" | "open" | "resolved" | "voided";

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "resolved", label: "Settled" },
  { key: "voided", label: "Voided" },
];

function Skeleton() {
  return (
    <div className="card p-5">
      <div className="skeleton mb-3 h-5 w-2/3 rounded" />
      <div className="skeleton mb-4 h-3 w-1/2 rounded" />
      <div className="skeleton mb-2 h-2.5 w-full rounded-full" />
      <div className="skeleton mt-4 h-3 w-1/3 rounded" />
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
    <section id="markets" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="live-dot" /> Live on devnet
            </p>
            <h2 className="display mt-2 text-3xl font-bold sm:text-4xl">Live markets</h2>
            <p className="mt-2 max-w-xl text-[var(--color-muted)]">
              Each one is a cryptographic predicate over a real TxLINE match stat. Stake USDC on YES
              or NO — settlement is automatic and re-verifiable.
            </p>
          </div>
          <Link href="/create" className="btn btn-primary self-start">
            + Create a market
          </Link>
        </div>
      </Reveal>

      {/* filter tabs */}
      <div className="mt-7 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className="pill transition-all"
              style={{
                borderColor: active ? "var(--color-grass)" : "var(--color-line-2)",
                background: active ? "rgba(43,220,110,0.1)" : "rgba(12,19,16,0.6)",
                color: active ? "var(--color-grass-bright)" : "var(--color-muted)",
              }}
            >
              {t.label}
              <span className="mono opacity-70">{counts[t.key]}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="card mt-6 p-4 text-sm text-[var(--color-no)]">
          Could not reach the read API ({error}).
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!markets && !error &&
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={`sk-${String(i)}`} />)}
        {shown.map((m, i) => (
          <Reveal key={m.address} delay={Math.min(i, 5) * 60}>
            <MarketCard m={m} />
          </Reveal>
        ))}
      </div>

      {markets && shown.length === 0 && !error && (
        <div className="card mt-6 p-10 text-center text-[var(--color-muted)]">
          No {filter === "all" ? "" : filter} markets yet.{" "}
          <Link href="/create" className="text-[var(--color-grass-bright)] hover:underline">
            Create one →
          </Link>
        </div>
      )}
    </section>
  );
}
