import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Flexit stores, who can see it, and how to delete it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6 [&_h2]:display [&_h2]:text-xl [&_h2]:font-extrabold [&_p]:text-muted [&_li]:text-muted">
      <header className="flex flex-col gap-2">
        <h1 className="display text-4xl font-extrabold">Privacy</h1>
        <p>Short version: what you post is public, your email isn&apos;t, and you can delete everything at any time.</p>
      </header>

      <section className="flex flex-col gap-2">
        <h2>What we store</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your email and a hashed password (or your GitHub login), used only to sign you in.</li>
          <li>Your profile: name, username, headline, bio and photo.</li>
          <li>What you post: flexes, photos, links, likes, comments and who you follow.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2>Who can see it</h2>
        <p>
          Profiles, flexes, photos, likes, comments and follows are public: anyone can see them without an account.
          Your email is never shown to other people.
        </p>
        <p>
          Photos are resized in your browser before upload, which also removes hidden data such as the location
          where the photo was taken.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2>Where it lives</h2>
        <p>
          Data is stored with Supabase (database, sign-in and file storage) and the site runs on Vercel. If the
          site&apos;s owner turns on Google Analytics, it records anonymous page views to see which pages are used.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2>Deleting your data</h2>
        <p>
          You can delete a single flex or comment at any time. To remove everything, go to{" "}
          <Link href="/settings" className="font-semibold text-ink underline">
            Edit profile
          </Link>{" "}
          and choose <strong className="text-ink">Delete account</strong>: your profile, posts, photos, likes,
          comments and follows are removed straight away.
        </p>
      </section>

      <p className="text-sm">Last updated: 13 November 2026.</p>
    </article>
  );
}
