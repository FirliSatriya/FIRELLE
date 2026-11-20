import type { NextConfig } from "next";
import { supabaseHostname } from "./src/lib/env";

/**
 * Supabase Storage host is derived from `NEXT_PUBLIC_SUPABASE_URL` so that
 * `main` (production) and `demo` can point at different Supabase projects
 * without touching this file.
 */
const storageHostname = supabaseHostname();

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Product photos are served straight from Supabase Storage's CDN, so the
    // built-in optimizer only adds a redundant proxy hop (and breaks on the
    // project's `next dev` origins). Serve the origin URLs as-is.
    unoptimized: true,
    remotePatterns: storageHostname
      ? [
          {
            protocol: "https",
            hostname: storageHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
