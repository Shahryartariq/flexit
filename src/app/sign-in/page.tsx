import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { SignInForm } from "@/components/SignInForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to flex, like and comment.">
      <Suspense fallback={<div className="skeleton h-64 rounded-xl" />}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
