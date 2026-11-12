"use client";

import { useSyncExternalStore } from "react";

let now = typeof window === "undefined" ? 0 : Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  now = Date.now();
  timer ??= setInterval(() => {
    now = Date.now();
    for (const l of listeners) l();
  }, 30_000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Current time for "5 min ago" labels; uses the server's time until hydrated. */
export function useNow(serverNow: number) {
  return useSyncExternalStore(
    subscribe,
    () => now || serverNow,
    () => serverNow,
  );
}
