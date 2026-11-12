import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flexit",
    short_name: "Flexit",
    description: "Share what you made, learned or achieved, in any skill.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ee",
    theme_color: "#ff5a1f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
