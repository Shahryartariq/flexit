"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { PostCard } from "./PostCard";
import { useNow } from "@/lib/clock";
import { isConfigured } from "@/lib/env";
import { fetchFollowingIds, fetchLikedIds, fetchPost, fetchPosts, PAGE_SIZE } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Post } from "@/lib/types";

type Tab = "everyone" | "following";

type PostRow = Pick<Post, "id" | "author_id" | "skill_slug" | "like_count" | "comment_count">;

/**
 * The live grid of flexes. Starts with what the server rendered, then keeps
 * itself current over Supabase Realtime: new posts wait behind a "show" pill,
 * like and comment counts update in place, deleted posts disappear.
 */
export function Feed({
  initialPosts,
  serverNow,
  skill,
  authorId,
  showTabs = false,
  empty,
}: {
  initialPosts: Post[];
  serverNow: number;
  skill?: string;
  authorId?: string;
  showTabs?: boolean;
  empty: React.ReactNode;
}) {
  const session = useSession();
  const now = useNow(serverNow);
  const userId = session.status === "signed-in" ? session.user.id : null;

  const [tab, setTab] = useState<Tab>("everyone");
  const [posts, setPosts] = useState(initialPosts);
  const [pending, setPending] = useState<Post[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [hasMore, setHasMore] = useState(initialPosts.length === PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [followingIds, setFollowingIds] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkedLikes = useRef(new Set<string>());

  const followingSet = useMemo(() => new Set(followingIds ?? []), [followingIds]);
  const filter = useMemo(
    () => ({
      skill,
      authorId,
      authorIds: tab === "following" ? (followingIds ?? []) : undefined,
    }),
    [skill, authorId, tab, followingIds],
  );

  // Which of the visible posts has the signed-in person liked?
  useEffect(() => {
    if (!userId) return;
    const unchecked = posts.map((p) => p.id).filter((id) => !checkedLikes.current.has(id));
    if (!unchecked.length) return;
    for (const id of unchecked) checkedLikes.current.add(id);
    void fetchLikedIds(supabaseBrowser(), userId, unchecked).then((ids) => {
      if (ids.size) setLiked((current) => new Set([...current, ...ids]));
    });
  }, [posts, userId]);

  // Forget likes when the person signs out (or switches account).
  useEffect(() => {
    checkedLikes.current = new Set();
    return () => setLiked(new Set());
  }, [userId]);

  // Live updates.
  useEffect(() => {
    if (!isConfigured) return;
    const db = supabaseBrowser();
    const channel = db.channel(`feed-${skill ?? "all"}-${authorId ?? "everyone"}-${Math.random().toString(36).slice(2)}`);
    const serverFilter = skill ? `skill_slug=eq.${skill}` : authorId ? `author_id=eq.${authorId}` : undefined;

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: serverFilter },
        (payload: RealtimePostgresChangesPayload<PostRow>) => {
          const row = payload.new as PostRow;
          void fetchPost(db, row.id).then((post) => {
            if (!post) return;
            setPending((list) => (list.some((p) => p.id === post.id) ? list : [post, ...list]));
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts", filter: serverFilter },
        (payload: RealtimePostgresChangesPayload<PostRow>) => {
          const row = payload.new as PostRow;
          const patch = (list: Post[]) =>
            list.map((p) =>
              p.id === row.id ? { ...p, like_count: row.like_count, comment_count: row.comment_count } : p,
            );
          setPosts(patch);
          setPending(patch);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload: RealtimePostgresChangesPayload<PostRow>) => {
          const id = (payload.old as Partial<PostRow>).id;
          if (!id) return;
          setPosts((list) => list.filter((p) => p.id !== id));
          setPending((list) => list.filter((p) => p.id !== id));
        },
      )
      .subscribe();

    return () => {
      void db.removeChannel(channel);
    };
  }, [skill, authorId]);

  const visiblePending =
    tab === "following" ? pending.filter((p) => followingSet.has(p.author_id)) : pending;

  function showPending() {
    const ids = new Set(visiblePending.map((p) => p.id));
    setFresh(ids);
    setPosts((list) => [...visiblePending, ...list.filter((p) => !ids.has(p.id))]);
    setPending((list) => list.filter((p) => !ids.has(p.id)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function switchTab(next: Tab) {
    if (next === tab || loading) return;
    setError(null);
    setLoading(true);
    try {
      const db = supabaseBrowser();
      let ids = followingIds;
      if (next === "following" && userId && ids === null) {
        ids = await fetchFollowingIds(db, userId);
        setFollowingIds(ids);
      }
      const list =
        next === "following" && (!ids || ids.length === 0)
          ? []
          : await fetchPosts(db, { skill, authorId, authorIds: next === "following" ? (ids ?? []) : undefined });
      setTab(next);
      setPosts(list);
      setFresh(new Set());
      setHasMore(list.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the feed.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    const last = posts.at(-1);
    if (!last || loading) return;
    setLoading(true);
    setError(null);
    try {
      const more = await fetchPosts(supabaseBrowser(), { ...filter, before: last.created_at });
      setPosts((list) => [...list, ...more.filter((p) => !list.some((q) => q.id === p.id))]);
      setHasMore(more.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load more.");
    } finally {
      setLoading(false);
    }
  }

  function setLike(post: Post, isLiked: boolean) {
    setLiked((current) => {
      const next = new Set(current);
      if (isLiked) next.add(post.id);
      else next.delete(post.id);
      return next;
    });
    // Count changes arrive over Realtime too; this keeps the click instant.
    setPosts((list) =>
      list.map((p) =>
        p.id === post.id ? { ...p, like_count: Math.max(0, p.like_count + (isLiked ? 1 : -1)) } : p,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {showTabs && (
        <div className="flex items-center gap-2" role="tablist" aria-label="Whose flexes">
          {(["everyone", "following"] as const).map((name) => {
            const disabled = name === "following" && !userId;
            return (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                disabled={disabled}
                title={disabled ? "Sign in to see people you follow" : undefined}
                onClick={() => void switchTab(name)}
                className={`btn px-4 py-2 text-sm ${tab === name ? "btn-ink" : "btn-ghost"}`}
              >
                {name === "everyone" ? "Everyone" : "Following"}
              </button>
            );
          })}
        </div>
      )}

      {visiblePending.length > 0 && (
        <div className="sticky top-20 z-20 flex justify-center">
          <button type="button" onClick={showPending} className="btn btn-primary rise-in shadow-card">
            ↑ {visiblePending.length} new {visiblePending.length === 1 ? "flex" : "flexes"}
          </button>
        </div>
      )}

      {error && (
        <p role="status" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {posts.length === 0 ? (
        tab === "following" ? (
          <div className="card px-6 py-12 text-center">
            <p className="display text-xl font-bold">Nothing from people you follow yet.</p>
            <p className="mt-2 text-muted">Follow makers from their profile to fill this tab.</p>
          </div>
        ) : (
          empty
        )
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="feed">
          {posts.map((post) => (
            <li key={post.id} className="flex">
              <div className="flex w-full">
                <PostCardSlot
                  post={post}
                  liked={liked.has(post.id)}
                  onLike={(value) => setLike(post, value)}
                  now={now}
                  fresh={fresh.has(post.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && posts.length > 0 && (
        <div className="flex justify-center">
          <button type="button" className="btn btn-ghost" onClick={() => void loadMore()} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
      {!hasMore && posts.length > PAGE_SIZE && (
        <p className="text-center text-sm text-muted">You&apos;re all caught up.</p>
      )}
    </div>
  );
}

function PostCardSlot(props: React.ComponentProps<typeof PostCard>) {
  return (
    <div className="w-full [&>article]:h-full">
      <PostCard {...props} />
    </div>
  );
}

export function EmptyFeed({ skillName }: { skillName?: string }) {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center">
      <p className="display text-2xl font-extrabold">
        {skillName ? `No ${skillName.toLowerCase()} flexes yet.` : "No flexes yet."}
      </p>
      <p className="max-w-sm text-muted">Be the first. Post something you made, learned or finally finished.</p>
      <Link href="/new" className="btn btn-primary">
        Flex it
      </Link>
    </div>
  );
}
