import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { SignUpForm } from "@/components/SignUpForm";

export const metadata: Metadata = { title: "Join", description: "Create a Flexit account and share what you made." };

export default function SignUpPage() {
  return (
    <AuthShell title="Join Flexit" subtitle="Share what you made, learned or achieved. Free, takes a minute.">
      <Suspense fallback={<div className="skeleton h-96 rounded-xl" />}>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  );
}
