export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False until the Supabase URL and publishable key are set (e.g. a fresh preview deploy). */
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/**
 * The public address used in canonical links, share images and the sitemap.
 * NEXT_PUBLIC_SITE_URL wins; on Vercel it falls back to the project's production
 * domain, so a wrong or missing value never points search engines elsewhere.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

/** "Forgot password?" needs working auth emails (custom SMTP in Supabase), so it is opt-in. */
export const PASSWORD_RESET = process.env.NEXT_PUBLIC_PASSWORD_RESET === "1";

export const GITHUB_SIGN_IN = process.env.NEXT_PUBLIC_AUTH_GITHUB === "1";
