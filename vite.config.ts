import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" so the built app works when hosted on any subpath (Netlify, GitHub Pages, SharePoint, etc.)
export default defineConfig({
  plugins: [react()],
  base: "./",
});
