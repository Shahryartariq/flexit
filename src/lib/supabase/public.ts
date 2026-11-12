import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

let client: SupabaseClient | undefined;

/**
 * A session-less client for server-side reads. Everything it reads is public,
 * so it never touches cookies and the same answer is right for every visitor.
 */
export function supabasePublic() {
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
