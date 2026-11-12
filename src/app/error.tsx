"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <h1 className="display text-2xl font-extrabold">Something broke</h1>
      <p className="text-muted">We couldn&apos;t load this page. It&apos;s probably temporary.</p>
      <button type="button" onClick={reset} className="btn btn-primary">
        Try again
      </button>
    </div>
  );
}
