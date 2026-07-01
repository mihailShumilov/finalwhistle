/**
 * Shared social-card renderer. Both `opengraph-image.tsx` and `twitter-image.tsx` re-export this so
 * X/Slack/Discord/LinkedIn/iMessage all get a branded 1200×630 PNG generated at build time.
 * Uses the `next/og` default font (no network fetch) so the static export builds offline.
 */
import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
export const ogAlt = "FinalWhistle — settled by proof, not by vote";

const PITCH = "#070a07";
const INK = "#0b100c";
const CHALK = "#f3f7ee";
const CHALK_DIM = "#9fb0a2";
const VOLT = "#c8ff2d";
const VAR = "#ff4d4d";
const LINE = "#232c25";

const whistleSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="120" height="120">
  <rect width="32" height="32" rx="7" fill="${PITCH}"/>
  <rect x="1" y="1" width="30" height="30" rx="6" fill="none" stroke="${VOLT}" stroke-width="1.3" opacity="0.55"/>
  <circle cx="8.4" cy="9.4" r="2.3" fill="none" stroke="${VOLT}" stroke-width="1.7"/>
  <rect x="7.5" y="11" width="1.8" height="3.6" rx="0.6" fill="${VOLT}"/>
  <rect x="4.3" y="14" width="12.8" height="6.2" rx="3.1" fill="${VOLT}"/>
  <circle cx="20.2" cy="17.6" r="7" fill="${VOLT}"/>
  <rect x="18.1" y="9.4" width="4.2" height="4.6" rx="1.3" fill="${PITCH}"/>
  <circle cx="20.4" cy="18.4" r="2.2" fill="${PITCH}"/>
</svg>`;

const whistleDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(whistleSvg)}`;

function Chip({ children, tone }: { children: string; tone?: "volt" }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 16px",
        borderRadius: 4,
        border: `1px solid ${tone === "volt" ? VOLT : LINE}`,
        background: tone === "volt" ? "rgba(200,255,45,0.10)" : INK,
        color: tone === "volt" ? VOLT : CHALK_DIM,
        fontSize: 22,
        letterSpacing: 2,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

export function renderSocialCard() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: PITCH,
        color: CHALK,
        padding: 64,
        position: "relative",
      }}
    >
      {/* volt signal bar down the left edge */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 14,
          background: VOLT,
        }}
      />

      {/* header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* biome-ignore lint/performance/noImgElement: next/og (Satori) only renders <img>; next/image is invalid here */}
          <img src={whistleDataUri} width={96} height={96} alt="" />
          <div
            style={{
              display: "flex",
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: 4,
              marginLeft: 22,
            }}
          >
            FINAL<span style={{ color: VOLT }}>WHISTLE</span>
          </div>
        </div>
        <Chip tone="volt">SOLANA · DEVNET</Chip>
      </div>

      {/* headline */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 1 }}>
          Settled by&nbsp;<span style={{ color: VOLT }}>proof</span>.
        </div>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 1.08 }}>
          Not by&nbsp;
          <span style={{ color: VAR, textDecoration: "line-through" }}>vote</span>.
        </div>
      </div>

      {/* sub-line */}
      <div
        style={{
          display: "flex",
          marginTop: 26,
          maxWidth: 1000,
          fontSize: 26,
          lineHeight: 1.4,
          color: CHALK_DIM,
        }}
      >
        Objective, score-based sports markets that self-settle with a cryptographic Merkle proof —
        no oracle vote, no operator.
      </div>

      {/* footer chips */}
      <div style={{ display: "flex", gap: 14, marginTop: "auto" }}>
        <Chip>USDC-ONLY</Chip>
        <Chip>NO ORACLE VOTE</Chip>
        <Chip>TXLINE MERKLE PROOF</Chip>
      </div>
    </div>,
    { ...ogSize },
  );
}
