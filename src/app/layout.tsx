import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { Analytics } from "@/components/Analytics";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Toaster } from "@/components/Toaster";
import { UserMenu } from "@/components/UserMenu";
import { SITE_URL } from "@/lib/env";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const display = localFont({
  src: "./fonts/anybody.woff2",
  variable: "--font-display-face",
  weight: "100 900",
  display: "swap",
});

const body = localFont({
  src: "./fonts/instrument-sans.woff2",
  variable: "--font-body",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Flexit · Made something? Flex it.", template: "%s · Flexit" },
  description:
    "Flexit is where people share what they made, learned or achieved, in any skill: code, art, music, gaming, cooking and more.",
  applicationName: "Flexit",
  openGraph: { siteName: "Flexit", type: "website" },
  twitter: { card: "summary_large_image" },
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#12110f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 btn btn-ink">
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
            <Link href="/" aria-label="Flexit home">
              <Logo />
            </Link>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Link
                href="/search"
                aria-label="Search"
                title="Search"
                className="inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-card"
              >
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4.5 4.5" />
                </svg>
              </Link>
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted">
            <p>
              Flexit · Made something? Flex it. ·{" "}
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
            </p>
            <p>
              Built with Next.js and Supabase by{" "}
              <a className="font-semibold text-ink hover:underline" href="https://github.com/Shahryartariq">
                Muhammad Shehryar
              </a>
            </p>
          </div>
        </footer>
        <Toaster />
        <Analytics id={process.env.GA_MEASUREMENT_ID} />
      </body>
    </html>
  );
}
