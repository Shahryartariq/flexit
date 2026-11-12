import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { isConfigured, SITE_URL } from "@/lib/env";
import { SKILLS } from "@/lib/skills";
import { supabasePublic } from "@/lib/supabase/public";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // New flexes and people appear in the sitemap right away.
  await connection();
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    ...SKILLS.map((skill) => ({
      url: `${SITE_URL}/s/${skill.slug}`,
      changeFrequency: "hourly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
  if (!isConfigured) return pages;

  const db = supabasePublic();
  const [posts, profiles] = await Promise.all([
    db.from("posts").select("id, created_at").order("created_at", { ascending: false }).limit(5000),
    db.from("profiles").select("username, created_at").order("created_at", { ascending: false }).limit(5000),
  ]);
  for (const post of posts.data ?? []) {
    pages.push({ url: `${SITE_URL}/p/${post.id}`, lastModified: post.created_at, priority: 0.6 });
  }
  for (const profile of profiles.data ?? []) {
    pages.push({ url: `${SITE_URL}/u/${profile.username}`, lastModified: profile.created_at, priority: 0.5 });
  }
  return pages;
}
