import type { SupabaseClient } from "@supabase/supabase-js";
import { COMMENT_SELECT, POST_SELECT, type Comment, type Post, type Profile } from "./types";

export const PAGE_SIZE = 12;

export type FeedFilter = {
  skill?: string;
  authorIds?: string[];
  authorId?: string;
  /** created_at of the last post already shown; loads older ones (latest sort). */
  before?: string;
  /** "top": most liked in the last 7 days; pages with `offset`. */
  sort?: FeedSort;
  offset?: number;
  limit?: number;
};

export type FeedSort = "latest" | "top";

export const TOP_WINDOW_DAYS = 7;

export async function fetchPosts(db: SupabaseClient, filter: FeedFilter = {}): Promise<Post[]> {
  const limit = filter.limit ?? PAGE_SIZE;
  let query = db.from("posts").select(POST_SELECT);
  if (filter.sort === "top") {
    const since = new Date(Date.now() - TOP_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
    const offset = filter.offset ?? 0;
    query = query
      .gte("created_at", since)
      .order("like_count", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
  } else {
    query = query.order("created_at", { ascending: false }).limit(limit);
    if (filter.before) query = query.lt("created_at", filter.before);
  }
  if (filter.skill) query = query.eq("skill_slug", filter.skill);
  if (filter.authorId) query = query.eq("author_id", filter.authorId);
  if (filter.authorIds) query = query.in("author_id", filter.authorIds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Post[];
}

export async function fetchPost(db: SupabaseClient, id: string): Promise<Post | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db.from("posts").select(POST_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as Post | null;
}

export async function fetchComments(db: SupabaseClient, postId: string): Promise<Comment[]> {
  const { data, error } = await db
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Comment[];
}

export async function fetchProfile(db: SupabaseClient, username: string): Promise<Profile | null> {
  const name = username.toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(name)) return null;
  const { data, error } = await db
    .from("profiles")
    .select("id, username, display_name, avatar_path, headline, bio, created_at")
    .eq("username", name)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Profile | null;
}

export async function fetchFollowCounts(db: SupabaseClient, profileId: string) {
  const [followers, following] = await Promise.all([
    db.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profileId),
    db.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", profileId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

/** Post count per skill for one person, biggest first. */
export async function fetchSkillCounts(db: SupabaseClient, profileId: string) {
  const { data, error } = await db.from("posts").select("skill_slug").eq("author_id", profileId).limit(1000);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.skill_slug, (counts.get(row.skill_slug) ?? 0) + 1);
  return [...counts.entries()].map(([slug, total]) => ({ slug, total })).sort((a, b) => b.total - a.total);
}

/** Which of these posts the signed-in user has liked. */
export async function fetchLikedIds(db: SupabaseClient, userId: string, postIds: string[]) {
  if (!postIds.length) return new Set<string>();
  const { data } = await db.from("likes").select("post_id").eq("user_id", userId).in("post_id", postIds);
  return new Set((data ?? []).map((row) => row.post_id as string));
}

export async function fetchFollowingIds(db: SupabaseClient, userId: string) {
  const { data } = await db.from("follows").select("following_id").eq("follower_id", userId).limit(1000);
  return (data ?? []).map((row) => row.following_id as string);
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Turns a database error into a sentence a person can act on. */
export function friendlyError(message: string) {
  if (/flexes an hour|comments every/.test(message)) return message;
  if (/duplicate key|already exists/.test(message)) return "That's already done.";
  if (/row-level security|permission denied/.test(message)) return "You need to be signed in as the owner to do that.";
  if (/check constraint/.test(message)) return "Something in that form isn't allowed. Check the fields and try again.";
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message)) return "Couldn't reach the server. Check your connection.";
  return "Something went wrong. Please try again.";
}

/** Strips characters that have meaning in PostgREST filters and LIKE patterns. */
export function cleanSearch(raw: string) {
  return raw
    .replace(/[,()*%_\\:."']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export async function searchAll(db: SupabaseClient, raw: string) {
  const q = cleanSearch(raw);
  if (q.length < 2) return { q, people: [] as Profile[], posts: [] as Post[] };
  const pattern = `%${q}%`;
  const [people, posts] = await Promise.all([
    db
      .from("profiles")
      .select("id, username, display_name, avatar_path, headline, bio, created_at")
      .or(`username.ilike.${pattern},display_name.ilike.${pattern},headline.ilike.${pattern}`)
      .limit(12),
    db
      .from("posts")
      .select(POST_SELECT)
      .or(`title.ilike.${pattern},body.ilike.${pattern}`)
      .order("like_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(24),
  ]);
  if (people.error) throw new Error(people.error.message);
  if (posts.error) throw new Error(posts.error.message);
  return { q, people: (people.data ?? []) as Profile[], posts: (posts.data ?? []) as unknown as Post[] };
}
