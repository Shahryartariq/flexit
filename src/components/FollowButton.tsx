"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { friendlyError } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function FollowButton({
  profileId,
  compact = false,
  onChange,
}: {
  profileId: string;
  compact?: boolean;
  onChange?: (following: boolean) => void;
}) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const userId = session.status === "signed-in" ? session.user.id : null;
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || userId === profileId) return;
    void supabaseBrowser()
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .eq("following_id", profileId)
      .maybeSingle()
      .then(({ data }) => setFollowing(Boolean(data)));
  }, [userId, profileId]);

  if (userId === profileId) return null;

  async function toggle() {
    if (!userId) {
      router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const next = !following;
    setBusy(true);
    setError(null);
    const db = supabaseBrowser().from("follows");
    const { error: failure } = next
      ? await db.insert({ following_id: profileId })
      : await db.delete().eq("follower_id", userId).eq("following_id", profileId);
    setBusy(false);
    if (failure && !/duplicate key/.test(failure.message)) {
      setError(friendlyError(failure.message));
      return;
    }
    setFollowing(next);
    onChange?.(next);
  }

  const isFollowing = Boolean(userId && following);
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy || (Boolean(userId) && following === null)}
      aria-pressed={isFollowing}
      title={error ?? undefined}
      className={`btn ${isFollowing ? "btn-ghost" : "btn-ink"} ${compact ? "px-3.5 py-1.5 text-sm" : ""}`}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
