"use client";

import Link from "next/link";
import { createContext, use, useState } from "react";
import { FollowButton } from "./FollowButton";
import { count } from "@/lib/format";
import { useSession } from "@/lib/session";

const FollowerContext = createContext<{ followers: number; change: (delta: number) => void } | null>(null);

/** Shares the follower count between the Follow button and the stats row. */
export function FollowerProvider({ initial, children }: { initial: number; children: React.ReactNode }) {
  const [followers, setFollowers] = useState(initial);
  return (
    <FollowerContext value={{ followers, change: (delta) => setFollowers((n) => Math.max(0, n + delta)) }}>
      {children}
    </FollowerContext>
  );
}

export function FollowerCount() {
  const value = use(FollowerContext);
  return <span data-testid="follower-count">{count(value?.followers ?? 0)}</span>;
}

/** "Edit profile" on your own page, a Follow button on everyone else's. */
export function ProfileActions({ profileId }: { profileId: string }) {
  const session = useSession();
  const followers = use(FollowerContext);
  if (session.status === "signed-in" && session.user.id === profileId) {
    return (
      <Link href="/settings" className="btn btn-ghost">
        Edit profile
      </Link>
    );
  }
  return <FollowButton profileId={profileId} onChange={(following) => followers?.change(following ? 1 : -1)} />;
}
