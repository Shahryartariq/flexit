"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { GitHubButton } from "./GitHubButton";
import { isConfigured } from "@/lib/env";
import { safeNext } from "@/lib/next-path";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { firstIssue, signUpSchema, usernameSchema } from "@/lib/validation";

type Availability = "idle" | "checking" | "free" | "taken" | "invalid";

export function SignUpForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [form, setForm] = useState({ display_name: "", username: "", email: "", password: "" });
  const [availability, setAvailability] = useState<{ name: string; state: Availability }>({
    name: "",
    state: "idle",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const username = form.username.trim().toLowerCase();

  // Check the username while the person types (debounced).
  useEffect(() => {
    if (!username || !isConfigured || !usernameSchema.safeParse(username).success) return;
    const timer = setTimeout(async () => {
      setAvailability({ name: username, state: "checking" });
      const { data } = await supabaseBrowser().from("profiles").select("id").eq("username", username).maybeSingle();
      setAvailability({ name: username, state: data ? "taken" : "free" });
    }, 350);
    return () => clearTimeout(timer);
  }, [username]);

  const usernameState: Availability = !username
    ? "idle"
    : !usernameSchema.safeParse(username).success
      ? "invalid"
      : availability.name === username
        ? availability.state
        : "checking";

  function update(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: event.target.value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      setError(firstIssue(parsed.error));
      return;
    }
    if (usernameState === "taken") {
      setError("That username is taken. Try another.");
      return;
    }
    if (!isConfigured) {
      setError("This copy of Flexit isn't connected to Supabase yet.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: failure } = await supabaseBrowser().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { username: parsed.data.username, display_name: parsed.data.display_name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (failure) {
      setError(
        /already registered|already exists/i.test(failure.message)
          ? "There's already an account with that email. Sign in instead."
          : /password/i.test(failure.message)
            ? failure.message
            : "Couldn't create your account. Please try again.",
      );
      return;
    }
    if (data.session) {
      router.replace(next === "/" ? "/new" : next);
      router.refresh();
    } else {
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <div className="flex flex-col gap-2 text-center" role="status">
        <p className="display text-xl font-bold">Check your email</p>
        <p className="text-muted">
          We sent a link to <strong className="text-ink">{form.email}</strong>. Open it to finish signing up.
        </p>
      </div>
    );
  }

  const hint = {
    idle: "3–20 lowercase letters, numbers or underscores.",
    checking: "Checking…",
    free: "Nice, it's yours.",
    taken: "Taken. Try another.",
    invalid: "Use 3–20 lowercase letters, numbers or underscores.",
  }[usernameState];

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <GitHubButton next={next} />
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Your name
        <input className="field font-normal" autoComplete="name" maxLength={50} value={form.display_name} onChange={update("display_name")} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Username
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">@</span>
          <input
            className="field pl-8 font-normal"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            value={form.username}
            onChange={update("username")}
            aria-describedby="username-hint"
            aria-invalid={usernameState === "taken" || usernameState === "invalid"}
          />
        </div>
        <span
          id="username-hint"
          className={`text-xs font-normal ${usernameState === "free" ? "text-[oklch(0.55_0.15_150)]" : usernameState === "taken" || usernameState === "invalid" ? "text-danger" : "text-muted"}`}
        >
          {hint}
        </span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Email
        <input className="field font-normal" type="email" autoComplete="email" value={form.email} onChange={update("email")} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Password
        <input
          className="field font-normal"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={form.password}
          onChange={update("password")}
        />
        <span className="text-xs font-normal text-muted">At least 8 characters.</span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Creating your account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={`/sign-in${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
