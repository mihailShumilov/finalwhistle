import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@finalwhistle/sdk", "@finalwhistle/shared"],
  // Workspace packages pull in @coral-xyz/anchor (web3.js); keep the build lean.
  reactStrictMode: true,
};

export default nextConfig;
