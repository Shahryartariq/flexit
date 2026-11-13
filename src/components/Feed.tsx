"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { PostCard } from "./PostCard";
import { useNow } from "@/lib/clock";
import { isConfigured } from "@/lib/env";
import { fetchFollowingIds, fetchLikedIds, fetchPost, fetchPosts, PAGE_SIZE, type FeedSort } from "@/lib/queries";
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
  showSort = false,
  live = true,
  pageable = true,
  empty,
}: {
  initialPosts: Post[];
  serverNow: number;
  skill?: string;
  authorId?: string;
  showTabs?: boolean;
  /** Offer "Latest / Top this week". */
  showSort?: boolean;
  /** Listen for new flexes and count changes over Realtime. */
  live?: boolean;
  /** Load older flexes as the person scrolls. */
  pageable?: boolean;
  empty: React.ReactNode;
}) {
  const session = useSession();
  const now = useNow(serverNow);
  const userId = session.status === "signed-in" ? session.user.id : null;

  const [tab, setTab] = useState<Tab>("everyone");
  const [sort, setSort] = useState<FeedSort>("latest");
  const [posts, setPosts] = useState(initialPosts);
  const [pending, setPending] = useState<Post[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [hasMore, setHasMore] = useState(pageable && initialPosts.length === PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [followingIds, setFollowingIds] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkedLikes = useRef(new Set<string>());
  const sentinel = useRef<HTMLDivElement>(null);

  const followingSet = useMemo(() => new Set(followingIds ?? []), [followingIds]);
  const filter = useMemo(
    () => ({
      skill,
      authorId,
      authorIds: tab === "following" ? (followingIds ?? []) : undefined,
      sort,
    }),
    [skill, authorId, tab, followingIds, sort],
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
    if (!isConfigured || !live) return;
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
  }, [skill, authorId, live]);

  const visiblePending =
    sort === "top" ? [] : tab === "following" ? pending.filter((p) => followingSet.has(p.author_id)) : pending;

  function showPending() {
    const ids = new Set(visiblePending.map((p) => p.id));
    setFresh(ids);
    setPosts((list) => [...visiblePending, ...list.filter((p) => !ids.has(p.id))]);
    setPending((list) => list.filter((p) => !ids.has(p.id)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function reload(nextTab: Tab, nextSort: FeedSort) {
    if ((nextTab === tab && nextSort === sort) || loading) return;
    setError(null);
    setLoading(true);
    try {
      const db = supabaseBrowser();
      let ids = followingIds;
      if (nextTab === "following" && userId && ids === null) {
        ids = await fetchFollowingIds(db, userId);
        setFollowingIds(ids);
      }
      const list =
        nextTab === "following" && (!ids || ids.length === 0)
          ? []
          : await fetchPosts(db, {
              skill,
              authorId,
              sort: nextSort,
              authorIds: nextTab === "following" ? (ids ?? []) : undefined,
            });
      setTab(nextTab);
      setSort(nextSort);
      setPosts(list);
      setFresh(new Set());
      setHasMore(pageable && list.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the feed.");
    } finally {
      setLoading(false);
    }
  }

  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  async function loadMore() {
    const last = posts.at(-1);
    if (!last || loading) return;
    setLoading(true);
    setError(null);
    try {
      const more = await fetchPosts(
        supabaseBrowser(),
        sort === "top" ? { ...filter, offset: posts.length } : { ...filter, before: last.created_at },
      );
      setPosts((list) => [...list, ...more.filter((p) => !list.some((q) => q.id === p.id))]);
      setHasMore(more.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load more.");
    } finally {
      setLoading(false);
    }
  }

  // Load the next page when the bottom of the grid scrolls into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMoreRef.current();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore]);

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
      {(showTabs || showSort) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {showTabs ? (
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
                    onClick={() => void reload(name, sort)}
                    className={`btn px-4 py-2 text-sm ${tab === name ? "btn-ink" : "btn-ghost"}`}
                  >
                    {name === "everyone" ? "Everyone" : "Following"}
                  </button>
                );
              })}
            </div>
          ) : (
            <span />
          )}
          {showSort && (
            <div className="flex items-center rounded-full border-[1.5px] border-line bg-card p-1 text-sm" role="group" aria-label="Sort flexes">
              {(["latest", "top"] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={sort === name}
                  onClick={() => void reload(tab, name)}
                  className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${sort === name ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
                >
                  {name === "latest" ? "Latest" : "Top this week"}
                </button>
              ))}
            </div>
          )}
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
        sort === "top" ? (
          <div className="card px-6 py-12 text-center">
            <p className="display text-xl font-bold">Nothing in the last 7 days yet.</p>
            <p className="mt-2 text-muted">Switch to Latest to see older flexes.</p>
          </div>
        ) : tab === "following" ? (
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
        <div ref={sentinel} className="flex justify-center">
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
