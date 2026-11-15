import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PostDetail } from "@/components/PostDetail";
import { SetupNotice } from "@/components/SetupNotice";
import { UnavailableFlex } from "@/components/UnavailableFlex";
import { isConfigured, SITE_URL } from "@/lib/env";
import { publicImageUrl } from "@/lib/images";
import { toJsonLd } from "@/lib/json-ld";
import { getSkill } from "@/lib/skills";
import { requestTime } from "@/lib/request-time";
import { getPost, getPostPage } from "@/lib/server-queries";
import type { Comment, Post } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isConfigured) return {};
  const post = await getPost((await params).id).catch(() => null);
  // Missing flexes get a real 404 from the proxy; this is a hidden one.
  if (!post) return { title: "Flex not available", robots: { index: false } };
  const skill = getSkill(post.skill_slug);
  const description = post.body
    ? post.body.slice(0, 160)
    : `${post.author.display_name} shared a ${skill.name.toLowerCase()} flex on Flexit.`;
  return {
    title: `${post.title} by ${post.author.display_name}`,
    description,
    alternates: { canonical: `/p/${post.id}` },
    // The share image comes from ./opengraph-image.tsx.
    openGraph: {
      title: post.title,
      description,
      type: "article",
      publishedTime: post.created_at,
      ...(post.edited_at ? { modifiedTime: post.edited_at } : {}),
      authors: [`${SITE_URL}/u/${post.author.username}`],
      section: skill.name,
    },
  };
}

export default function PostPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="card skeleton h-[560px]" aria-label="Loading flex" />}>
      <PostContent params={params} />
    </Suspense>
  );
}

async function PostContent({ params }: Props) {
  const { id } = await params;
  await connection();
  if (!isConfigured) return <SetupNotice />;
  const { post, comments } = await getPostPage(id);
  // Hidden after reports: only its author can still open it (in the browser, signed in).
  if (!post) return <UnavailableFlex id={id} serverNow={requestTime()} />;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(postJsonLd(post, comments)) }} />
      <PostDetail key={post.id} initialPost={post} initialComments={comments} serverNow={requestTime()} />
    </>
  );
}

function postJsonLd(post: Post, comments: Comment[]) {
  const image = publicImageUrl("post-images", post.image_path);
  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    "@id": `${SITE_URL}/p/${post.id}`,
    url: `${SITE_URL}/p/${post.id}`,
    headline: post.title,
    ...(post.body ? { articleBody: post.body } : {}),
    datePublished: post.created_at,
    ...(post.edited_at ? { dateModified: post.edited_at } : {}),
    ...(image ? { image } : {}),
    ...(post.link ? { sharedContent: { "@type": "WebPage", url: post.link } } : {}),
    about: getSkill(post.skill_slug).name,
    author: {
      "@type": "Person",
      name: post.author.display_name,
      alternateName: `@${post.author.username}`,
      url: `${SITE_URL}/u/${post.author.username}`,
    },
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: post.like_count },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: post.comment_count },
    ],
    commentCount: post.comment_count,
    comment: comments.slice(0, 20).map((comment) => ({
      "@type": "Comment",
      text: comment.body,
      dateCreated: comment.created_at,
      author: { "@type": "Person", name: comment.author.display_name, url: `${SITE_URL}/u/${comment.author.username}` },
    })),
  };
}
