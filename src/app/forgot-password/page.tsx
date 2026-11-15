import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { ForgotPasswordForm } from "@/components/PasswordResetForms";
import { PASSWORD_RESET } from "@/lib/env";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  if (!PASSWORD_RESET) notFound();
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to set a new one.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
