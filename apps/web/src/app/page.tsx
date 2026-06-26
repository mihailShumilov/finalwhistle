"use client";

import Link from "next/link";
import { MarketsSection } from "../components/MarketsSection";
import { Reveal } from "../components/motion";
import { OracleRace } from "../components/OracleRace";
import { Ticker } from "../components/Ticker";

export default function Home() {
  return (
    <>
      <Hero />
      <Ticker />
      <Villain />
      <Laws />
      <MarketsSection />
      <KickOff />
    </>
  );
}

/* ----------------------------------------------------------------- HERO */
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--color-line)]">
      {/* giant stencil watchword behind */}
      <span
        className="score pointer-events-none absolute -right-4 top-2 select-none text-[28vw] leading-none stencil sm:top-0 sm:text-[20rem]"
        aria-hidden
      >
        FT
      </span>

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag-volt">
              <span className="dot" /> LIVE · SOLANA DEVNET
            </span>
            <span className="tag">USDC-ONLY</span>
            <span className="tag">NO ORACLE VOTE</span>
          </div>

          <h1 className="score mt-6 text-[3.4rem] leading-[0.86] sm:text-[6.2rem]">
            Settled by <span className="volt">proof</span>.
            <br />
            Not by <span className="var line-through decoration-[3px]">vote</span>.
          </h1>

          <p className="mt-6 max-w-xl text-[0.98rem] leading-relaxed text-[var(--color-chalk-dim)]">
            FinalWhistle is a prediction market for objective sports outcomes — corners, goals, goal
            difference. When the match ends, a{" "}
            <span className="text-[var(--color-chalk)]">cryptographic proof</span> settles the bet
            on-chain. No oracle vote. No dispute window. No operator who can be wrong — or bought.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#fixtures" className="btn btn-primary btn-lg">
              Enter the markets →
            </Link>
            <Link href="#review" className="btn btn-lg">
              ▶ Watch it settle
            </Link>
          </div>

          {/* scoreboard stat row */}
          <div className="mt-10 grid max-w-xl grid-cols-3 divide-x divide-[var(--color-line)] border border-[var(--color-line)]">
            <Stat n="$237M" l="rode on one disputed vote" tone="var" />
            <Stat n="0.4s" l="to a verifiable decision" />
            <Stat n="0" l="votes · 0 operators" />
          </div>
        </div>

        <Reveal delay={120}>
          <DecisionCard />
        </Reveal>
      </div>
    </section>
  );
}

function Stat({ n, l, tone }: { n: string; l: string; tone?: "var" }) {
  return (
    <div className="px-3 py-3 first:pl-4">
      <div
        className="score text-3xl tabular-nums sm:text-4xl"
        style={{ color: tone === "var" ? "var(--color-var)" : "var(--color-volt)" }}
      >
        {n}
      </div>
      <div className="label mt-1 leading-tight">{l}</div>
    </div>
  );
}

/** The hero artifact: a match-official DECISION sheet with a slammed stamp. */
function DecisionCard() {
  return (
    <div className="panel crt">
      <div className="led flex items-center justify-between px-3 py-1.5">
        <span className="term text-[0.66rem] font-bold tracking-widest">⬢ MATCH DECISION SHEET</span>
        <span className="term text-[0.62rem] font-bold tracking-widest opacity-80">RE-VERIFIED</span>
      </div>

      <div className="relative p-5">
        <span className="stamp anim-stamp absolute right-4 top-3 text-2xl">YES ✓</span>

        <p className="label">Market</p>
        <p className="score mt-1 text-2xl tracking-wide">Total corners &gt; 10</p>

        <div className="mt-5 grid grid-cols-2 gap-px border border-[var(--color-line)] bg-[var(--color-line)]">
          <Field k="Proven on TxLINE" v="corners = 13" />
          <Field k="Predicate" v="13 > 10 → YES" />
          <Field k="On-chain result" v="YES wins" volt />
          <Field k="Re-computed" v="matches ✓" volt />
        </div>

        <div className="mt-4 border border-[var(--color-line)] bg-[var(--color-pitch)] p-3">
          <p className="label">Merkle root · events sub-tree</p>
          <p className="term mt-1 break-all text-[0.68rem]" style={{ color: "var(--color-sky)" }}>
            0x9f3a4c1d…e2b8a014c41d8e2b
          </p>
        </div>

        <p className="term mt-4 text-[0.7rem] leading-relaxed text-[var(--color-chalk-faint)]">
          ANYONE CAN RE-FETCH THE PROOF, RECOMPUTE THE PREDICATE, AND CONFIRM IT MATCHES THE CHAIN. NO
          TRUST REQUIRED.
        </p>
      </div>
    </div>
  );
}

function Field({ k, v, volt }: { k: string; v: string; volt?: boolean }) {
  return (
    <div className="bg-[var(--color-ink)] px-3 py-2.5">
      <p className="label">{k}</p>
      <p className="term mt-0.5 text-sm" style={{ color: volt ? "var(--color-volt)" : undefined }}>
        {v}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- VILLAIN */
function Villain() {
  return (
    <section id="review" className="scroll-mt-16 border-b border-[var(--color-line)] bg-[var(--color-ink)]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <p className="label var flex items-center gap-2">
            <span className="dot-var" /> UNDER REVIEW
          </p>
          <h2 className="score mt-3 max-w-3xl text-4xl leading-[0.92] sm:text-6xl">
            Today a winning bet goes to{" "}
            <span className="var">a vote you can buy.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--color-chalk-dim)]">
            Most prediction markets don&apos;t actually <em>know</em> who won. They ask token holders
            to vote — and the biggest wallet wins the vote. In one infamous case,{" "}
            <span className="text-[var(--color-chalk)]">$237M</span> hinged on a single disputed
            outcome whales could swing. For an objective stat — corners, the final score — that&apos;s
            absurd. The answer isn&apos;t an opinion. It&apos;s a fact on a signed feed.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-8 flex items-center justify-between gap-3 border-b border-[var(--color-line)] pb-3">
            <p className="score text-2xl tracking-wide sm:text-3xl">One incident · two systems</p>
            <ReplayHint />
          </div>
        </Reveal>

        <div className="mt-6">
          <OracleRace />
        </div>
      </div>
    </section>
  );
}

function ReplayHint() {
  return (
    <span className="term hidden text-[0.66rem] text-[var(--color-chalk-faint)] sm:inline">
      ⟳ AUTO-PLAYS ON SCROLL · REPLAY ON EACH LANE
    </span>
  );
}

/* ------------------------------------------------------------------ LAWS */
const LAWS = [
  {
    no: "01",
    title: "Define the predicate",
    body: "Pick a real fixture and a stat — “Total corners > 10”, “Home − Away ≥ 2”. A stat, a comparison, a number. Nothing for a referee or a voter to interpret.",
  },
  {
    no: "02",
    title: "Back it with USDC",
    body: "Stake YES or NO into a parimutuel pool. Collateral is always USDC — never a governance token whose price and votes a whale can move.",
  },
  {
    no: "03",
    title: "The whistle settles it",
    body: "At full time a TxLINE Merkle proof is verified on Solana via a validate_stat CPI. The market resolves, winners are paid, and a receipt is minted that anyone can re-verify.",
  },
];

function Laws() {
  return (
    <section id="laws" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 sm:px-6">
      <Reveal>
        <p className="label">📋 The laws of the game</p>
        <h2 className="score mt-3 text-4xl tracking-wide sm:text-6xl">
          Three laws. <span className="volt">No trust in between.</span>
        </h2>
      </Reveal>

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {LAWS.map((law, i) => (
          <Reveal key={law.no} delay={i * 90}>
            <div className="panel hover-lift h-full p-5">
              <div className="flex items-baseline justify-between">
                <span className="score text-6xl text-[var(--color-line-2)]">{law.no}</span>
                <span className="tag-volt term text-[0.6rem]">LAW {law.no}</span>
              </div>
              <h3 className="score mt-3 text-2xl tracking-wide">{law.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-chalk-dim)]">{law.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Guarantee t="Objective" d="Score-based facts, not opinions or referee calls." />
          <Guarantee t="Deterministic" d="The same proof always yields the same result — forever." />
          <Guarantee t="Permissionless" d="No operator can stall, censor, or overrule a settlement." />
        </div>
      </Reveal>
    </section>
  );
}

function Guarantee({ t, d }: { t: string; d: string }) {
  return (
    <div className="panel-flat flex items-start gap-3 p-4">
      <span className="volt term text-sm">[✓]</span>
      <p className="term text-xs leading-relaxed text-[var(--color-chalk-dim)]">
        <span className="text-[var(--color-chalk)]">{t.toUpperCase()}.</span> {d}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- KICK OFF */
function KickOff() {
  return (
    <section className="px-4 pb-20 sm:px-6">
      <Reveal>
        <div className="panel crt relative mx-auto max-w-5xl overflow-hidden">
          <div className="led flex items-center justify-between px-3 py-1.5">
            <span className="term text-[0.66rem] font-bold tracking-widest blink">● KICK OFF</span>
            <span className="term text-[0.62rem] font-bold tracking-widest opacity-80">
              00:00 · 1ST HALF
            </span>
          </div>
          <div className="px-6 py-14 text-center sm:py-20">
            <h2 className="score text-4xl leading-none sm:text-7xl">
              Settle the score with
              <br />
              <span className="volt">proof, not politics.</span>
            </h2>
            <p className="term mx-auto mt-4 max-w-xl text-xs leading-relaxed text-[var(--color-chalk-dim)]">
              Connect a Solana wallet, back an outcome with test USDC, and watch the final whistle
              settle it — then re-verify the receipt yourself.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="#fixtures" className="btn btn-primary btn-lg">
                Browse the board
              </Link>
              <Link href="/create" className="btn btn-lg">
                Create a market
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
