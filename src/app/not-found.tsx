import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <p className="display text-7xl font-extrabold text-accent">404</p>
      <h1 className="display text-2xl font-extrabold">Nothing to flex here</h1>
      <p className="text-muted">This page doesn&apos;t exist, or the flex was deleted.</p>
      <Link href="/" className="btn btn-primary">
        Back to the feed
      </Link>
    </div>
  );
}
