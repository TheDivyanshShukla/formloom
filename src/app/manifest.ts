import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Formloom",
    short_name: "Formloom",
    description: "Describe a form, get a form. AI form builder with live spreadsheet sync.",
    start_url: "/forms",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#131416",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
