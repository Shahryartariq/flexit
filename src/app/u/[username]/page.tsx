import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { Feed } from "@/components/Feed";
import { FeedSkeleton } from "@/components/FeedSkeleton";
import { FollowerCount, FollowerProvider, ProfileActions } from "@/components/ProfileActions";
import { SetupNotice } from "@/components/SetupNotice";
import { SkillChip } from "@/components/SkillChip";
import { isConfigured } from "@/lib/env";
import { publicImageUrl } from "@/lib/images";
import { fetchFollowCounts, fetchPosts, fetchProfile, fetchSkillCounts } from "@/lib/queries";
import { requestTime } from "@/lib/request-time";
import { supabasePublic } from "@/lib/supabase/public";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isConfigured) return {};
  const profile = await fetchProfile(supabasePublic(), (await params).username).catch(() => null);
  if (!profile) return { title: "Profile not found" };
  const avatar = publicImageUrl("avatars", profile.avatar_path);
  return {
    title: `${profile.display_name} (@${profile.username})`,
    description: profile.headline || profile.bio || `${profile.display_name}'s flexes on Flexit.`,
    alternates: { canonical: `/u/${profile.username}` },
    openGraph: { type: "profile", ...(avatar ? { images: [avatar] } : {}) },
  };
}

export default function ProfilePage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-8">
          <div className="card skeleton h-56" />
          <FeedSkeleton />
        </div>
      }
    >
      <ProfileContent params={params} />
    </Suspense>
  );
}

async function ProfileContent({ params }: Props) {
  const { username } = await params;
  await connection();
  if (!isConfigured) return <SetupNotice />;
  const db = supabasePublic();
  const profile = await fetchProfile(db, username);
  if (!profile) notFound();
  const [counts, skills, posts] = await Promise.all([
    fetchFollowCounts(db, profile.id),
    fetchSkillCounts(db, profile.id),
    fetchPosts(db, { authorId: profile.id }),
  ]);
  const total = skills.reduce((sum, s) => sum + s.total, 0);
  const joined = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(profile.created_at),
  );

  return (
    <div className="flex flex-col gap-8">
      <FollowerProvider initial={counts.followers}>
      <section className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:p-8">
        <Avatar name={profile.display_name} username={profile.username} path={profile.avatar_path} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="display text-3xl leading-tight font-extrabold break-words sm:text-4xl">
                {profile.display_name}
              </h1>
              <p className="text-muted">@{profile.username}</p>
            </div>
            <ProfileActions profileId={profile.id} />
          </div>
          {profile.headline && <p className="text-lg font-medium">{profile.headline}</p>}
          {profile.bio && <p className="max-w-2xl whitespace-pre-line text-muted">{profile.bio}</p>}
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <dt className="text-muted">Flexes</dt>
              <dd className="font-semibold tabular-nums">{total}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted">Followers</dt>
              <dd className="font-semibold tabular-nums">
                <FollowerCount />
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted">Following</dt>
              <dd className="font-semibold tabular-nums">{counts.following}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted">Joined</dt>
              <dd className="font-semibold">{joined}</dd>
            </div>
          </dl>
          {skills.length > 0 && (
            <div className="flex flex-col gap-2 pt-1">
              <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">Skills</h2>
              <ul className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <li key={skill.slug}>
                    <SkillChip slug={skill.slug} count={skill.total} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
      </FollowerProvider>

      <section aria-labelledby="profile-flexes" className="flex flex-col gap-4">
        <h2 id="profile-flexes" className="display text-xl font-extrabold">
          Flexes
        </h2>
        <Feed
          initialPosts={posts}
          serverNow={requestTime()}
          authorId={profile.id}
          empty={
            <div className="card px-6 py-12 text-center text-muted">
              {profile.display_name} hasn&apos;t posted a flex yet.
            </div>
          }
        />
      </section>
    </div>
  );
}
