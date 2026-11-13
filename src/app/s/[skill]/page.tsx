import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyFeed, Feed } from "@/components/Feed";
import { FeedSkeleton } from "@/components/FeedSkeleton";
import { SetupNotice } from "@/components/SetupNotice";
import { SkillBar } from "@/components/SkillBar";
import { isConfigured } from "@/lib/env";
import { fetchPosts } from "@/lib/queries";
import { findSkill, SKILLS } from "@/lib/skills";
import { requestTime } from "@/lib/request-time";
import { supabasePublic } from "@/lib/supabase/public";

type Props = { params: Promise<{ skill: string }> };

export function generateStaticParams() {
  return SKILLS.map((skill) => ({ skill: skill.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const skill = findSkill((await params).skill);
  if (!skill) return {};
  return {
    title: `${skill.name} flexes`,
    description: `What people made, learned and achieved in ${skill.name.toLowerCase()}, live on Flexit.`,
    alternates: { canonical: `/s/${skill.slug}` },
  };
}

export default async function SkillPage({ params }: Props) {
  const skill = findSkill((await params).skill);
  if (!skill) notFound();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 pt-2">
        <p className="text-5xl" aria-hidden="true">
          {skill.emoji}
        </p>
        <h1 className="display text-4xl font-extrabold sm:text-5xl">{skill.name}</h1>
        <p className="text-muted">
          Things people made, learned and achieved in {skill.name.toLowerCase()}. New ones show up live.
        </p>
      </header>
      <SkillBar active={skill.slug} />
      <Suspense fallback={<FeedSkeleton />}>
        <SkillFeed slug={skill.slug} name={skill.name} />
      </Suspense>
    </div>
  );
}

async function SkillFeed({ slug, name }: { slug: string; name: string }) {
  await connection();
  if (!isConfigured) return <SetupNotice />;
  const posts = await fetchPosts(supabasePublic(), { skill: slug });
  return <Feed key={slug} initialPosts={posts} serverNow={requestTime()} skill={slug} showSort empty={<EmptyFeed skillName={name} />} />;
}
