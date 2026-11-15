"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PostDetail } from "./PostDetail";
import { fetchComments, fetchPost } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Comment, Post } from "@/lib/types";

/**
 * Shown when the server can't see a flex that exists: it was hidden after
 * reports. Its author can still open it (signed in), with a notice.
 */
export function UnavailableFlex({ id, serverNow }: { id: string; serverNow: number }) {
  const session = useSession();
  const userId = session.status === "signed-in" ? session.user.id : null;
  const [loaded, setLoaded] = useState<{ for: string; post: Post | null; comments: Comment[] } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const db = supabaseBrowser();
    void Promise.all([fetchPost(db, id), fetchComments(db, id)])
      .then(([post, comments]) => active && setLoaded({ for: userId, post, comments }))
      .catch(() => active && setLoaded({ for: userId, post: null, comments: [] }));
    return () => {
      active = false;
    };
  }, [id, userId]);

  const mine = loaded && loaded.for === userId ? loaded : null;
  if (session.status === "loading" || (userId && !mine)) {
    return <div className="card skeleton h-[560px]" aria-label="Loading flex" />;
  }
  if (mine?.post) {
    return <PostDetail initialPost={mine.post} initialComments={mine.comments} serverNow={serverNow} />;
  }
  return (
    <div className="card mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-14 text-center">
      <h1 className="display text-2xl font-extrabold">This flex isn&apos;t available</h1>
      <p className="text-muted">It was hidden after several people reported it.</p>
      <Link href="/" className="btn btn-primary mt-2">
        Back to the feed
      </Link>
    </div>
  );
}
