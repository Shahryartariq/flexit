import "server-only";
import { cache } from "react";
import { fetchComments, fetchPost, PAGE_SIZE } from "./queries";
import { supabasePublic } from "./supabase/public";
import { POST_SELECT, type Post, type Profile } from "./types";

/** One read per request, shared by generateMetadata, the page and its share image. */
export const getPost = cache((id: string) => fetchPost(supabasePublic(), id));

/** The flex and its comments in one round trip (both only need the id). */
export const getPostPage = cache(async (id: string) => {
  const [post, comments] = await Promise.all([getPost(id), fetchComments(supabasePublic(), id).catch(() => [])]);
  return { post, comments: post ? comments : [] };
});

export type ProfilePage = {
  profile: Profile;
  followers: number;
  following: number;
  skills: { slug: string; total: number }[];
  posts: Post[];
};

const PROFILE_COLUMNS = "id, username, display_name, avatar_path, headline, bio, created_at";

/**
 * Everything a profile page shows, keyed by username, fetched in parallel
 * (one round trip instead of two).
 */
export const getProfilePage = cache(async (raw: string): Promise<ProfilePage | null> => {
  const username = raw.toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return null;
  const db = supabasePublic();
  const author = "author:profiles!posts_author_id_fkey!inner(id, username, display_name, avatar_path, headline)";
  const [profile, posts, skills] = await Promise.all([
    db
      .from("profiles")
      .select(
        `${PROFILE_COLUMNS}, followers:follows!follows_following_id_fkey(count), following:follows!follows_follower_id_fkey(count)`,
      )
      .eq("username", username)
      .maybeSingle(),
    db
      .from("posts")
      .select(POST_SELECT.replace(/author:profiles!posts_author_id_fkey\([^)]*\)/, author))
      .eq("author.username", username)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE),
    db
      .from("posts")
      .select("skill_slug, author:profiles!posts_author_id_fkey!inner(username)")
      .eq("author.username", username)
      .limit(1000),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  if (posts.error) throw new Error(posts.error.message);
  if (skills.error) throw new Error(skills.error.message);
  if (!profile.data) return null;

  const { followers, following, ...rest } = profile.data as unknown as Profile & {
    followers: { count: number }[];
    following: { count: number }[];
  };
  const counts = new Map<string, number>();
  for (const row of skills.data ?? []) counts.set(row.skill_slug, (counts.get(row.skill_slug) ?? 0) + 1);
  return {
    profile: rest,
    followers: followers[0]?.count ?? 0,
    following: following[0]?.count ?? 0,
    skills: [...counts.entries()].map(([slug, total]) => ({ slug, total })).sort((a, b) => b.total - a.total),
    posts: (posts.data ?? []) as unknown as Post[],
  };
});
