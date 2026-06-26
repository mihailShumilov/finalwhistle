import { formatUsdc } from "@finalwhistle/sdk";

export function StatusBadge({ status, winningSide }: { status: string; winningSide?: number }) {
  const map: Record<string, [string, string]> = {
    open: ["● LIVE", "tag-volt"],
    resolved: ["✓ FULL TIME", "tag-sky"],
    voided: ["✕ VOID", "tag-var"],
  };
  const [label, cls] = map[status] ?? [status.toUpperCase(), "tag"];
  const side = winningSide === 1 ? " · YES" : winningSide === 2 ? " · NO" : "";
  return (
    <span className={`tag ${cls}`}>
      {label}
      {side}
    </span>
  );
}

/** Segmented YES/NO odds bar — scoreboard style. */
export function OddsBar({ impliedYes }: { impliedYes: number }) {
  const yes = Math.round(impliedYes * 100);
  const N = 28;
  const on = Math.round((yes / 100) * N);
  return (
    <div>
      <div className="term mb-1.5 flex justify-between text-xs font-bold">
        <span className="volt">YES {yes}%</span>
        <span className="var">{100 - yes}% NO</span>
      </div>
      <div className="flex h-3 gap-0.5">
        {Array.from({ length: N }).map((_, i) => (
          <div
            key={`o-${String(i)}`}
            className="flex-1"
            style={{ background: i < on ? "var(--color-volt)" : "var(--color-var)" }}
          />
        ))}
      </div>
    </div>
  );
}

export function Usdc({ baseUnits }: { baseUnits: string | number }) {
  return <span className="term">{formatUsdc(BigInt(baseUnits))} USDC</span>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
    </div>
  );
}

export const inputCls = "input";
