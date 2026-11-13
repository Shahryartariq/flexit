"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Avatar } from "./Avatar";
import { Comments } from "./Comments";
import { FollowButton } from "./FollowButton";
import { LikeButton } from "./LikeButton";
import { SkillChip } from "./SkillChip";
import { PostEditor } from "./PostEditor";
import { ReportButton } from "./ReportButton";
import { useNow } from "@/lib/clock";
import { isConfigured } from "@/lib/env";
import { fullDate, linkLabel, timeAgo } from "@/lib/format";
import { publicImageUrl } from "@/lib/images";
import { fetchLikedIds, friendlyError } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { getSkill, skillColors } from "@/lib/skills";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import type { Comment, Post } from "@/lib/types";

export function PostDetail({
  initialPost,
  initialComments,
  serverNow,
}: {
  initialPost: Post;
  initialComments: Comment[];
  serverNow: number;
}) {
  const session = useSession();
  const router = useRouter();
  const now = useNow(serverNow);
  const [post, setPost] = useState(initialPost);
  const [liked, setLiked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = session.status === "signed-in" ? session.user.id : null;
  const isOwner = userId === post.author_id;
  const image = publicImageUrl("post-images", post.image_path);
  const skill = getSkill(post.skill_slug);
  const colors = skillColors(post.skill_slug);

  useEffect(() => {
    if (!userId) return;
    void fetchLikedIds(supabaseBrowser(), userId, [post.id]).then((ids) => setLiked(ids.has(post.id)));
  }, [userId, post.id]);

  // Like and comment counts stay live while the page is open.
  useEffect(() => {
    if (!isConfigured) return;
    const db = supabaseBrowser();
    const channel = db
      .channel(`post-${post.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts", filter: `id=eq.${post.id}` },
        (payload: RealtimePostgresChangesPayload<Post>) => {
          const row = payload.new as Post;
          setPost((p) => ({ ...p, like_count: row.like_count, comment_count: row.comment_count }));
        },
      )
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [post.id]);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, url });
        return;
      } catch {
        // Fall back to copying when the share sheet is dismissed or unavailable.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Couldn't copy the link", { tone: "error" });
    }
  }

  async function remove() {
    if (!window.confirm("Delete this flex? This can't be undone.")) return;
    setDeleting(true);
    setError(null);
    const db = supabaseBrowser();
    const { error: failure } = await db.from("posts").delete().eq("id", post.id);
    if (failure) {
      setError(friendlyError(failure.message));
      setDeleting(false);
      return;
    }
    if (post.image_path) await db.storage.from("post-images").remove([post.image_path]);
    toast("Flex deleted");
    router.push(`/u/${post.author.username}`);
    router.refresh();
  }

  return (
    <article className="card grid overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="relative bg-paper lg:min-h-[560px]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- resized to 1600px on upload
          <img src={image} alt={post.title} className="size-full max-h-[80vh] object-contain lg:max-h-none" />
        ) : (
          <div
            className="flex aspect-[4/3] size-full flex-col justify-between p-8 lg:aspect-auto"
            style={{ background: colors.background, color: colors.ink }}
          >
            <span className="text-6xl" aria-hidden="true">
              {skill.emoji}
            </span>
            <p className="display-tight text-4xl leading-none font-extrabold sm:text-5xl">{post.title}</p>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b border-line p-5">
          <Link href={`/u/${post.author.username}`} tabIndex={-1} aria-hidden="true">
            <Avatar name={post.author.display_name} username={post.author.username} path={post.author.avatar_path} />
          </Link>
          <div className="min-w-0 flex-1 leading-tight">
            <Link href={`/u/${post.author.username}`} className="block truncate font-semibold hover:underline">
              {post.author.display_name}
            </Link>
            <p className="truncate text-sm text-muted">{post.author.headline || `@${post.author.username}`}</p>
          </div>
          {!isOwner && <FollowButton profileId={post.author_id} compact />}
        </header>

        <div className="flex flex-col gap-4 p-5">
          {post.hidden && (
            <p role="status" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              This flex is hidden from everyone else because several people reported it.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <SkillChip slug={post.skill_slug} />
            <time dateTime={post.created_at} title={fullDate(post.created_at)} suppressHydrationWarning>
              {timeAgo(post.created_at, now)}
            </time>
            {post.edited_at && (
              <span title={`Edited ${fullDate(post.edited_at)}`}>· edited</span>
            )}
          </div>
          {editing ? (
            <PostEditor
              post={post}
              onCancel={() => setEditing(false)}
              onSaved={(changes) => {
                setPost((p) => ({ ...p, ...changes }));
                setEditing(false);
                toast("Changes saved");
              }}
            />
          ) : (
            <>
          <h1 className="display text-2xl leading-tight font-extrabold sm:text-3xl">{post.title}</h1>
          {post.body && <p className="text-[1.02rem] whitespace-pre-line">{post.body}</p>}
          {post.link && (
            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="btn btn-ghost self-start"
            >
              Open {linkLabel(post.link)} ↗
            </a>
          )}
            </>
          )}

          <div className="-ml-2 flex flex-wrap items-center gap-1">
            <LikeButton
              postId={post.id}
              likes={post.like_count}
              liked={liked}
              onChange={(value) => {
                setLiked(value);
                setPost((p) => ({ ...p, like_count: Math.max(0, p.like_count + (value ? 1 : -1)) }));
              }}
            />
            <button type="button" onClick={() => void share()} className="rounded-full px-3 py-1 font-semibold hover:bg-paper">
              Share
            </button>
            {isOwner && !editing && (
              <button type="button" onClick={() => setEditing(true)} className="rounded-full px-3 py-1 font-semibold hover:bg-paper">
                Edit
              </button>
            )}
            {!isOwner && userId && <ReportButton postId={post.id} />}
            {isOwner && (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={deleting}
                aria-label="Delete this flex"
                className="rounded-full px-3 py-1 font-semibold text-danger hover:bg-paper disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <Comments postId={post.id} postAuthorId={post.author_id} initialComments={initialComments} now={now} />
      </div>
    </article>
  );
}
