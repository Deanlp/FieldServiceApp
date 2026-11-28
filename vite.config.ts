import { defineConfig } from "vite";

// Builds the installable web app into ./dist, which the Worker serves as static assets.
export default defineConfig({
  root: "src/web",
  publicDir: "public",
  build: { outDir: "../../dist", emptyOutDir: true },
});
