"use client";

import { useState } from "react";
import { friendlyError } from "@/lib/queries";
import { SKILLS } from "@/lib/skills";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Post } from "@/lib/types";
import { firstIssue, postSchema } from "@/lib/validation";

type Changes = Pick<Post, "skill_slug" | "title" | "body" | "link" | "edited_at">;

/** Inline form for the author to fix a flex's text, link or skill. */
export function PostEditor({
  post,
  onCancel,
  onSaved,
}: {
  post: Post;
  onCancel: () => void;
  onSaved: (changes: Changes) => void;
}) {
  const [form, setForm] = useState({
    skill_slug: post.skill_slug as string,
    title: post.title,
    body: post.body,
    link: post.link ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = postSchema.safeParse(form);
    if (!parsed.success) {
      setError(firstIssue(parsed.error));
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: failure } = await supabaseBrowser()
      .from("posts")
      .update(parsed.data)
      .eq("id", post.id)
      .select("skill_slug, title, body, link, edited_at")
      .single();
    setBusy(false);
    if (failure) {
      setError(friendlyError(failure.message));
      return;
    }
    onSaved(data as Changes);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3" aria-label="Edit flex" noValidate>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Skill
        <select
          className="field font-normal"
          value={form.skill_slug}
          onChange={(e) => setForm((f) => ({ ...f, skill_slug: e.target.value }))}
        >
          {SKILLS.map((skill) => (
            <option key={skill.slug} value={skill.slug}>
              {skill.emoji} {skill.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Title
        <input
          className="field font-normal"
          maxLength={100}
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Story
        <textarea
          className="field min-h-28 font-normal"
          maxLength={1000}
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Link
        <input
          className="field font-normal"
          inputMode="url"
          value={form.link}
          placeholder="https://"
          onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
