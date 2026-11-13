import type { NextConfig } from "next";

// Map one shared backend URL into a browser-visible Next.js environment variable.
const apiBase = process.env.THERMATRUST_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the project root so a stray lockfile in a parent folder is not picked up.
  turbopack: { root: process.cwd() },
  env: { NEXT_PUBLIC_API_BASE_URL: apiBase },
  // Keep "/api/x/" as written; Next would otherwise 308 it to "/api/x" and the
  // API (whose URLs all end in "/") would redirect straight back.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    // Only for testing the offline mode against a local API on one origin
    // (service workers need a same-origin API to be exercised properly).
    // Next drops the trailing slash before matching and every API URL ends in
    // one, so it is put back on the destination.
    const target = process.env.API_PROXY_TARGET;
    return target ? [{ source: "/api/:path*", destination: `${target}/api/:path*/` }] : [];
  },
  async headers() {
    return [
      {
        // The worker must always be re-fetched so a new deploy replaces the old one promptly.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
