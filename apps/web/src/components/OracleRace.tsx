"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "./motion";

const DURATION = 5600; // ms for the slow (old-way) lane to finish

interface Step {
  at: number; // fraction of timeline when this step lights up
  label: string;
  sub?: string;
}

// Old way (UMA-style optimistic oracle) — crawls across the whole timeline.
const OLD: Step[] = [
  { at: 0.0, label: "Match ends" },
  { at: 0.12, label: "Someone proposes the outcome", sub: "posts a bond" },
  { at: 0.3, label: "Anyone can dispute it", sub: "escalates to a vote" },
  { at: 0.45, label: "Token-holders vote", sub: "48–72h · whale-weighted" },
  { at: 0.97, label: "Settles — if the whales agreed", sub: "$237M once rode on one vote" },
];

// FinalWhistle — finishes in the first fifth of the timeline.
const NEW: Step[] = [
  { at: 0.0, label: "Final whistle", sub: "TxLINE score feed" },
  { at: 0.05, label: "Fetch the Merkle proof", sub: "three-stage stat proof" },
  { at: 0.11, label: "validate_stat runs on Solana", sub: "CPI recomputes the root" },
  { at: 0.19, label: "Settled · paid · receipt", sub: "one transaction" },
];

const NEW_END = 0.2;

export function OracleRace() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [p, setP] = useState(0); // 0..1 timeline progress
  const raf = useRef(0);
  const started = useRef(false);

  const run = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setP(0);
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const next = Math.min(1, (t - start) / DURATION);
      setP(next);
      if (next < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (inView && !started.current) {
      started.current = true;
      run();
    }
    return () => cancelAnimationFrame(raf.current);
  }, [inView, run]);

  const newDone = p >= NEW_END;
  const oldDone = p >= 0.99;
  // seconds counter for FinalWhistle freezes once done; "days" climbs for the old way
  const fwSeconds = Math.min(0.4, (p / NEW_END) * 0.4).toFixed(1);
  const oldDays = Math.min(3, p * 3).toFixed(1);

  return (
    <div ref={ref} className="glass overflow-hidden p-5 sm:p-7">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Watch the same match settle, two ways</p>
          <h3 className="display mt-1 text-xl font-bold sm:text-2xl">
            Days of voting vs <span className="gradient-text">one proof</span>
          </h3>
        </div>
        <button type="button" className="btn btn-ghost self-start text-sm" onClick={run}>
          ↻ Replay
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Lane
          tone="warn"
          tag="The old way · optimistic oracle"
          steps={OLD}
          p={p}
          done={oldDone}
          counter={`${oldDays} days`}
          counterLabel="elapsed, still disputable"
          footer="Settled by a token vote a whale can out-buy."
          mascot="🐋"
        />
        <Lane
          tone="good"
          tag="FinalWhistle · cryptographic settlement"
          steps={NEW}
          p={p}
          done={newDone}
          counter={`${fwSeconds}s`}
          counterLabel="to final, re-verifiable settlement"
          footer="Settled by math. Anyone can re-check the proof."
          mascot="✅"
          fastEnd={NEW_END}
        />
      </div>
    </div>
  );
}

function Lane({
  tone,
  tag,
  steps,
  p,
  done,
  counter,
  counterLabel,
  footer,
  mascot,
  fastEnd,
}: {
  tone: "warn" | "good";
  tag: string;
  steps: Step[];
  p: number;
  done: boolean;
  counter: string;
  counterLabel: string;
  footer: string;
  mascot: string;
  fastEnd?: number;
}) {
  const good = tone === "good";
  const accent = good ? "var(--color-grass-bright)" : "var(--color-whale)";
  // progress bar fills across this lane's own timeline span
  const span = fastEnd ?? 1;
  const fill = Math.min(100, (p / span) * 100);

  return (
    <div
      className="relative rounded-xl border p-4 transition-colors"
      style={{
        borderColor: done ? accent : "var(--color-line)",
        background: good
          ? "linear-gradient(180deg, rgba(43,220,110,0.06), transparent)"
          : "linear-gradient(180deg, rgba(245,158,11,0.06), transparent)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className="text-[0.7rem] font-bold uppercase tracking-wider"
          style={{ color: accent }}
        >
          {tag}
        </span>
        <span className={done ? "anim-pop text-lg" : "text-lg opacity-30"}>{mascot}</span>
      </div>

      {/* progress bar */}
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[var(--color-line)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${fill}%`,
            background: good
              ? "linear-gradient(90deg, var(--color-grass), var(--color-grass-glow))"
              : "linear-gradient(90deg, var(--color-whale), var(--color-no))",
            transition: "width 0.08s linear",
          }}
        />
      </div>

      <ol className="space-y-2.5">
        {steps.map((s) => {
          const active = p >= s.at;
          return (
            <li
              key={s.label}
              className="flex items-start gap-2.5 transition-all duration-300"
              style={{ opacity: active ? 1 : 0.32, transform: active ? "none" : "translateX(-4px)" }}
            >
              <span
                className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px]"
                style={{
                  background: active ? accent : "var(--color-line)",
                  color: "#04130a",
                }}
              >
                {active ? "✓" : ""}
              </span>
              <span className="leading-tight">
                <span className="text-sm font-medium text-[var(--color-chalk)]">{s.label}</span>
                {s.sub && (
                  <span className="mt-0.5 block text-xs text-[var(--color-muted)]">{s.sub}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <div
        className="mt-4 flex items-end justify-between border-t pt-3"
        style={{ borderColor: "var(--color-line)" }}
      >
        <div>
          <div className="display text-2xl font-bold" style={{ color: accent }}>
            {counter}
          </div>
          <div className="text-[0.7rem] text-[var(--color-muted)]">{counterLabel}</div>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted)]">{footer}</p>
    </div>
  );
}
