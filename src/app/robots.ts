import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/new", "/settings", "/notifications", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/auth/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
