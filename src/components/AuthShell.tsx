import Link from "next/link";
import { LogoMark } from "./Logo";

export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <LogoMark size={44} />
        <h1 className="display text-3xl font-extrabold">{title}</h1>
        <p className="text-muted">{subtitle}</p>
      </div>
      <div className="card p-6">{children}</div>
      {footer && <p className="text-center text-sm text-muted">{footer}</p>}
      <p className="text-center text-xs text-muted">
        By joining you agree to post only your own work and to be kind. <Link href="/" className="underline">Back to the feed</Link>
      </p>
    </div>
  );
}
