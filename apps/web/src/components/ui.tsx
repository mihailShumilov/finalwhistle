import { formatUsdc } from "@finalwhistle/sdk";

export function StatusBadge({ status, winningSide }: { status: string; winningSide?: number }) {
  const map: Record<string, [string, string]> = {
    open: ["Open", "bg-[#10231a] text-[var(--color-grass-bright)]"],
    resolved: ["Resolved", "bg-[#0e2030] text-[#60a5fa]"],
    voided: ["Voided", "bg-[#241016] text-[var(--color-no)]"],
  };
  const [label, cls] = map[status] ?? [status, "bg-[var(--color-line)] text-[var(--color-muted)]"];
  const side = winningSide === 1 ? " · YES" : winningSide === 2 ? " · NO" : "";
  return (
    <span className={`badge ${cls}`}>
      {label}
      {side}
    </span>
  );
}

export function OddsBar({ impliedYes }: { impliedYes: number }) {
  const yes = Math.round(impliedYes * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-[var(--color-muted)]">
        <span className="text-[var(--color-yes)]">YES {yes}%</span>
        <span className="text-[var(--color-no)]">NO {100 - yes}%</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-[var(--color-line)]">
        <div className="h-full bg-[var(--color-yes)]" style={{ width: `${yes}%` }} />
        <div className="h-full bg-[var(--color-no)]" style={{ width: `${100 - yes}%` }} />
      </div>
    </div>
  );
}

export function Usdc({ baseUnits }: { baseUnits: string | number }) {
  return <span className="mono">{formatUsdc(BigInt(baseUnits))} USDC</span>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </span>
      {children}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-pitch)] px-3 py-2 text-sm text-[var(--color-chalk)] outline-none focus:border-[var(--color-grass)]";
