import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PhumiReader",
    short_name: "Phumi",
    description: "Read and share stories in Khmer and English.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#00DC64",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  }
}
