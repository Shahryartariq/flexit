"use client";

import { useSyncExternalStore } from "react";

export type Toast = { id: number; text: string; tone: "ok" | "error"; href?: string };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Shows a short message at the bottom of the screen for a few seconds. */
export function toast(text: string, options: { tone?: Toast["tone"]; href?: string } = {}) {
  const item: Toast = { id: nextId++, text, tone: options.tone ?? "ok", href: options.href };
  toasts = [...toasts.slice(-2), item];
  emit();
  setTimeout(() => dismiss(item.id), item.tone === "error" ? 6000 : 3500);
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const EMPTY: Toast[] = [];

export function useToasts() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => toasts,
    () => EMPTY,
  );
}
