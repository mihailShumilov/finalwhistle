import { ogAlt, ogContentType, ogSize, renderSocialCard } from "../lib/og";

export const alt = ogAlt;
export const size = ogSize;
export const contentType = ogContentType;

export default function OpengraphImage() {
  return renderSocialCard();
}

// Pre-render to a static file for `output: export`.
export const dynamic = "force-static";
