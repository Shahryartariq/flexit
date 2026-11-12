/** Shown instead of data when the Supabase keys aren't set (e.g. a fresh deploy). */
export function SetupNotice() {
  return (
    <div className="card mx-auto max-w-xl px-6 py-10 text-center">
      <p className="display text-xl font-bold">Almost there</p>
      <p className="mt-2 text-muted">
        This copy of Flexit isn&apos;t connected to Supabase yet. Set{" "}
        <code className="rounded bg-paper px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-paper px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, then redeploy.
      </p>
    </div>
  );
}
