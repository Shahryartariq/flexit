"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/compress";
import { ACCEPTED_TYPES, imagePath, MAX_UPLOAD_BYTES } from "@/lib/images";
import { friendlyError } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { SKILLS, skillColors } from "@/lib/skills";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { firstIssue, postSchema } from "@/lib/validation";

type Picked = { file: File; url: string };

type Draft = { skill: string; title: string; body: string; link: string };

const DRAFT_KEY = "flexit:draft";

function readDraft(): Draft {
  const empty = { skill: "", title: "", body: "", link: "" };
  if (typeof window === "undefined") return empty;
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") };
  } catch {
    return empty;
  }
}

const PLACEHOLDERS: Record<string, string> = {
  development: "Shipped my first full-stack app",
  design: "Redesigned my portfolio from scratch",
  art: "Finished my first oil painting",
  music: "Played my first song all the way through",
  gaming: "Beat the final boss on hard mode",
  fitness: "Ran my first 10K under an hour",
  cooking: "Nailed homemade biryani",
  writing: "Published my first blog post",
  photography: "Got my first night-sky shot",
  learning: "Passed my AWS certification",
  business: "Got my first paying customer",
  other: "Learned to solve a Rubik's cube",
};

export function NewPostForm() {
  const session = useSession();
  const router = useRouter();
  const [draft] = useState(readDraft);
  const [skill, setSkill] = useState<string>(draft.skill);
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [link, setLink] = useState(draft.link);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session.status === "signed-out") router.replace("/sign-in?next=/new");
  }, [session.status, router]);

  // Keep the text as a draft on this device, so a closed tab doesn't lose it.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (skill || title || body || link) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ skill, title, body, link }));
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      } catch {
        // Storage full or blocked: drafts are a nice-to-have.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [skill, title, body, link]);

  // Paste a screenshot straight from the clipboard.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) {
        event.preventDefault();
        pickRef.current(file);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  // Free the preview's object URL when it's replaced or the form unmounts.
  useEffect(() => () => {
    if (picked) URL.revokeObjectURL(picked.url);
  }, [picked]);

  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });

  function pick(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Use a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That image is over 12 MB. Try a smaller one.");
      return;
    }
    setError(null);
    setPicked({ file, url: URL.createObjectURL(file) });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (session.status !== "signed-in") return;
    const parsed = postSchema.safeParse({ skill_slug: skill, title, body, link });
    if (!parsed.success) {
      setError(firstIssue(parsed.error));
      return;
    }
    setError(null);
    const db = supabaseBrowser();
    let uploaded: string | null = null;
    try {
      if (picked) {
        setBusy("Preparing your photo…");
        const { blob, extension } = await compressImage(picked.file);
        uploaded = imagePath(session.user.id, extension);
        setBusy("Uploading…");
        const { error: uploadError } = await db.storage
          .from("post-images")
          .upload(uploaded, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
        if (uploadError) throw new Error(uploadError.message);
      }
      setBusy("Posting…");
      const { data, error: insertError } = await db
        .from("posts")
        .insert({ ...parsed.data, image_path: uploaded })
        .select("id")
        .single();
      if (insertError) throw new Error(insertError.message);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      toast("Flexed! It's live now.");
      router.push(`/p/${data.id}`);
    } catch (e) {
      if (uploaded) await db.storage.from("post-images").remove([uploaded]);
      const message = e instanceof Error ? e.message : String(e);
      setError(/image|browser/i.test(message) && !/row-level/.test(message) ? message : friendlyError(message));
      setBusy(null);
    }
  }

  if (session.status !== "signed-in") {
    return <div className="card skeleton h-[520px]" aria-label="Loading" />;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">Which skill is this?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SKILLS.map((option) => {
            const active = option.slug === skill;
            const colors = skillColors(option.slug);
            return (
              <label
                key={option.slug}
                className="flex cursor-pointer items-center gap-2 rounded-xl border-[1.5px] px-3 py-2.5 text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
                style={
                  active
                    ? { background: colors.background, borderColor: colors.strong, color: colors.ink }
                    : { background: "var(--card)", borderColor: "var(--line)" }
                }
              >
                <input
                  type="radio"
                  name="skill"
                  value={option.slug}
                  checked={active}
                  onChange={() => setSkill(option.slug)}
                  className="sr-only"
                />
                <span aria-hidden="true" className="text-lg">
                  {option.emoji}
                </span>
                {option.name}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        What did you make, learn or achieve?
        <input
          className="field text-base font-normal"
          maxLength={100}
          value={title}
          placeholder={PLACEHOLDERS[skill] ?? "Finished something I'm proud of"}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold" id="photo-label">
          Photo or screenshot <span className="font-normal text-muted">(optional)</span>
        </span>
        <div
          role="button"
          tabIndex={0}
          aria-labelledby="photo-label"
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInput.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={`relative flex min-h-48 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${dragging ? "border-accent bg-accent/5" : "border-line bg-card hover:border-ink"}`}
        >
          {picked ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview
            <img src={picked.url} alt="Your photo" className="max-h-96 w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-1 p-6 text-center text-sm text-muted">
              <span className="text-3xl" aria-hidden="true">
                🖼️
              </span>
              <span>
                <strong className="text-ink">Drop an image</strong> or click to choose
              </span>
              <span>JPG, PNG or WebP, up to 12 MB. You can also paste a screenshot.</span>
              <span>We resize it and remove location data.</span>
            </div>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a photo"
          data-testid="photo-input"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {picked && (
          <button type="button" className="self-start text-sm font-semibold text-muted hover:text-danger" onClick={() => setPicked(null)}>
            Remove photo
          </button>
        )}
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        <span>
          The story <span className="font-normal text-muted">(optional)</span>
        </span>
        <textarea
          className="field min-h-28 font-normal"
          maxLength={1000}
          value={body}
          placeholder="How long did it take? What was hard? What's next?"
          onChange={(e) => setBody(e.target.value)}
        />
        <span className="self-end text-xs font-normal text-muted tabular-nums">{body.length}/1000</span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        <span>
          Link <span className="font-normal text-muted">(optional: live demo, video, store page…)</span>
        </span>
        <input
          className="field font-normal"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          value={link}
          placeholder="https://"
          onChange={(e) => setLink(e.target.value)}
        />
      </label>

      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {(title || body || link) && (
          <span className="mr-auto text-xs text-muted">Draft saved on this device</span>
        )}
        <Link href="/" className="btn btn-ghost">
          Cancel
        </Link>
        <button type="submit" className="btn btn-primary min-w-32" disabled={Boolean(busy)}>
          {busy ?? "Flex it"}
        </button>
      </div>
    </form>
  );
}
