import { ImageResponse } from "next/og";
import { isConfigured } from "@/lib/env";
import { OG_COLORS, OG_SIZE, OgFrame, ogFonts } from "@/lib/og";
import { fetchPost } from "@/lib/queries";
import { getSkill } from "@/lib/skills";
import { supabasePublic } from "@/lib/supabase/public";

export const alt = "A flex on Flexit";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = isConfigured ? await fetchPost(supabasePublic(), id).catch(() => null) : null;
  const skill = getSkill(post?.skill_slug ?? "other");
  const title = post?.title ?? "Made something? Flex it.";
  const fontSize = title.length > 70 ? 60 : title.length > 40 ? 74 : 92;

  return new ImageResponse(
    (
      <OgFrame background={`hsl(${skill.hue} 70% 92%)`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "8px 20px",
              borderRadius: 999,
              background: `hsl(${skill.hue} 55% 42%)`,
              color: "#fff",
              fontSize: 28,
              fontWeight: 600,
            }}
          >
            {skill.name}
          </span>
          <div style={{ display: "flex", fontFamily: "Anybody", fontSize, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>
            {title}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 30 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600 }}>{post?.author.display_name ?? "Flexit"}</span>
            <span style={{ color: OG_COLORS.muted }}>{post ? `@${post.author.username}` : "getflexit.vercel.app"}</span>
          </div>
          {post && (
            <span style={{ color: OG_COLORS.muted }}>
              ♥ {post.like_count} · 💬 {post.comment_count}
            </span>
          )}
        </div>
      </OgFrame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
