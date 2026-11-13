import type { SkillSlug } from "./types";

export type Skill = { slug: SkillSlug; name: string; emoji: string; hue: number };

/** Mirrors the rows seeded in the database migration (a test keeps them in sync). */
export const SKILLS: readonly Skill[] = [
  { slug: "development", name: "Development", emoji: "💻", hue: 225 },
  { slug: "design", name: "Design", emoji: "🎨", hue: 320 },
  { slug: "art", name: "Art", emoji: "🖌️", hue: 12 },
  { slug: "music", name: "Music", emoji: "🎸", hue: 275 },
  { slug: "gaming", name: "Gaming", emoji: "🎮", hue: 145 },
  { slug: "fitness", name: "Fitness", emoji: "🏋️", hue: 28 },
  { slug: "cooking", name: "Cooking", emoji: "🍳", hue: 45 },
  { slug: "writing", name: "Writing", emoji: "✍️", hue: 190 },
  { slug: "photography", name: "Photography", emoji: "📷", hue: 205 },
  { slug: "learning", name: "Learning", emoji: "🎓", hue: 165 },
  { slug: "business", name: "Business", emoji: "📈", hue: 100 },
  { slug: "other", name: "Something else", emoji: "✨", hue: 50 },
];

const BY_SLUG = new Map(SKILLS.map((skill) => [skill.slug, skill]));

export function findSkill(slug: string): Skill | undefined {
  return BY_SLUG.get(slug as SkillSlug);
}

export function getSkill(slug: string): Skill {
  return BY_SLUG.get(slug as SkillSlug) ?? SKILLS[SKILLS.length - 1];
}

/** Background and ink colours for a skill, from its hue; adapts to light and dark themes. */
export function skillColors(slug: string) {
  const { hue } = getSkill(slug);
  return {
    background: `light-dark(oklch(0.93 0.06 ${hue}), oklch(0.31 0.07 ${hue}))`,
    strong: `light-dark(oklch(0.52 0.17 ${hue}), oklch(0.62 0.16 ${hue}))`,
    ink: `light-dark(oklch(0.3 0.08 ${hue}), oklch(0.92 0.05 ${hue}))`,
  };
}
