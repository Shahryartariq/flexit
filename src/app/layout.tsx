import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { Analytics } from "@/components/Analytics";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/UserMenu";
import { SITE_URL } from "@/lib/env";
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
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 btn btn-ink">
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
            <Link href="/" aria-label="Flexit home">
              <Logo />
            </Link>
            <UserMenu />
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
        <Analytics id={process.env.GA_MEASUREMENT_ID} />
      </body>
    </html>
  );
}
