"use client";

import Link from "next/link";
import { useUnreadCount } from "@/lib/notifications";

export function NotificationBell() {
  const unread = useUnreadCount();
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <Link
      href="/notifications"
      aria-label={label}
      title={label}
      className="relative inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-card"
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
        <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15Z" />
        <path d="M10 20.5a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 && (
        <span
          className="absolute top-1 right-1 flex min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-[0.68rem] leading-[1.1rem] font-bold text-accent-ink"
          data-testid="unread-count"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
