import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    assetsInlineLimit: 0,
    // Vite's own hashed bundles go to /static so they can be cached forever,
    // separately from /assets which holds stable-named game art.
    assetsDir: "static",
  },
});
