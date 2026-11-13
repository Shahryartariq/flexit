import type { Metadata } from "next";
import { NotificationList } from "@/components/NotificationList";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

export default function NotificationsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="display text-4xl font-extrabold">Notifications</h1>
      <NotificationList />
    </div>
  );
}
