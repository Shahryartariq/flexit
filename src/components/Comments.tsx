"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Avatar } from "./Avatar";
import { isConfigured } from "@/lib/env";
import { timeAgo } from "@/lib/format";
import { friendlyError } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { COMMENT_SELECT, type Comment } from "@/lib/types";
import { commentSchema, firstIssue } from "@/lib/validation";

export function Comments({
  postId,
  postAuthorId,
  initialComments,
  now,
}: {
  postId: string;
  postAuthorId: string;
  initialComments: Comment[];
  now: number;
}) {
  const session = useSession();
  const pathname = usePathname();
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = session.status === "signed-in" ? session.user.id : null;

  useEffect(() => {
    if (!isConfigured) return;
    const db = supabaseBrowser();
    const channel = db
      .channel(`comments-${postId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
        (payload: RealtimePostgresChangesPayload<{ id: string }>) => {
          const id = (payload.new as { id: string }).id;
          void db
            .from("comments")
            .select(COMMENT_SELECT)
            .eq("id", id)
            .maybeSingle()
            .then(({ data }) => {
              if (!data) return;
              const comment = data as unknown as Comment;
              setComments((list) => (list.some((c) => c.id === comment.id) ? list : [...list, comment]));
            });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "comments" },
        (payload: RealtimePostgresChangesPayload<{ id: string }>) => {
          const id = (payload.old as { id?: string }).id;
          if (id) setComments((list) => list.filter((c) => c.id !== id));
        },
      )
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [postId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = commentSchema.safeParse(draft);
    if (!parsed.success) {
      setError(firstIssue(parsed.error));
      return;
    }
    setSending(true);
    setError(null);
    const { data, error: failure } = await supabaseBrowser()
      .from("comments")
      .insert({ post_id: postId, body: parsed.data })
      .select(COMMENT_SELECT)
      .single();
    setSending(false);
    if (failure) {
      setError(friendlyError(failure.message));
      return;
    }
    const comment = data as unknown as Comment;
    setComments((list) => (list.some((c) => c.id === comment.id) ? list : [...list, comment]));
    setDraft("");
  }

  async function remove(id: string) {
    const { error: failure } = await supabaseBrowser().from("comments").delete().eq("id", id);
    if (failure) setError(friendlyError(failure.message));
    else setComments((list) => list.filter((c) => c.id !== id));
  }

  return (
    <section id="comments" className="flex flex-1 flex-col border-t border-line" aria-labelledby="comments-title">
      <h2 id="comments-title" className="px-5 pt-4 text-sm font-semibold text-muted">
        {comments.length === 0 ? "No comments yet" : `Comments · ${comments.length}`}
      </h2>
      <ol className="flex max-h-[420px] flex-col gap-4 overflow-y-auto px-5 py-4" data-testid="comments">
        {comments.map((comment) => (
          <li key={comment.id} className="flex gap-3">
            <Link href={`/u/${comment.author.username}`} className="shrink-0">
              <Avatar
                name={comment.author.display_name}
                username={comment.author.username}
                path={comment.author.avatar_path}
                size="sm"
              />
            </Link>
            <div className="min-w-0 flex-1 text-sm">
              <p>
                <Link href={`/u/${comment.author.username}`} className="font-semibold hover:underline">
                  {comment.author.display_name}
                </Link>{" "}
                <span className="break-words whitespace-pre-line">{comment.body}</span>
              </p>
              <p className="mt-0.5 flex gap-3 text-xs text-muted">
                <time dateTime={comment.created_at} suppressHydrationWarning>
                  {timeAgo(comment.created_at, now)}
                </time>
                {userId && (userId === comment.author_id || userId === postAuthorId) && (
                  <button type="button" className="hover:text-danger" onClick={() => void remove(comment.id)}>
                    Delete
                  </button>
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-auto border-t border-line p-4">
        {session.status === "signed-in" ? (
          <form onSubmit={submit} className="flex items-end gap-2">
            <label htmlFor="comment" className="sr-only">
              Add a comment
            </label>
            <textarea
              id="comment"
              rows={1}
              maxLength={500}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Say something nice…"
              className="field min-h-11 resize-none"
            />
            <button type="submit" className="btn btn-ink" disabled={sending || !draft.trim()}>
              {sending ? "…" : "Post"}
            </button>
          </form>
        ) : session.status === "signed-out" ? (
          <p className="text-sm text-muted">
            <Link href={`/sign-in?next=${encodeURIComponent(pathname)}`} className="font-semibold text-ink underline">
              Sign in
            </Link>{" "}
            to comment.
          </p>
        ) : null}
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
