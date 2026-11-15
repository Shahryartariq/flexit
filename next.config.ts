import type { NextConfig } from "next";

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabase.replace(/^http/, "ws");

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `img-src 'self' data: blob: ${supabase} https://*.google-analytics.com https://*.googletagmanager.com`,
  `connect-src 'self' ${supabase} ${supabaseWs} https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com`,
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  // Next.js streams inline scripts; a nonce would make every page dynamic.
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
].join("; ");

const nextConfig: NextConfig = {
  // Inlined at build time into every bundle, including the proxy, which on
  // Vercel doesn't see NEXT_PUBLIC_ variables at runtime.
  env: {
    FLEXIT_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    FLEXIT_SUPABASE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  },
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Share-image fonts are read from disk at request time.
  outputFileTracingIncludes: { "/**": ["./src/assets/og/*.woff"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // frame-ancestors covers modern browsers; this covers old ones.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
