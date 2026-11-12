import Link from "next/link";
import { getSkill, skillColors } from "@/lib/skills";

export function SkillChip({ slug, link = true, count }: { slug: string; link?: boolean; count?: number }) {
  const skill = getSkill(slug);
  const colors = skillColors(slug);
  const content = (
    <>
      <span aria-hidden="true">{skill.emoji}</span>
      {skill.name}
      {count !== undefined && <span className="opacity-70">· {count}</span>}
    </>
  );
  const style = { background: colors.background, color: colors.ink };
  return link ? (
    <Link href={`/s/${skill.slug}`} className="chip hover:brightness-95" style={style}>
      {content}
    </Link>
  ) : (
    <span className="chip" style={style}>
      {content}
    </span>
  );
}
