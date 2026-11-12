"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { GitHubButton } from "./GitHubButton";
import { isConfigured } from "@/lib/env";
import { safeNext } from "@/lib/next-path";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function SignInForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "link" ? "That sign-in link has expired. Sign in again." : null,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isConfigured) {
      setError("This copy of Flexit isn't connected to Supabase yet.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: failure } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (failure) {
      setBusy(false);
      setError(
        /confirm/i.test(failure.message)
          ? "Confirm your email first: check your inbox for the link."
          : "Wrong email or password.",
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <GitHubButton next={next} />
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Email
        <input
          className="field font-normal"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Password
        <input
          className="field font-normal"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href={`/sign-up${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
