import type { Metadata } from "next";
import { SettingsForm } from "@/components/SettingsForm";

export const metadata: Metadata = { title: "Edit profile", robots: { index: false } };

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="display text-4xl font-extrabold">Edit profile</h1>
      <SettingsForm />
    </div>
  );
}
