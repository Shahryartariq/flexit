import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyFeed, Feed } from "@/components/Feed";
import { FeedSkeleton } from "@/components/FeedSkeleton";
import { SetupNotice } from "@/components/SetupNotice";
import { SkillBar } from "@/components/SkillBar";
import { isConfigured } from "@/lib/env";
import { fetchPosts } from "@/lib/queries";
import { SKILLS } from "@/lib/skills";
import { requestTime } from "@/lib/request-time";
import { supabasePublic } from "@/lib/supabase/public";

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5 pt-4 sm:pt-8">
        <h1 className="display max-w-3xl text-[2.6rem] leading-[0.95] font-extrabold sm:text-6xl">
          Made something? <span className="text-accent">Flex&nbsp;it.</span>
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Share what you built, learned or finally finished, in any skill. Code, art, music, a personal best, a
          dish that worked. Everyone&apos;s wins in one live feed.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/new" className="btn btn-primary">
            Post your first flex
          </Link>
          <a href="#feed" className="btn btn-ghost">
            See what people made
          </a>
        </div>
        <p className="text-sm text-muted">
          {SKILLS.length} skills · new flexes appear live · free, no ads
        </p>
      </section>

      <section id="feed" className="flex scroll-mt-20 flex-col gap-4" aria-labelledby="feed-title">
        <h2 id="feed-title" className="sr-only">
          Latest flexes
        </h2>
        <SkillBar />
        <Suspense fallback={<FeedSkeleton />}>
          <HomeFeed />
        </Suspense>
      </section>
    </div>
  );
}

async function HomeFeed() {
  await connection();
  if (!isConfigured) return <SetupNotice />;
  const posts = await fetchPosts(supabasePublic());
  return <Feed initialPosts={posts} serverNow={requestTime()} showTabs empty={<EmptyFeed />} />;
}
