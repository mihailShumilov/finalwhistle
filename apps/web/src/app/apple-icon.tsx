import { ImageResponse } from "next/og";

// Apple touch icon (home-screen). Apple masks its own rounded corners, so we fill the full
// square with the brand pitch and centre the volt whistle mark.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const PITCH = "#070a07";
const VOLT = "#c8ff2d";

const whistleSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="132" height="132">
  <circle cx="8.4" cy="9.4" r="2.3" fill="none" stroke="${VOLT}" stroke-width="1.7"/>
  <rect x="7.5" y="11" width="1.8" height="3.6" rx="0.6" fill="${VOLT}"/>
  <rect x="4.3" y="14" width="12.8" height="6.2" rx="3.1" fill="${VOLT}"/>
  <circle cx="20.2" cy="17.6" r="7" fill="${VOLT}"/>
  <rect x="18.1" y="9.4" width="4.2" height="4.6" rx="1.3" fill="${PITCH}"/>
  <circle cx="20.4" cy="18.4" r="2.2" fill="${PITCH}"/>
</svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: PITCH,
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: next/og (Satori) only renders <img>; next/image is invalid here */}
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(whistleSvg)}`}
        width={132}
        height={132}
        alt=""
      />
    </div>,
    { ...size },
  );
}

// Pre-render to a static file for `output: export`.
export const dynamic = "force-static";
