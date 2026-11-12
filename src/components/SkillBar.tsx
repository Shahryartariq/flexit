import Link from "next/link";
import { SKILLS, skillColors } from "@/lib/skills";

/** Horizontal row of every skill; the active one is filled in. */
export function SkillBar({ active }: { active?: string }) {
  return (
    <nav aria-label="Skills" className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      <Link
        href="/"
        className={`chip border-[1.5px] ${active ? "border-line bg-card text-ink" : "border-ink bg-ink text-paper"}`}
        aria-current={active ? undefined : "page"}
      >
        All skills
      </Link>
      {SKILLS.map((skill) => {
        const isActive = skill.slug === active;
        const colors = skillColors(skill.slug);
        return (
          <Link
            key={skill.slug}
            href={`/s/${skill.slug}`}
            aria-current={isActive ? "page" : undefined}
            className="chip border-[1.5px]"
            style={
              isActive
                ? { background: colors.strong, borderColor: colors.strong, color: "#fff" }
                : { background: "var(--card)", borderColor: "var(--line)", color: "var(--ink)" }
            }
          >
            <span aria-hidden="true">{skill.emoji}</span>
            {skill.name}
          </Link>
        );
      })}
    </nav>
  );
}
