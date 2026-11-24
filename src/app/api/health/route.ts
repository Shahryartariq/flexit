import { connection } from "next/server";
import { isConfigured } from "@/lib/env";
import { supabasePublic } from "@/lib/supabase/public";

const NO_STORE = { "cache-control": "no-store" };

/**
 * Makes one small database read and says whether it worked.
 * The keep-alive workflow calls it every day: Supabase pauses free projects
 * after a week without activity, and a failing check shows up in GitHub.
 */
export async function GET() {
  await connection();
  if (!isConfigured) {
    return Response.json({ ok: false, error: "Supabase isn't configured" }, { status: 503, headers: NO_STORE });
  }
  const started = Date.now();
  const { count, error } = await supabasePublic().from("skills").select("slug", { count: "exact", head: true });
  if (error) {
    return Response.json({ ok: false, error: "Database unreachable" }, { status: 503, headers: NO_STORE });
  }
  return Response.json({ ok: true, skills: count, ms: Date.now() - started }, { headers: NO_STORE });
}
