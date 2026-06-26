"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OddsBar, StatusBadge, Usdc } from "../components/ui";
import { fetchMarkets, type MarketView } from "../lib/api";

export default function MarketsPage() {
  const [markets, setMarkets] = useState<MarketView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMarkets()
      .then(setMarkets)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <section className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Markets that <span className="text-[var(--color-grass-bright)]">prove themselves</span>
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
          Every market is a cryptographic predicate over a TxLINE score stat. It self-settles the
          moment a Merkle proof is verified on-chain — no oracle vote, no dispute window, no
          operator. USDC only.
        </p>
      </section>

      {error && (
        <div className="card p-4 text-sm text-[var(--color-no)]">
          Could not reach the read API ({error}). Set{" "}
          <span className="mono">NEXT_PUBLIC_API_BASE</span> and start{" "}
          <span className="mono">apps/api</span>.
        </div>
      )}

      {!markets && !error && <p className="text-[var(--color-muted)]">Loading markets…</p>}

      {markets && markets.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-[var(--color-muted)]">No markets yet.</p>
          <Link href="/create" className="btn btn-primary mt-4 inline-block">
            Create the first market
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {markets?.map((m) => (
          <Link
            key={m.address}
            href={`/market?address=${m.address}`}
            className="card block p-5 hover:border-[var(--color-grass)]"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-tight">{m.title || m.predicate}</h3>
              <StatusBadge status={m.status} winningSide={m.winningSide} />
            </div>
            <p className="mono mb-4 text-xs text-[var(--color-muted)]">{m.predicate}</p>
            <OddsBar impliedYes={m.impliedYes} />
            <div className="mt-4 flex justify-between text-xs text-[var(--color-muted)]">
              <span>
                Pool <Usdc baseUnits={(BigInt(m.yesPool) + BigInt(m.noPool)).toString()} />
              </span>
              <span>fixture {m.fixtureId}</span>
            </div>
            {m.status === "resolved" && (
              <span className="mt-3 inline-block text-xs font-semibold text-[#60a5fa]">
                View settlement receipt →
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
