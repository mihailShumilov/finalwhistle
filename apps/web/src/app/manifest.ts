import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "../lib/seo";

// Generates /manifest.webmanifest — makes the app installable (PWA) and gives Android/Chrome a
// branded icon + theme instead of a generic screenshot.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — settled by proof, not by vote`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#070a07",
    theme_color: "#070a07",
    categories: ["finance", "sports", "productivity"],
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180", purpose: "maskable" },
    ],
  };
}

// Pre-render to a static file for `output: export`.
export const dynamic = "force-static";
