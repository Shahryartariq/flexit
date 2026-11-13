export type SkillSlug =
  | "development"
  | "design"
  | "art"
  | "music"
  | "gaming"
  | "fitness"
  | "cooking"
  | "writing"
  | "photography"
  | "learning"
  | "business"
  | "other";

export type Author = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  headline: string;
};

export type Post = {
  id: string;
  author_id: string;
  skill_slug: SkillSlug;
  title: string;
  body: string;
  image_path: string | null;
  link: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  edited_at: string | null;
  hidden: boolean;
  author: Author;
};

export type Profile = Author & {
  bio: string;
  created_at: string;
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: Pick<Author, "id" | "username" | "display_name" | "avatar_path">;
};

/** The columns every post query selects, with its author joined in. */
export const POST_SELECT =
  "id, author_id, skill_slug, title, body, image_path, link, like_count, comment_count, created_at, edited_at, hidden, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_path, headline)";

export const COMMENT_SELECT =
  "id, post_id, author_id, body, created_at, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_path)";

export type Notification = {
  id: string;
  kind: "like" | "comment" | "follow";
  post_id: string | null;
  created_at: string;
  read_at: string | null;
  actor: Pick<Author, "id" | "username" | "display_name" | "avatar_path">;
  post: { id: string; title: string } | null;
};

export const NOTIFICATION_SELECT =
  "id, kind, post_id, created_at, read_at, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_path), post:posts(id, title)";
