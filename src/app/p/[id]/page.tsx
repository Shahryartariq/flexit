import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PostDetail } from "@/components/PostDetail";
import { SetupNotice } from "@/components/SetupNotice";
import { isConfigured } from "@/lib/env";
import { publicImageUrl } from "@/lib/images";
import { fetchComments, fetchPost } from "@/lib/queries";
import { getSkill } from "@/lib/skills";
import { requestTime } from "@/lib/request-time";
import { supabasePublic } from "@/lib/supabase/public";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isConfigured) return {};
  const post = await fetchPost(supabasePublic(), (await params).id).catch(() => null);
  if (!post) return { title: "Flex not found" };
  const skill = getSkill(post.skill_slug);
  const description = post.body
    ? post.body.slice(0, 160)
    : `${post.author.display_name} shared a ${skill.name.toLowerCase()} flex on Flexit.`;
  const image = publicImageUrl("post-images", post.image_path);
  return {
    title: `${post.title} by ${post.author.display_name}`,
    description,
    alternates: { canonical: `/p/${post.id}` },
    openGraph: { title: post.title, description, type: "article", ...(image ? { images: [image] } : {}) },
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
  const db = supabasePublic();
  const post = await fetchPost(db, id);
  if (!post) notFound();
  const comments = await fetchComments(db, post.id);
  return <PostDetail key={post.id} initialPost={post} initialComments={comments} serverNow={requestTime()} />;
}
