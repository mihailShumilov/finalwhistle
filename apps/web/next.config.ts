import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@finalwhistle/sdk", "@finalwhistle/shared"],
  // Static export: the app is a client-rendered SPA (data via the read API), so it ships as
  // static assets to Cloudflare with no server runtime. Dynamic market/receipt views read the
  // market address from a query param.
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
