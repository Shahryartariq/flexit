import Link from "next/link";
import { Avatar } from "./Avatar";
import { LikeButton } from "./LikeButton";
import { SkillChip } from "./SkillChip";
import { count, timeAgo } from "@/lib/format";
import { publicImageUrl } from "@/lib/images";
import { getSkill, skillColors } from "@/lib/skills";
import type { Post } from "@/lib/types";

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d="M4.5 18.5V7.8A2.8 2.8 0 0 1 7.3 5h9.4a2.8 2.8 0 0 1 2.8 2.8v6.4a2.8 2.8 0 0 1-2.8 2.8H8.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A flex in the feed: photo (or a type tile), who made it, and likes. */
export function PostCard({
  post,
  liked,
  onLike,
  now,
  fresh = false,
}: {
  post: Post;
  liked: boolean;
  onLike: (liked: boolean) => void;
  now: number;
  fresh?: boolean;
}) {
  const image = publicImageUrl("post-images", post.image_path);
  const colors = skillColors(post.skill_slug);
  const skill = getSkill(post.skill_slug);
  const href = `/p/${post.id}`;

  return (
    <article className={`card flex flex-col overflow-hidden ${fresh ? "rise-in" : ""}`} data-testid="post-card">
      <Link href={href} className="group relative block aspect-[4/5] overflow-hidden" tabIndex={-1} aria-hidden="true">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- resized to 1600px on upload
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="flex size-full flex-col justify-between p-5"
            style={{ background: colors.background, color: colors.ink }}
          >
            <span className="text-4xl" aria-hidden="true">
              {skill.emoji}
            </span>
            <p className="display-tight line-clamp-5 text-[1.7rem] leading-[1.05] font-extrabold">{post.title}</p>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <Link href={`/u/${post.author.username}`} className="shrink-0">
            <Avatar
              name={post.author.display_name}
              username={post.author.username}
              path={post.author.avatar_path}
              size="sm"
            />
          </Link>
          <div className="min-w-0 text-sm leading-tight">
            <Link href={`/u/${post.author.username}`} className="block truncate font-semibold hover:underline">
              {post.author.display_name}
            </Link>
            <span className="text-muted">
              <time dateTime={post.created_at} suppressHydrationWarning>
                {timeAgo(post.created_at, now)}
              </time>
            </span>
          </div>
        </div>

        {image && (
          <h3 className="line-clamp-2 text-[1.02rem] leading-snug font-semibold">
            <Link href={href} className="hover:underline">
              {post.title}
            </Link>
          </h3>
        )}
        {!image && (
          <h3 className="sr-only">
            <Link href={href}>{post.title}</Link>
          </h3>
        )}

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="-ml-2 flex items-center">
            <LikeButton postId={post.id} likes={post.like_count} liked={liked} onChange={onLike} />
            <Link
              href={`${href}#comments`}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-semibold hover:bg-paper"
              aria-label={`${post.comment_count} comments`}
            >
              <CommentIcon />
              <span className="tabular-nums">{count(post.comment_count)}</span>
            </Link>
          </div>
          <SkillChip slug={post.skill_slug} />
        </div>
      </div>
    </article>
  );
}
