import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/next-path";
import { supabaseServer } from "@/lib/supabase/server";

/** Finishes email-confirmation and GitHub sign-ins by swapping the code for a session cookie. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));
}
