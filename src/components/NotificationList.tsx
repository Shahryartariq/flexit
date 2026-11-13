"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { useNow } from "@/lib/clock";
import { timeAgo } from "@/lib/format";
import { describe, markAllReadLocally, notificationHref } from "@/lib/notifications";
import { useSession } from "@/lib/session";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { NOTIFICATION_SELECT, type Notification } from "@/lib/types";

const ICON: Record<Notification["kind"], string> = { like: "♥", comment: "💬", follow: "➕" };

export function NotificationList() {
  const session = useSession();
  const router = useRouter();
  const userId = session.status === "signed-in" ? session.user.id : null;
  const [items, setItems] = useState<Notification[] | null>(null);
  // Times only render after the list loads in the browser, so no server clock is needed.
  const now = useNow(0);

  useEffect(() => {
    if (session.status === "signed-out") router.replace("/sign-in?next=/notifications");
  }, [session.status, router]);

  useEffect(() => {
    if (!userId) return;
    const db = supabaseBrowser();
    void db
      .from("notifications")
      .select(NOTIFICATION_SELECT)
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(async ({ data }) => {
        setItems((data ?? []) as unknown as Notification[]);
        // Opening the page marks everything as read.
        await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", userId).is("read_at", null);
        markAllReadLocally();
      });
  }, [userId]);

  async function clearAll() {
    if (!userId) return;
    const { error } = await supabaseBrowser().from("notifications").delete().eq("recipient_id", userId);
    if (error) toast("Couldn't clear notifications. Try again.", { tone: "error" });
    else {
      setItems([]);
      toast("Notifications cleared");
    }
  }

  if (items === null) {
    return (
      <ul className="card divide-y divide-line" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 p-4">
            <span className="skeleton size-10 rounded-full" />
            <span className="skeleton h-4 w-2/3 rounded" />
          </li>
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
        <p className="display text-2xl font-extrabold">All quiet</p>
        <p className="max-w-sm text-muted">When people like, comment on or follow you, it shows up here, live.</p>
        <Link href="/new" className="btn btn-primary">
          Post a flex
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => void clearAll()} className="btn btn-ghost text-sm">
          Clear all
        </button>
      </div>
      <ul className="card divide-y divide-line overflow-hidden" data-testid="notifications">
        {items.map((n) => (
          <li key={n.id}>
            <Link
              href={notificationHref(n)}
              className={`flex items-center gap-3 p-4 hover:bg-paper ${n.read_at ? "" : "bg-accent/5"}`}
            >
              <span className="relative">
                <Avatar name={n.actor.display_name} username={n.actor.username} path={n.actor.avatar_path} />
                <span aria-hidden="true" className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-card text-xs shadow-card">
                  {ICON[n.kind]}
                </span>
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block">{describe(n)}</span>
                <time className="text-xs text-muted" dateTime={n.created_at}>
                  {timeAgo(n.created_at, now)}
                </time>
              </span>
              {!n.read_at && <span className="size-2 rounded-full bg-accent" aria-label="New" />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
