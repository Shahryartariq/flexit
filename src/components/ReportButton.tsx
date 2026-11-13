"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";

const REASONS = [
  { value: "spam", label: "Spam or an ad" },
  { value: "not-theirs", label: "Not their own work" },
  { value: "offensive", label: "Offensive or unsafe" },
  { value: "other", label: "Something else" },
] as const;

/** Lets signed-in people flag a flex. Three reports hide it until it's reviewed. */
export function ReportButton({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!reason) return;
    setBusy(true);
    const { error } = await supabaseBrowser().from("reports").insert({ post_id: postId, reason });
    setBusy(false);
    setOpen(false);
    if (!error) toast("Thanks. We'll take a look.");
    else if (/duplicate key/.test(error.message)) toast("You already reported this flex.");
    else toast("Couldn't send the report. Try again.", { tone: "error" });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-full px-3 py-1 font-semibold text-muted hover:bg-paper hover:text-ink">
        Report
      </button>
    );
  }

  return (
    <fieldset className="mt-2 flex w-full flex-col gap-2 rounded-xl border border-line p-3 text-sm">
      <legend className="px-1 font-semibold">What&apos;s wrong with this flex?</legend>
      {REASONS.map((option) => (
        <label key={option.value} className="flex items-center gap-2">
          <input
            type="radio"
            name={`report-${postId}`}
            value={option.value}
            checked={reason === option.value}
            onChange={() => setReason(option.value)}
            className="accent-[var(--accent)]"
          />
          {option.label}
        </label>
      ))}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="button" className="btn btn-ink px-3 py-1.5 text-sm" disabled={!reason || busy} onClick={() => void send()}>
          {busy ? "Sending…" : "Send report"}
        </button>
      </div>
    </fieldset>
  );
}
