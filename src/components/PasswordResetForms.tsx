"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { friendlyError } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { firstIssue, passwordSchema } from "@/lib/validation";

/** Sends the reset link. Always says the same thing, so it can't be used to find accounts. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: failure } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (failure && /rate limit|too many/i.test(failure.message)) {
      setError("Too many requests. Wait a few minutes and try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-2 text-center" role="status">
        <p className="display text-xl font-bold">Check your email</p>
        <p className="text-muted">
          If there&apos;s an account for <strong className="text-ink">{email.trim()}</strong>, a reset link is on its way.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Email
        <input className="field font-normal" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-semibold text-ink underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/** Opened from the email link: /auth/callback has already signed the person in. */
export function ResetPasswordForm() {
  const session = useSession();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session.status === "loading") return <div className="skeleton h-40 rounded-xl" />;
  if (session.status === "signed-out") {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p>This link has expired or was already used.</p>
        <Link href="/forgot-password" className="btn btn-primary self-center">
          Send a new link
        </Link>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setError(firstIssue(parsed.error));
    setBusy(true);
    setError(null);
    const { error: failure } = await supabaseBrowser().auth.updateUser({ password: parsed.data });
    setBusy(false);
    if (failure) return setError(/password/i.test(failure.message) ? failure.message : friendlyError(failure.message));
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        New password
        <input
          className="field font-normal"
          type="password"
          autoComplete="new-password"
          minLength={8}
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
        {busy ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
