import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { z } from "zod";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Server-side settings. The build stops with the setting's name when one is not valid.
const env = z
  .object({
    // Spring Boot API (backend/). The browser calls /api/... on this site; Next.js forwards it here.
    BACKEND_URL: z.url().default("http://localhost:8080"),
  })
  .parse({ BACKEND_URL: process.env.BACKEND_URL || undefined });

const backendUrl = env.BACKEND_URL.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
  images: {
    // Uploaded covers/panels are served from object storage (local MinIO in development).
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", port: "9000", pathname: "/**" },
      { protocol: "http", hostname: "localhost", port: "9000", pathname: "/**" },
      ...(process.env.IMAGE_HOST
        ? [{ protocol: "https" as const, hostname: process.env.IMAGE_HOST, pathname: "/**" }]
        : []),
    ],
    // Next.js blocks optimizing images from private IPs; the local MinIO is one.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
