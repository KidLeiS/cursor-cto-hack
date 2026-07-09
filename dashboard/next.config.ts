import type { NextConfig } from "next";

/** Keep this file in the dashboard package so Vercel rebuilds when Root Directory is `dashboard`. */
const nextConfig: NextConfig = {
  transpilePackages: [],
  poweredByHeader: false,
};

export default nextConfig;
