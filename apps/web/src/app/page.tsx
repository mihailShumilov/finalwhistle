"use client";

import Link from "next/link";
import { MarketsSection } from "../components/MarketsSection";
import { CountUp, Reveal } from "../components/motion";
import { OracleRace } from "../components/OracleRace";

export default function Home() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <MarketsSection />
      <FinalCta />
    </>
  );
}

/* ------------------------------------------------------------------ Hero */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pitch-lines pointer-events-none absolute inset-0" />
      <div
        className="anim-drift pointer-events-none absolute -top-24 right-[-10%] h-80 w-80 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(56,189,248,0.25), transparent 70%)" }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-10 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <span className="pill">
            <span className="live-dot" /> Live on Solana devnet · USDC-only
          </span>
          <h1 className="display mt-5 text-4xl font-bold leading-[1.05] sm:text-6xl">
            Bets that settle
            <br />
            <span className="gradient-text">at the final whistle.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
            FinalWhistle is a prediction market for objective sports outcomes — corners, goals, goal
            difference. When the match ends, a <strong className="text-[var(--color-chalk)]">cryptographic
            proof</strong> settles the bet on-chain. No oracle vote. No dispute window. No operator
            who can be wrong — or bought.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#markets" className="btn btn-primary btn-lg">
              Explore live markets →
            </Link>
            <Link href="#settle" className="btn btn-lg btn-ghost">
              ▶ See it settle
            </Link>
          </div>

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6">
            <Stat
              value={<CountUp value={237} format={(n) => `$${Math.round(n)}M`} />}
              label="rode on one disputed oracle vote"
              tone="warn"
            />
            <Stat
              value={<CountUp value={0.4} format={(n) => `${n.toFixed(1)}s`} />}
              label="to a final, re-verifiable settlement"
            />
            <Stat value="0" label="oracle votes · 0 operators" />
          </dl>
        </div>

        <Reveal delay={120}>
          <HeroReceipt />
        </Reveal>
      </div>
    </section>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: React.ReactNode;
  label: string;
  tone?: "warn";
}) {
  return (
    <div>
      <dt
        className="display text-2xl font-bold sm:text-3xl"
        style={{ color: tone === "warn" ? "var(--color-whale)" : "var(--color-grass-bright)" }}
      >
        {value}
      </dt>
      <dd className="mt-1 text-xs leading-snug text-[var(--color-muted)]">{label}</dd>
    </div>
  );
}

/** A floating mock of the Verifiable Settlement Receipt — the product's hero artifact. */
function HeroReceipt() {
  return (
    <div className="anim-float relative">
      <div
        className="absolute -inset-0.5 rounded-[1.2rem] opacity-40 blur-xl"
        style={{ background: "linear-gradient(120deg,#2bdc6e,#38bdf8)" }}
      />
      <div className="glass relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3.5">
          <span className="eyebrow">Verifiable Settlement Receipt</span>
          <span className="badge anim-pop bg-[#0f2417] text-[var(--color-grass-bright)]">
            ✓ re-verified
          </span>
        </div>
        <div className="space-y-3 p-5 text-sm">
          <RcRow label="Market" value="Total corners > 10" />
          <RcRow label="Proven on TxLINE" value="corners = 13" mono />
          <RcRow label="On-chain resolution" value="YES wins" valueClass="text-[var(--color-yes)]" />
          <RcRow
            label="Re-computed from proof"
            value="YES — matches chain ✓"
            valueClass="text-[var(--color-yes)]"
          />
          <div className="!mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-pitch)] p-3">
            <p className="eyebrow">Merkle root · events sub-tree</p>
            <p className="mono mt-1 break-all text-[0.7rem] text-[var(--color-proof)]">
              0x9f3a…c41d8e2b
            </p>
          </div>
          <p className="!mt-4 text-xs leading-relaxed text-[var(--color-muted)]">
            Anyone can re-fetch the proof, recompute the predicate, and confirm it matches the chain.
            No trust required.
          </p>
        </div>
        <div className="h-1 w-full flow-bar" />
      </div>
    </div>
  );
}

function RcRow({
  label,
  value,
  mono,
  valueClass = "",
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
      <span className={`${mono ? "mono" : ""} font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

/* --------------------------------------------------------------- Problem */
function Problem() {
  return (
    <section id="settle" className="scroll-mt-20 border-y border-[var(--color-line)] bg-[var(--color-pitch-2)]">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <Reveal>
          <div className="max-w-2xl">
            <p className="eyebrow text-[var(--color-whale)]">The problem nobody fixed</p>
            <h2 className="display mt-2 text-3xl font-bold sm:text-4xl">
              Today, a winning bet is decided by{" "}
              <span className="gradient-text-warn">a vote you can buy.</span>
            </h2>
            <p className="mt-4 text-[var(--color-muted)]">
              Most prediction markets don&apos;t actually <em>know</em> who won. They ask token
              holders to vote — and the biggest wallet wins the vote. In one infamous case,{" "}
              <strong className="text-[var(--color-chalk)]">$237M</strong> hinged on a single
              disputed outcome that whales could swing. The crowd was right; the rules let money
              decide anyway.
            </p>
            <p className="mt-4 text-[var(--color-muted)]">
              For an objective sports stat — the number of corners, the final score — that&apos;s
              absurd. The answer isn&apos;t an opinion. It&apos;s a fact on a signed data feed.
              FinalWhistle settles on the fact.
            </p>
          </div>
        </Reveal>

        <div className="mt-10">
          <OracleRace />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- How it works */
const STEPS = [
  {
    icon: "⚖️",
    title: "Define the predicate",
    body: "Pick a real fixture and a stat — “Total corners > 10”, “Home − Away ≥ 2”. A stat, a comparison, a number. Zero ambiguity, nothing for a referee or a voter to interpret.",
  },
  {
    icon: "💵",
    title: "Back it with USDC",
    body: "Stake YES or NO into a parimutuel pool. Collateral is always USDC — never a governance token whose price (and votes) a whale can move.",
  },
  {
    icon: "🏁",
    title: "The whistle settles it",
    body: "At full time, a TxLINE Merkle proof is verified on Solana via a validate_stat CPI. The market resolves, winners are paid, and a receipt is minted that anyone can re-verify.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
      <Reveal>
        <p className="eyebrow">How it works</p>
        <h2 className="display mt-2 text-3xl font-bold sm:text-4xl">
          Three steps. <span className="gradient-text">No trust in between.</span>
        </h2>
      </Reveal>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 110}>
            <div className="card card-hover h-full p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-pitch)] text-2xl ring-1 ring-[var(--color-line-2)]">
                  {s.icon}
                </span>
                <span className="display text-sm font-bold text-[var(--color-muted-2)]">
                  0{i + 1}
                </span>
              </div>
              <h3 className="display mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Guarantee tag="Objective" text="Markets are score-based facts, not opinions or referee calls." />
          <Guarantee tag="Deterministic" text="The same proof always yields the same result — re-runnable forever." />
          <Guarantee tag="Permissionless" text="No operator can stall, censor, or overrule a settlement." />
        </div>
      </Reveal>
    </section>
  );
}

function Guarantee({ tag, text }: { tag: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-pitch-2)] p-4">
      <span className="mt-0.5 text-[var(--color-grass-bright)]">✓</span>
      <p className="text-sm text-[var(--color-muted)]">
        <strong className="text-[var(--color-chalk)]">{tag}.</strong> {text}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- Final CTA */
function FinalCta() {
  return (
    <section className="px-5 pb-24">
      <Reveal>
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-[var(--color-line-2)] p-10 text-center sm:p-16">
          <div className="pitch-lines pointer-events-none absolute inset-0 opacity-60" />
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(600px 240px at 50% 0%, rgba(43,220,110,0.16), transparent 70%)",
            }}
          />
          <div className="relative">
            <h2 className="display text-3xl font-bold sm:text-4xl">
              Settle the score with <span className="gradient-text">proof, not politics.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[var(--color-muted)]">
              Connect a Solana wallet, back an outcome with test USDC, and watch the final whistle
              settle it — then re-verify the receipt yourself.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="#markets" className="btn btn-primary btn-lg">
                Browse markets
              </Link>
              <Link href="/create" className="btn btn-lg btn-ghost">
                Create a market
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
