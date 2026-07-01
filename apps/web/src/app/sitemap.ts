import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/seo";

// Generates /sitemap.xml for the four indexable routes. `/market` and `/receipt` are the base
// (parameterless) views; the query-string variants are per-user and intentionally left out.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/create`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/market`, lastModified, changeFrequency: "hourly", priority: 0.7 },
    { url: `${SITE_URL}/receipt`, lastModified, changeFrequency: "weekly", priority: 0.6 },
  ];
}

// Pre-render to a static file for `output: export`.
export const dynamic = "force-static";
