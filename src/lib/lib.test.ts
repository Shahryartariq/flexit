import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { count, linkLabel, plural, timeAgo } from "./format";
import { fitWithin, imagePath, publicImageUrl } from "./images";
import { safeNext } from "./next-path";
import { cleanSearch, friendlyError, isUuid } from "./queries";
import { SKILLS, getSkill, findSkill } from "./skills";
import { normalizeLink, postSchema, profileSchema, signUpSchema, usernameSchema } from "./validation";

const migration = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
  .join("\n");

describe("skills", () => {
  it("match the rows seeded in the database migration", () => {
    const seeded = [...migration.matchAll(/\('([a-z-]+)', '([^']+)', '([^']+)', (\d+)\)/g)].map((m) => ({
      slug: m[1],
      name: m[2],
      emoji: m[3],
    }));
    expect(seeded).toEqual(SKILLS.map(({ slug, name, emoji }) => ({ slug, name, emoji })));
  });

  it("fall back to 'Something else' for unknown slugs", () => {
    expect(getSkill("knitting").slug).toBe("other");
    expect(findSkill("knitting")).toBeUndefined();
  });
});

describe("normalizeLink", () => {
  it("adds https to bare domains", () => {
    expect(normalizeLink("github.com/Shahryartariq")).toBe("https://github.com/Shahryartariq");
  });
  it("keeps http and https links", () => {
    expect(normalizeLink("http://example.com/a?b=1")).toBe("http://example.com/a?b=1");
  });
  it("rejects scripts, other protocols and junk", () => {
    expect(normalizeLink("javascript:alert(1)")).toBeNull();
    expect(normalizeLink("ftp://example.com")).toBeNull();
    expect(normalizeLink("not a link")).toBeNull();
    expect(normalizeLink("localhost")).toBeNull();
  });
  it("treats empty input as no link", () => {
    expect(normalizeLink("   ")).toBeNull();
  });
  it("produces links the database accepts", () => {
    const link = normalizeLink("example.com/some path")!;
    expect(link).toMatch(/^https?:\/\/[^\s]+$/);
  });
});

describe("postSchema", () => {
  const valid = { skill_slug: "music", title: "  First song  ", body: "", link: "" };
  it("trims and normalises input", () => {
    expect(postSchema.parse(valid)).toEqual({ skill_slug: "music", title: "First song", body: "", link: null });
  });
  it("needs a known skill and a real title", () => {
    expect(postSchema.safeParse({ ...valid, skill_slug: "" }).success).toBe(false);
    expect(postSchema.safeParse({ ...valid, title: "Hi" }).success).toBe(false);
  });
  it("rejects bad links with a readable message", () => {
    const result = postSchema.safeParse({ ...valid, link: "javascript:alert(1)" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/web link/);
  });
});

describe("usernames and profiles", () => {
  it("lower-cases usernames and enforces the database rule", () => {
    expect(usernameSchema.parse(" Sherry_Dev ")).toBe("sherry_dev");
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("has space").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(21)).success).toBe(false);
  });
  it("validates sign-up input", () => {
    const ok = { display_name: "Sherry", username: "sherry", email: "s@example.com", password: "longenough" };
    expect(signUpSchema.safeParse(ok).success).toBe(true);
    expect(signUpSchema.safeParse({ ...ok, password: "short" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
  });
  it("limits profile fields like the database does", () => {
    expect(profileSchema.safeParse({ display_name: " ", headline: "", bio: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ display_name: "A", headline: "x".repeat(81), bio: "" }).success).toBe(false);
  });
});

describe("format", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  it("says 'just now' for the last minute", () => {
    expect(timeAgo("2026-11-13T11:59:30Z", now)).toBe("just now");
  });
  it("uses the largest whole unit", () => {
    expect(timeAgo("2026-11-13T11:55:00Z", now)).toBe("5 min. ago");
    expect(timeAgo("2026-11-13T09:00:00Z", now)).toBe("3 hr. ago");
    expect(timeAgo("2026-11-12T12:00:00Z", now)).toBe("yesterday");
  });
  it("counts compactly", () => {
    expect(count(1234)).toBe("1.2K");
    expect(plural(1, "flex", "flexes")).toBe("1 flex");
    expect(plural(3, "flex", "flexes")).toBe("3 flexes");
  });
  it("labels links by host", () => {
    expect(linkLabel("https://www.github.com/x")).toBe("github.com");
  });
});

describe("images", () => {
  it("fits large photos inside the box and leaves small ones alone", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(0, 10, 1600)).toEqual({ width: 0, height: 0 });
  });
  it("makes paths inside the user's folder that the database accepts", () => {
    const user = "8a3f5c2e-1111-4222-8333-944455556666";
    const dbRule = new RegExp(`^${user}/[A-Za-z0-9_-]{6,40}\\.(webp|jpg|jpeg|png)$`);
    for (let i = 0; i < 50; i += 1) expect(imagePath(user)).toMatch(dbRule);
    expect(imagePath(user, "jpg")).toMatch(dbRule);
  });
  it("returns no URL without a path", () => {
    expect(publicImageUrl("avatars", null)).toBeNull();
  });
});

describe("safeNext", () => {
  it("keeps local paths and blocks other sites", () => {
    expect(safeNext("/p/123")).toBe("/p/123");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext(null, "/new")).toBe("/new");
  });
});

describe("queries helpers", () => {
  it("recognises UUIDs", () => {
    expect(isUuid("8a3f5c2e-1111-4222-8333-944455556666")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
  it("turns database errors into plain sentences", () => {
    expect(friendlyError("Slow down: you can post 10 flexes an hour.")).toMatch(/10 flexes an hour/);
    expect(friendlyError('new row violates row-level security policy for table "posts"')).toMatch(/signed in/);
    expect(friendlyError("TypeError: Failed to fetch")).toMatch(/connection/);
  });
});

describe("cleanSearch", () => {
  it("keeps usernames and words, drops filter syntax", () => {
    expect(cleanSearch("  sara_dev ")).toBe("sara_dev");
    expect(cleanSearch("v2.0 release")).toBe("v2.0 release");
    expect(cleanSearch("a,b)or(c*%")).toBe("a b or c");
    expect(cleanSearch("x".repeat(80))).toHaveLength(60);
  });
});
