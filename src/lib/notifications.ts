"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { isConfigured } from "./env";
import { useSession } from "./session";
import { supabaseBrowser } from "./supabase/browser";
import { toast } from "./toast";
import { NOTIFICATION_SELECT, type Notification } from "./types";

let unread = 0;
let watching: string | null = null;
let channel: RealtimeChannel | null = null;
const listeners = new Set<() => void>();

function set(count: number) {
  unread = Math.max(0, count);
  for (const listener of listeners) listener();
}

export function describe(n: Pick<Notification, "kind" | "actor" | "post">) {
  const who = n.actor.display_name;
  if (n.kind === "follow") return `${who} started following you`;
  const what = n.post ? `“${n.post.title}”` : "your flex";
  return n.kind === "like" ? `${who} liked ${what}` : `${who} commented on ${what}`;
}

export function notificationHref(n: Pick<Notification, "kind" | "actor" | "post_id">) {
  if (n.kind === "follow" || !n.post_id) return `/u/${n.actor.username}`;
  return n.kind === "comment" ? `/p/${n.post_id}#comments` : `/p/${n.post_id}`;
}

async function refresh(userId: string) {
  const { count } = await supabaseBrowser()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (watching === userId) set(count ?? 0);
}

function watch(userId: string | null) {
  if (watching === userId) return;
  const db = supabaseBrowser();
  if (channel) void db.removeChannel(channel);
  channel = null;
  watching = userId;
  set(0);
  if (!userId || !isConfigured) return;
  void refresh(userId);
  channel = db
    .channel(`inbox-${userId}-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
      (payload) => {
        set(unread + 1);
        const id = (payload.new as { id: string }).id;
        void db
          .from("notifications")
          .select(NOTIFICATION_SELECT)
          .eq("id", id)
          .maybeSingle()
          .then(({ data }) => {
            if (!data) return;
            const n = data as unknown as Notification;
            toast(describe(n), { href: notificationHref(n) });
          });
      },
    )
    .subscribe();
}

/** Unread notification count for the signed-in person, kept live over Realtime. */
export function useUnreadCount() {
  const session = useSession();
  const userId = session.status === "signed-in" ? session.user.id : null;
  useEffect(() => {
    watch(userId);
  }, [userId]);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => unread,
    () => 0,
  );
}

export function markAllReadLocally() {
  set(0);
}
