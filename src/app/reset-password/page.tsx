import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { ResetPasswordForm } from "@/components/PasswordResetForms";
import { PASSWORD_RESET } from "@/lib/env";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

export default function ResetPasswordPage() {
  if (!PASSWORD_RESET) notFound();
  return (
    <AuthShell title="Set a new password" subtitle="Pick something at least 8 characters long.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
