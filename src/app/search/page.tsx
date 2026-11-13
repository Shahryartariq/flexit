import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { Feed } from "@/components/Feed";
import { FeedSkeleton } from "@/components/FeedSkeleton";
import { SetupNotice } from "@/components/SetupNotice";
import { SKILLS, skillColors } from "@/lib/skills";
import { isConfigured } from "@/lib/env";
import { searchAll } from "@/lib/queries";
import { requestTime } from "@/lib/request-time";
import { supabasePublic } from "@/lib/supabase/public";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export default function SearchPage({ searchParams }: Props) {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="display text-4xl font-extrabold">Search</h1>
      <Suspense fallback={<SearchBox defaultValue="" />}>
        <SearchForm searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<FeedSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function readQuery(searchParams: Props["searchParams"]) {
  const { q } = await searchParams;
  return (Array.isArray(q) ? q[0] : q ?? "").slice(0, 100);
}

async function SearchForm({ searchParams }: Props) {
  return <SearchBox defaultValue={await readQuery(searchParams)} />;
}

function SearchBox({ defaultValue }: { defaultValue: string }) {
  return (
    <form action="/search" role="search" className="flex gap-2">
      <label htmlFor="q" className="sr-only">
        Search people and flexes
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus
        placeholder="Search people and flexes…"
        className="field text-base"
        autoComplete="off"
      />
      <button type="submit" className="btn btn-ink">
        Search
      </button>
    </form>
  );
}

async function Results({ searchParams }: Props) {
  const raw = await readQuery(searchParams);
  await connection();
  if (!isConfigured) return <SetupNotice />;

  if (!raw.trim()) {
    return (
      <section className="flex flex-col gap-3" aria-labelledby="browse">
        <h2 id="browse" className="display text-xl font-extrabold">
          Browse by skill
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SKILLS.map((skill) => {
            const colors = skillColors(skill.slug);
            return (
              <li key={skill.slug}>
                <Link
                  href={`/s/${skill.slug}`}
                  className="flex items-center gap-3 rounded-2xl p-4 font-semibold transition-transform hover:-translate-y-0.5"
                  style={{ background: colors.background, color: colors.ink }}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {skill.emoji}
                  </span>
                  {skill.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const { q, people, posts } = await searchAll(supabasePublic(), raw);
  if (q.length < 2) {
    return <p className="text-muted">Type at least 2 letters.</p>;
  }

  return (
    <div className="flex flex-col gap-10" data-testid="search-results">
      <section aria-labelledby="people" className="flex flex-col gap-3">
        <h2 id="people" className="display text-xl font-extrabold">
          People <span className="text-muted">· {people.length}</span>
        </h2>
        {people.length === 0 ? (
          <p className="text-muted">Nobody matches “{q}”.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((person) => (
              <li key={person.id}>
                <Link href={`/u/${person.username}`} className="card flex items-center gap-3 p-4 hover:border-ink">
                  <Avatar name={person.display_name} username={person.username} path={person.avatar_path} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{person.display_name}</span>
                    <span className="block truncate text-sm text-muted">
                      {person.headline || `@${person.username}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="flexes" className="flex flex-col gap-3">
        <h2 id="flexes" className="display text-xl font-extrabold">
          Flexes <span className="text-muted">· {posts.length}</span>
        </h2>
        <Feed
          key={q}
          initialPosts={posts}
          serverNow={requestTime()}
          live={false}
          pageable={false}
          empty={<p className="text-muted">No flexes match “{q}”.</p>}
        />
      </section>
    </div>
  );
}
