"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "./motion";

const DURATION = 6000; // ms for the slow VAR lane to crawl the full timeline
const GLT_END = 0.2; // goal-line tech finishes in the first fifth

interface Step {
  at: number;
  label: string;
  sub?: string;
}

const VAR_STEPS: Step[] = [
  { at: 0.0, label: "On-field decision stands" },
  { at: 0.14, label: "Check initiated", sub: "a bond is posted to dispute" },
  { at: 0.32, label: "Escalated to a token vote" },
  { at: 0.5, label: "Whales enter the room", sub: "biggest wallet, biggest say" },
  { at: 0.97, label: "Decision… overturnable", sub: "$237M once hung on one vote" },
];

const GLT_STEPS: Step[] = [
  { at: 0.0, label: "Ball crosses the line", sub: "match goes final on TxLINE" },
  { at: 0.05, label: "Sensors fire", sub: "three-stage Merkle proof" },
  { at: 0.11, label: "Proof checked on Solana", sub: "validate_stat CPI" },
  { at: 0.19, label: "DECISION", sub: "settled · paid · receipt" },
];

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

export function OracleRace() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [p, setP] = useState(0);
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

  // VAR review clock climbs to 72:00:00 (hours); GLT timer freezes at 0.400s
  const hrs = p * 72;
  const varClock = `${pad(hrs)}:${pad((hrs % 1) * 60)}:${pad((((hrs % 1) * 60) % 1) * 60)}`;
  const gltSec = Math.min(0.4, (p / GLT_END) * 0.4);

  return (
    <div ref={ref} className="grid gap-4 lg:grid-cols-2">
      <Lane
        kind="var"
        title="VAR Review"
        sub="optimistic oracle · the old way"
        rec
        steps={VAR_STEPS}
        p={p}
        span={1}
        clock={varClock}
        clockUnit="hh:mm:ss under review"
        verdict="OVERTURNABLE"
        verdictDone={p >= 0.97}
        footer="Settled by a token vote a whale can out-buy."
      />
      <Lane
        kind="glt"
        title="Goal-line Technology"
        sub="FinalWhistle · cryptographic settlement"
        steps={GLT_STEPS}
        p={p}
        span={GLT_END}
        clock={`${gltSec.toFixed(3)}s`}
        clockUnit="to a final, re-verifiable decision"
        verdict="GOAL ✓"
        verdictDone={p >= GLT_END}
        footer="Settled by math. Anyone can re-check the proof."
      />
    </div>
  );
}

function Lane({
  kind,
  title,
  sub,
  rec,
  steps,
  p,
  span,
  clock,
  clockUnit,
  verdict,
  verdictDone,
  footer,
}: {
  kind: "var" | "glt";
  title: string;
  sub: string;
  rec?: boolean;
  steps: Step[];
  p: number;
  span: number;
  clock: string;
  clockUnit: string;
  verdict: string;
  verdictDone: boolean;
  footer: string;
}) {
  const isVar = kind === "var";
  const accent = isVar ? "var(--color-var)" : "var(--color-volt)";
  const fill = Math.min(100, (p / span) * 100);

  return (
    <div className={`panel crt ${isVar ? "panel-var" : ""}`}>
      <div
        className={`${isVar ? "led-var" : "led"} flex items-center justify-between px-3 py-1.5`}
      >
        <span className="term flex items-center gap-2 text-[0.66rem] font-bold tracking-widest">
          {rec ? <span className="blink">● REC</span> : <span>● LIVE</span>}
          {title.toUpperCase()}
        </span>
        <span className="term text-[0.6rem] font-bold tracking-widest opacity-80">
          {isVar ? "CH 01" : "CH 02"}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <p className="label">{sub}</p>

        {/* big timer */}
        <div className="mt-3 flex items-end justify-between gap-3 border-b border-[var(--color-line)] pb-3">
          <div>
            <div
              className="term text-3xl font-bold tabular-nums sm:text-4xl"
              style={{ color: accent }}
            >
              {clock}
            </div>
            <div className="label mt-1">{clockUnit}</div>
          </div>
          {verdictDone && (
            <span className={`stamp anim-stamp text-2xl ${isVar ? "stamp-var" : ""}`}>
              {verdict}
            </span>
          )}
        </div>

        {/* progress segments */}
        <div className="mt-4 flex h-2 gap-0.5">
          {Array.from({ length: 24 }).map((_, i) => {
            const on = (i / 24) * 100 < fill;
            return (
              <div
                key={`seg-${kind}-${String(i)}`}
                className="flex-1"
                style={{ background: on ? accent : "var(--color-line)" }}
              />
            );
          })}
        </div>

        <ol className="mt-4 space-y-2.5">
          {steps.map((s) => {
            const active = p >= s.at;
            return (
              <li
                key={s.label}
                className="flex items-start gap-2.5 transition-opacity duration-300"
                style={{ opacity: active ? 1 : 0.3 }}
              >
                <span
                  className="term mt-px text-xs font-bold"
                  style={{ color: active ? accent : "var(--color-chalk-faint)" }}
                >
                  {active ? "▶" : "·"}
                </span>
                <span className="leading-tight">
                  <span className="term text-sm text-[var(--color-chalk)]">{s.label}</span>
                  {s.sub && (
                    <span className="mt-0.5 block text-xs text-[var(--color-chalk-dim)]">
                      {s.sub}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 border-t border-[var(--color-line)] pt-3 text-xs text-[var(--color-chalk-dim)]">
          {footer}
        </p>
      </div>
    </div>
  );
}
