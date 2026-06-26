"use client";

import { statLabel, winningSide } from "@finalwhistle/shared";
import type { ReceiptView } from "../lib/api";
import { explorerAddr, explorerTx } from "../lib/config";

function hashHex(h: string | number[] | undefined): string {
  if (!h) return "—";
  if (typeof h === "string") return h.startsWith("0x") ? h : `0x${h}`;
  return `0x${h.map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const sideLabel = (s: number) => (s === 1 ? "YES" : s === 2 ? "NO" : "—");

export function Receipt({ data }: { data: ReceiptView }) {
  const { market, outcome, proof } = data;

  // Independent re-verification: recompute the outcome from the proof and compare to chain.
  const statA = proof?.statToProve.value;
  const statB = proof?.statToProve2?.value;
  const recomputed =
    proof && statA !== undefined
      ? winningSide(
          {
            fixtureId: market.fixtureId,
            seq: market.seq,
            statKey: market.statKey,
            ...(market.statKey2 !== null ? { statKey2: market.statKey2 } : {}),
            ...(market.op ? { op: market.op } : {}),
            period: market.period,
            threshold: market.threshold,
            comparison: market.comparison,
          },
          statA,
          statB,
        )
      : null;
  const onChain = sideLabel(outcome.winningSide);
  const verified = recomputed !== null && recomputed === onChain;

  return (
    <div className="card overflow-hidden">
      <div className="h-1 w-full flow-bar" />
      <div className="border-b border-[var(--color-line)] bg-[#0b140d] px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Verifiable Settlement Receipt</p>
            <h2 className="display mt-1 text-xl font-bold">{market.title || market.predicate}</h2>
          </div>
          {verified ? (
            <span className="badge anim-pop bg-[#0f2417] text-[var(--color-grass-bright)] text-sm">
              ✓ Independently re-verified
            </span>
          ) : proof ? (
            <span className="badge bg-[#241016] text-[var(--color-no)] text-sm">⚠ Mismatch</span>
          ) : (
            <span className="badge bg-[var(--color-line)] text-[var(--color-muted)] text-sm">
              Proof unavailable
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-px bg-[var(--color-line)] sm:grid-cols-2">
        <Cell label="Predicate">
          <span className="mono">{market.predicate}</span>
        </Cell>
        <Cell label="On-chain resolution">
          <span
            className={onChain === "YES" ? "text-[var(--color-yes)]" : "text-[var(--color-no)]"}
          >
            {onChain} wins
          </span>
        </Cell>

        {proof && statA !== undefined && (
          <Cell label="Proven stat value">
            <span className="mono">
              {statLabel(proof.statToProve.key)} = {statA}
              {statB !== undefined
                ? ` · ${statLabel(proof.statToProve2?.key ?? 0)} = ${statB}`
                : ""}
            </span>
          </Cell>
        )}
        {recomputed && (
          <Cell label="Re-computed from proof">
            <span
              className={
                recomputed === "YES" ? "text-[var(--color-yes)]" : "text-[var(--color-no)]"
              }
            >
              {recomputed} {verified ? "— matches chain ✓" : "— differs!"}
            </span>
          </Cell>
        )}

        <Cell label="Merkle root (events sub-tree)">
          <span className="mono break-all text-xs">
            {hashHex(proof?.summary.eventStatsSubTreeRoot)}
          </span>
        </Cell>
        <Cell label="Settle slot">
          <span className="mono">{outcome.settleSlot || "—"}</span>
        </Cell>

        <Cell label="Market account">
          <a
            className="mono text-xs text-[#60a5fa] hover:underline"
            href={explorerAddr(market.address)}
            target="_blank"
            rel="noreferrer"
          >
            {market.address.slice(0, 8)}…{market.address.slice(-8)}
          </a>
        </Cell>
        <Cell label="Settle transaction">
          {outcome.settleSignature ? (
            <a
              className="mono text-xs text-[#60a5fa] hover:underline"
              href={explorerTx(outcome.settleSignature)}
              target="_blank"
              rel="noreferrer"
            >
              {outcome.settleSignature.slice(0, 10)}… ↗
            </a>
          ) : (
            <span className="text-xs text-[var(--color-muted)]">
              recorded on-chain (status: resolved)
            </span>
          )}
        </Cell>
      </div>

      <div className="px-6 py-4 text-xs text-[var(--color-muted)]">
        Anyone can re-run this check: re-fetch the TxLINE Merkle proof, recompute the predicate, and
        confirm it matches the on-chain resolution — no oracle vote, no operator, no trust.
      </div>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-pitch-2)] px-6 py-4">
      <p className="mb-1 text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
