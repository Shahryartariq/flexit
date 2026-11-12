import { z } from "zod";
import { SKILLS } from "./skills";

const skillSlugs = SKILLS.map((skill) => skill.slug) as [string, ...string[]];

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Use 3–20 lowercase letters, numbers or underscores.");

/** Adds https:// to bare domains and rejects anything that isn't a web link. */
export function normalizeLink(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    const href = url.toString();
    return href.length <= 300 && !/\s/.test(href) ? href : null;
  } catch {
    return null;
  }
}

export const postSchema = z.object({
  skill_slug: z.enum(skillSlugs, "Pick a skill."),
  title: z
    .string()
    .trim()
    .min(3, "Give it a title of at least 3 characters.")
    .max(100, "Keep the title under 100 characters."),
  body: z.string().trim().max(1000, "Keep the story under 1,000 characters."),
  link: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      const link = normalizeLink(value);
      if (!link) {
        ctx.addIssue({ code: "custom", message: "That doesn't look like a web link." });
        return z.NEVER;
      }
      return link;
    }),
});

export type PostInput = z.infer<typeof postSchema>;

export const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Add your name.").max(50, "Keep your name under 50 characters."),
  headline: z.string().trim().max(80, "Keep the headline under 80 characters."),
  bio: z.string().trim().max(280, "Keep the bio under 280 characters."),
});

export const commentSchema = z
  .string()
  .trim()
  .min(1, "Write something first.")
  .max(500, "Keep comments under 500 characters.");

export const signUpSchema = z.object({
  display_name: z.string().trim().min(1, "Add your name.").max(50, "Keep your name under 50 characters."),
  username: usernameSchema,
  email: z.email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

/** First message of a failed parse, for showing next to a form. */
export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Something is not right.";
}
