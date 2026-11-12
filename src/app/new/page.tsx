import type { Metadata } from "next";
import { NewPostForm } from "@/components/NewPostForm";

export const metadata: Metadata = { title: "New flex", robots: { index: false } };

export default function NewPostPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="display text-4xl font-extrabold">New flex</h1>
        <p className="text-muted">Big or small, if you&apos;re proud of it, it belongs here.</p>
      </header>
      <NewPostForm />
    </div>
  );
}
