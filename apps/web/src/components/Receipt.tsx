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
    <div className="panel crt">
      <div className="led flex items-center justify-between px-3 py-1.5">
        <span className="term text-[0.66rem] font-bold tracking-widest">
          ⬢ VERIFIABLE SETTLEMENT RECEIPT
        </span>
        <span className="term text-[0.62rem] font-bold tracking-widest opacity-80">
          FIXTURE #{market.fixtureId}
        </span>
      </div>

      <div className="relative p-5 sm:p-6">
        {verified ? (
          <span className="stamp anim-stamp absolute right-4 top-4 text-xl sm:text-2xl">
            VERIFIED ✓
          </span>
        ) : proof ? (
          <span className="stamp stamp-var anim-stamp absolute right-4 top-4 text-xl">MISMATCH</span>
        ) : null}

        <p className="label">Market</p>
        <h2 className="score mt-1 max-w-[70%] text-3xl tracking-wide sm:text-4xl">
          {market.title || market.predicate}
        </h2>
        <p className="term mt-1 text-xs text-[var(--color-chalk-faint)]">{market.predicate}</p>

        <div className="mt-6 grid gap-px border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
          <Cell k="On-chain resolution">
            <span className={onChain === "YES" ? "volt" : "var"}>{onChain} wins</span>
          </Cell>
          {proof && statA !== undefined ? (
            <Cell k="Proven stat value">
              <span className="term">
                {statLabel(proof.statToProve.key)} = {statA}
                {statB !== undefined
                  ? ` · ${statLabel(proof.statToProve2?.key ?? 0)} = ${statB}`
                  : ""}
              </span>
            </Cell>
          ) : (
            <Cell k="Proof">
              <span className="text-[var(--color-chalk-dim)]">recorded on-chain</span>
            </Cell>
          )}
          {recomputed && (
            <Cell k="Re-computed from proof">
              <span className={recomputed === "YES" ? "volt" : "var"}>
                {recomputed} {verified ? "— matches chain ✓" : "— differs!"}
              </span>
            </Cell>
          )}
          <Cell k="Settle slot">
            <span className="term">{outcome.settleSlot || "—"}</span>
          </Cell>
          <Cell k="Merkle root · events sub-tree" wide>
            <span className="term break-all text-[0.7rem]" style={{ color: "var(--color-sky)" }}>
              {hashHex(proof?.summary.eventStatsSubTreeRoot)}
            </span>
          </Cell>
          <Cell k="Market account">
            <a
              className="term text-xs hover:underline"
              style={{ color: "var(--color-sky)" }}
              href={explorerAddr(market.address)}
              target="_blank"
              rel="noreferrer"
            >
              {market.address.slice(0, 8)}…{market.address.slice(-8)} ↗
            </a>
          </Cell>
          <Cell k="Settle transaction">
            {outcome.settleSignature ? (
              <a
                className="term text-xs hover:underline"
                style={{ color: "var(--color-sky)" }}
                href={explorerTx(outcome.settleSignature)}
                target="_blank"
                rel="noreferrer"
              >
                {outcome.settleSignature.slice(0, 10)}… ↗
              </a>
            ) : (
              <span className="term text-xs text-[var(--color-chalk-dim)]">status: resolved</span>
            )}
          </Cell>
        </div>

        <p className="term mt-5 border-t border-[var(--color-line)] pt-4 text-[0.7rem] leading-relaxed text-[var(--color-chalk-faint)]">
          ANYONE CAN RE-RUN THIS CHECK: RE-FETCH THE TXLINE MERKLE PROOF, RECOMPUTE THE PREDICATE, AND
          CONFIRM IT MATCHES THE ON-CHAIN RESOLUTION — NO ORACLE VOTE, NO OPERATOR, NO TRUST.
        </p>
      </div>
    </div>
  );
}

function Cell({ k, children, wide }: { k: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`bg-[var(--color-ink)] px-4 py-3 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="label">{k}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
