"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { compressImage } from "@/lib/compress";
import { ACCEPTED_TYPES, imagePath, MAX_UPLOAD_BYTES } from "@/lib/images";
import { friendlyError } from "@/lib/queries";
import { refreshProfile, signOut, useSession } from "@/lib/session";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { firstIssue, profileSchema } from "@/lib/validation";

export function SettingsForm() {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session.status === "signed-out") router.replace("/sign-in?next=/settings");
  }, [session.status, router]);

  if (session.status !== "signed-in" || !session.profile) {
    return <div className="card skeleton h-[480px]" aria-label="Loading" />;
  }
  return <Editor key={session.profile.id} />;
}

function Editor() {
  const session = useSession();
  const router = useRouter();
  const profile = session.status === "signed-in" ? session.profile! : null;
  const [form, setForm] = useState({
    display_name: profile?.display_name ?? "",
    headline: profile?.headline ?? "",
    bio: profile?.bio ?? "",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!profile || session.status !== "signed-in") return null;
  const userId = session.user.id;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      setMessage({ kind: "error", text: firstIssue(parsed.error) });
      return;
    }
    setBusy("Saving…");
    setMessage(null);
    const { error } = await supabaseBrowser().from("profiles").update(parsed.data).eq("id", userId);
    setBusy(null);
    if (error) {
      setMessage({ kind: "error", text: friendlyError(error.message) });
      return;
    }
    await refreshProfile();
    setMessage({ kind: "ok", text: "Saved." });
    router.refresh();
  }

  async function changeAvatar(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_UPLOAD_BYTES) {
      setMessage({ kind: "error", text: "Use a JPG, PNG or WebP image under 12 MB." });
      return;
    }
    setBusy("Uploading photo…");
    setMessage(null);
    const db = supabaseBrowser();
    try {
      const { blob, extension } = await compressImage(file, 512, 0.9);
      const path = imagePath(userId, extension);
      const { error: uploadError } = await db.storage
        .from("avatars")
        .upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
      if (uploadError) throw new Error(uploadError.message);
      const { error } = await db.from("profiles").update({ avatar_path: path }).eq("id", userId);
      if (error) {
        await db.storage.from("avatars").remove([path]);
        throw new Error(error.message);
      }
      if (profile?.avatar_path) await db.storage.from("avatars").remove([profile.avatar_path]);
      await refreshProfile();
      setMessage({ kind: "ok", text: "Photo updated." });
    } catch (e) {
      setMessage({ kind: "error", text: friendlyError(e instanceof Error ? e.message : String(e)) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-5 p-6">
        <div className="flex items-center gap-5">
          <Avatar name={profile.display_name} username={profile.username} path={profile.avatar_path} size="lg" />
          <div className="flex flex-col gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => fileInput.current?.click()} disabled={Boolean(busy)}>
              Change photo
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose a profile photo"
              onChange={(e) => {
                void changeAvatar(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="text-sm text-muted">
              Your profile:{" "}
              <Link className="font-semibold text-ink underline" href={`/u/${profile.username}`}>
                /u/{profile.username}
              </Link>
            </p>
          </div>
        </div>

        <form onSubmit={save} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Name
            <input
              className="field font-normal"
              maxLength={50}
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>
              Headline <span className="font-normal text-muted">(one line about you)</span>
            </span>
            <input
              className="field font-normal"
              maxLength={80}
              placeholder="Full-stack developer · weekend guitarist"
              value={form.headline}
              onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Bio
            <textarea
              className="field min-h-24 font-normal"
              maxLength={280}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
            <span className="self-end text-xs font-normal text-muted tabular-nums">{form.bio.length}/280</span>
          </label>
          {message && (
            <p role={message.kind === "error" ? "alert" : "status"} className={`text-sm ${message.kind === "error" ? "text-danger" : "text-muted"}`}>
              {message.text}
            </p>
          )}
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={Boolean(busy)}>
              {busy ?? "Save changes"}
            </button>
          </div>
        </form>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3 p-6">
        <div>
          <h2 className="font-semibold">Signed in as</h2>
          <p className="text-sm text-muted">{session.user.email}</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={async () => {
            await signOut();
            router.push("/");
            router.refresh();
          }}
        >
          Sign out
        </button>
      </section>

      <DeleteAccount userId={userId} username={profile.username} />
    </div>
  );
}

/** Removes the person's uploads, then their account and everything they posted. */
function DeleteAccount({ userId, username }: { userId: string; username: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const db = supabaseBrowser();
    try {
      for (const bucket of ["post-images", "avatars"] as const) {
        const { data } = await db.storage.from(bucket).list(userId, { limit: 1000 });
        const paths = (data ?? []).map((file) => `${userId}/${file.name}`);
        if (paths.length) await db.storage.from(bucket).remove(paths);
      }
      const { error: failure } = await db.rpc("delete_my_account");
      if (failure) throw new Error(failure.message);
      await signOut();
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : String(e)));
      setBusy(false);
    }
  }

  return (
    <section className="card flex flex-col gap-3 border-danger/40 p-6" aria-labelledby="delete-title">
      <h2 id="delete-title" className="font-semibold text-danger">
        Delete account
      </h2>
      <p className="text-sm text-muted">
        This permanently deletes your profile, every flex and photo you posted, your likes, comments and follows. It
        can&apos;t be undone.
      </p>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Type your username ({username}) to confirm
        <input
          className="field font-normal"
          autoCapitalize="none"
          spellCheck={false}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn self-start bg-danger text-accent-ink"
        disabled={busy || confirm.trim().toLowerCase() !== username}
        onClick={() => void remove()}
      >
        {busy ? "Deleting…" : "Delete my account"}
      </button>
    </section>
  );
}
