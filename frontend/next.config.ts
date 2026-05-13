import fs from "node:fs";

import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

/** When Next runs inside Docker, 127.0.0.1 is the frontend container — use the compose service name. */
function devBackendProxyTarget(): string {
  const fromEnv = process.env.BACKEND_PROXY_TARGET?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  try {
    if (fs.existsSync("/.dockerenv")) {
      return "http://backend:8000";
    }
  } catch {
    /* ignore */
  }
  return "http://127.0.0.1:8020";
}

const nextConfig: NextConfig = {
  output: "standalone",
  /** Dev-only: browser calls same-origin /api/... → Next forwards to backend (fixes CORS + wrong localhost from LAN). */
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }
    const backend = devBackendProxyTarget();
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default withSerwist(nextConfig);
