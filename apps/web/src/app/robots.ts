import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/seo";

// Generates /robots.txt. We *want* AI answer engines to index and cite FinalWhistle (GEO), so
// every major crawler — including the AI ones that default to being blocked — is explicitly
// allowed. Listing them by name is a positive opt-in signal, not just an absence of a block.
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
  "Amazonbot",
  "meta-externalagent",
  "Bytespider",
  "CCBot",
  "cohere-ai",
  "DuckAssistBot",
  "MistralAI-User",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

// Pre-render to a static file for `output: export`.
export const dynamic = "force-static";
