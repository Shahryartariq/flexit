import { NextResponse, type NextRequest } from "next/server";
import { isConfigured, SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Flex and profile pages stream, so once rendering starts the status is 200.
 * This check runs first, so a missing flex or person gets a real 404 (and
 * search engines drop dead links). Mixed-case usernames redirect to lowercase.
 * If Supabase is slow or down, the page renders as usual.
 */
export async function proxy(request: NextRequest) {
  const response = await check(request);
  response.headers.set("x-flexit-check", isConfigured ? "on" : "off");
  return response;
}

async function check(request: NextRequest) {
  if (!isConfigured || request.headers.get("next-router-prefetch")) return NextResponse.next();
  const [, kind, raw] = request.nextUrl.pathname.split("/");
  const value = decodeURIComponent(raw ?? "");

  if (kind === "u") {
    const username = value.toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return missing(request);
    if (username !== value) {
      const url = request.nextUrl.clone();
      url.pathname = `/u/${username}`;
      return NextResponse.redirect(url, 308);
    }
    const rows = await rest<unknown[]>(`profiles?select=id&username=eq.${username}&limit=1`);
    return rows && rows.length === 0 ? missing(request) : NextResponse.next();
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return missing(request);
  const exists = await rest<boolean>("rpc/flex_exists", { flex_id: value });
  return exists === false ? missing(request) : NextResponse.next();
}

function missing(request: NextRequest) {
  return NextResponse.rewrite(new URL("/_missing", request.url), { status: 404 });
}

async function rest<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        apikey: SUPABASE_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/p/:id", "/u/:username"],
};
