export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False until the Supabase URL and publishable key are set (e.g. a fresh preview deploy). */
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const GITHUB_SIGN_IN = process.env.NEXT_PUBLIC_AUTH_GITHUB === "1";
