"use client";

import { positionPda } from "@finalwhistle/sdk";
import { address } from "@solana/kit";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchMarkets, type MarketView } from "../lib/api";
import { getPool } from "../lib/sender";
import { MarketCard } from "./MarketCard";
import { Reveal } from "./motion";

type Filter = "all" | "mine" | "open" | "resolved" | "voided";

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "mine", label: "MINE" },
  { key: "open", label: "LIVE" },
  { key: "resolved", label: "FULL TIME" },
  { key: "voided", label: "VOID" },
];

/**
 * Markets the wallet has a stake in: derive each market's position PDA for the owner and
 * batch-check existence with one getMultipleAccounts per 100. Best-effort — a transient RPC
 * failure just yields an empty set, so the board never breaks on the "MINE" tab.
 */
async function fetchStakedAddresses(marketAddrs: string[], owner: string): Promise<Set<string>> {
  const staked = new Set<string>();
  if (marketAddrs.length === 0) return staked;
  const ownerPk = new PublicKey(owner);
  const rpc = getPool().rpc();
  const CHUNK = 100;
  for (let i = 0; i < marketAddrs.length; i += CHUNK) {
    const slice = marketAddrs.slice(i, i + CHUNK);
    const pdas = slice.map((a) => address(positionPda(new PublicKey(a), ownerPk).toBase58()));
    const { value } = await rpc.getMultipleAccounts(pdas, { encoding: "base64" }).send();
    value.forEach((acc, j) => {
      if (acc) staked.add(slice[j] as string);
    });
  }
  return staked;
}

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
  const wallet = useWallet().publicKey?.toBase58() ?? null;
  const [stakedSet, setStakedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchMarkets()
      .then(setMarkets)
      .catch((e) => setError(String(e)));
  }, []);

  // "MINE" = markets I created (authority) ∪ markets I have a stake in (position PDA exists).
  useEffect(() => {
    let cancelled = false;
    if (!wallet || !markets || markets.length === 0) {
      setStakedSet(new Set());
      return;
    }
    fetchStakedAddresses(
      markets.map((m) => m.address),
      wallet,
    )
      .then((s) => !cancelled && setStakedSet(s))
      .catch(() => !cancelled && setStakedSet(new Set()));
    return () => {
      cancelled = true;
    };
  }, [wallet, markets]);

  const mineSet = useMemo(() => {
    const s = new Set<string>();
    if (!wallet) return s;
    for (const m of markets ?? []) {
      if (m.authority === wallet || stakedSet.has(m.address)) s.add(m.address);
    }
    return s;
  }, [wallet, markets, stakedSet]);

  const counts = useMemo(() => {
    const c = { all: 0, mine: mineSet.size, open: 0, resolved: 0, voided: 0 } as Record<
      Filter,
      number
    >;
    for (const m of markets ?? []) {
      c.all++;
      if (m.status in c) c[m.status as Filter]++;
    }
    return c;
  }, [markets, mineSet]);

  const shown = useMemo(
    () =>
      (markets ?? []).filter((m) =>
        filter === "all" ? true : filter === "mine" ? mineSet.has(m.address) : m.status === filter,
      ),
    [markets, filter, mineSet],
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
              Each fixture is a cryptographic predicate over a real TxLINE match stat. Back YES or
              NO with USDC — settlement is automatic and re-verifiable.
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
        {!markets &&
          !error &&
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={`sk-${String(i)}`} />)}
        {shown.map((m, i) => (
          <Reveal key={m.address} delay={Math.min(i, 5) * 55}>
            <MarketCard m={m} />
          </Reveal>
        ))}
      </div>

      {markets && shown.length === 0 && !error && (
        <div className="panel-flat mt-6 p-10 text-center term text-xs text-[var(--color-chalk-dim)]">
          {filter === "mine" && !wallet ? (
            <>CONNECT A WALLET TO SEE MARKETS YOU CREATED OR STAKED IN.</>
          ) : filter === "mine" ? (
            <>
              YOU HAVEN&apos;T CREATED OR STAKED IN ANY MARKETS YET ·{" "}
              <Link href="/create" className="volt hover:underline">
                CREATE ONE →
              </Link>
            </>
          ) : (
            <>
              NO {filter === "all" ? "" : `${filter.toUpperCase()} `}FIXTURES ON THE BOARD ·{" "}
              <Link href="/create" className="volt hover:underline">
                CREATE ONE →
              </Link>
            </>
          )}
        </div>
      )}
    </section>
  );
}
