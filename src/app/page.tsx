import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyFeed, Feed } from "@/components/Feed";
import { FeedSkeleton } from "@/components/FeedSkeleton";
import { SetupNotice } from "@/components/SetupNotice";
import { SkillBar } from "@/components/SkillBar";
import { isConfigured, SITE_URL } from "@/lib/env";
import { toJsonLd } from "@/lib/json-ld";
import { fetchPosts } from "@/lib/queries";
import { SKILLS } from "@/lib/skills";
import { requestTime } from "@/lib/request-time";
import { supabasePublic } from "@/lib/supabase/public";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Flexit",
  url: `${SITE_URL}/`,
  description: "Share what you made, learned or achieved, in any skill.",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(WEBSITE_JSON_LD) }} />
      <section className="flex flex-col gap-5 pt-4 sm:pt-8">
        <h1 className="display max-w-3xl text-[2.6rem] leading-[0.95] font-extrabold sm:text-6xl">
          Made something? <span className="text-accent-strong">Flex&nbsp;it.</span>
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
  return <Feed initialPosts={posts} serverNow={requestTime()} showTabs showSort empty={<EmptyFeed />} />;
}
