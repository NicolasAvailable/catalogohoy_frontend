import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execFileSync } from "node:child_process";
import { componentTagger } from "lovable-tagger";

/** Tras el build, genera los HTML estáticos del blog (SEO) en dist/blog. */
const prerenderBlog = (): Plugin => ({
  name: "prerender-blog",
  apply: "build",
  closeBundle() {
    execFileSync("node", [path.resolve(__dirname, "scripts/prerender-blog.mjs")], {
      stdio: "inherit",
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), prerenderBlog()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Evita copias duplicadas de React al ejecutar desde el monorepo (Nx)
    dedupe: ["react", "react-dom"],
  },
}));
