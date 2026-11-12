"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { count } from "@/lib/format";
import { friendlyError } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"
        fill={filled ? "var(--accent)" : "none"}
        stroke={filled ? "var(--accent)" : "currentColor"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Optimistic like toggle. Signed-out visitors are sent to sign in first. */
export function LikeButton({
  postId,
  likes,
  liked,
  onChange,
}: {
  postId: string;
  likes: number;
  liked: boolean;
  onChange: (liked: boolean) => void;
}) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [bounce, setBounce] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (session.status !== "signed-in") {
      router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (busy) return;
    const next = !liked;
    setBusy(true);
    setError(null);
    onChange(next);
    if (next) setBounce((n) => n + 1);
    const db = supabaseBrowser().from("likes");
    const { error: failure } = next
      ? await db.insert({ post_id: postId })
      : await db.delete().eq("post_id", postId).eq("user_id", session.user.id);
    if (failure && !/duplicate key/.test(failure.message)) {
      onChange(!next);
      setError(friendlyError(failure.message));
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      title={error ?? undefined}
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-semibold hover:bg-paper"
    >
      <span key={bounce} className={bounce ? "pop" : undefined}>
        <HeartIcon filled={liked} />
      </span>
      <span className="tabular-nums">{count(likes)}</span>
    </button>
  );
}
