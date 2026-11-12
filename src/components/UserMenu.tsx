"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Avatar } from "./Avatar";
import { signOut, useSession } from "@/lib/session";

export function UserMenu() {
  const session = useSession();
  const router = useRouter();
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false;
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  if (session.status === "loading") {
    return <span className="skeleton block h-10 w-36 rounded-full" aria-hidden="true" />;
  }

  if (session.status === "signed-out") {
    return (
      <div className="flex items-center gap-2">
        <Link href="/sign-in" className="btn btn-ghost hidden sm:inline-flex">
          Sign in
        </Link>
        <Link href="/sign-up" className="btn btn-primary">
          Join
        </Link>
      </div>
    );
  }

  const profile = session.profile;
  return (
    <div className="flex items-center gap-2">
      <Link href="/new" className="btn btn-primary">
        <span aria-hidden="true">＋</span> Flex it
      </Link>
      <details ref={menu} className="relative">
        <summary
          className="flex cursor-pointer list-none items-center rounded-full [&::-webkit-details-marker]:hidden"
          aria-label="Account menu"
        >
          {profile ? (
            <Avatar name={profile.display_name} username={profile.username} path={profile.avatar_path} />
          ) : (
            <span className="skeleton block size-10 rounded-full" />
          )}
        </summary>
        <div className="card absolute right-0 z-40 mt-2 w-56 p-2 text-sm">
          {profile && (
            <div className="border-b border-line px-3 pt-2 pb-3">
              <p className="truncate font-semibold">{profile.display_name}</p>
              <p className="truncate text-muted">@{profile.username}</p>
            </div>
          )}
          <nav className="flex flex-col pt-1">
            {profile && (
              <Link href={`/u/${profile.username}`} className="rounded-lg px-3 py-2 hover:bg-paper">
                Your profile
              </Link>
            )}
            <Link href="/settings" className="rounded-lg px-3 py-2 hover:bg-paper">
              Edit profile
            </Link>
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-left hover:bg-paper"
              onClick={async () => {
                await signOut();
                router.push("/");
                router.refresh();
              }}
            >
              Sign out
            </button>
          </nav>
        </div>
      </details>
    </div>
  );
}
