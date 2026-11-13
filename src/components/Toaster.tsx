"use client";

import Link from "next/link";
import { dismiss, useToasts } from "@/lib/toast";

export function Toaster() {
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={`rise-in pointer-events-auto flex max-w-md items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold shadow-card ${t.tone === "error" ? "bg-danger text-accent-ink" : "bg-ink text-paper"}`}
        >
          {t.href ? (
            <Link href={t.href} onClick={() => dismiss(t.id)} className="hover:underline">
              {t.text}
            </Link>
          ) : (
            <span>{t.text}</span>
          )}
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
