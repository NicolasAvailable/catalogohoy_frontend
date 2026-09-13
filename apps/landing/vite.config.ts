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

/**
 * Tras el build (y DESPUÉS del blog), genera los HTML estáticos de las páginas
 * de marketing/SEO (/pricing, /features, /faq y las guías) en dist/<ruta>.
 * Lee dist/index.html como plantilla, igual que el prerender del blog.
 */
const prerenderPages = (): Plugin => ({
  name: "prerender-pages",
  apply: "build",
  closeBundle() {
    execFileSync("node", [path.resolve(__dirname, "scripts/prerender-pages.mjs")], {
      stdio: "inherit",
    });
  },
});

/** Genera desde la DB (no manual): catalogos.xml (sitemap índice de todos los
 *  catálogos con productos) + el directorio público /tiendas que los enlaza. */
const generateCatalogs = (): Plugin => ({
  name: "generate-catalogs",
  apply: "build",
  closeBundle() {
    execFileSync("node", [path.resolve(__dirname, "scripts/generate-catalogs.mjs")], {
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
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    prerenderBlog(),
    prerenderPages(),
    generateCatalogs(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Evita copias duplicadas de React al ejecutar desde el monorepo (Nx)
    dedupe: ["react", "react-dom"],
  },
  build: {
    // Core Web Vitals: separar TODAS las dependencias en un único chunk `vendor`
    // (cacheable entre deploys, cambia poco), dejando el código de la app en su
    // propio chunk (antes todo iba junto en ~750 kB → ahora app ~270 kB).
    // ⚠️ NO separar React en su propio chunk: rompe el orden de init
    //   (`Cannot read properties of undefined (reading 'createContext')`) porque
    //   un chunk consumidor puede evaluarse antes que React. Con todo el vendor
    //   en un solo chunk, Rollup ordena los módulos por dependencia internamente.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
}));
