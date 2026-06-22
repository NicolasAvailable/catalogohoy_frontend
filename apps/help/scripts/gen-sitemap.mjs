// Generates dist/sitemap.xml by scanning the prerendered output.
// Each route that vite-react-ssg emitted becomes a <url> entry.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const SITE_URL = "https://help.catalogohoy.com";
const DIST = new URL("../dist", import.meta.url).pathname;
const EXCLUDE = new Set(["/buscar", "/404"]);

const routes = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (name.endsWith(".html")) {
      let rel = relative(DIST, full).replace(/\\/g, "/").replace(/\.html$/, "");
      if (rel === "index") rel = "";
      rel = rel.replace(/\/index$/, "");
      routes.push(rel === "" ? "/" : `/${rel}`);
    }
  }
};
walk(DIST);

const urls = routes
  .filter((r) => !EXCLUDE.has(r))
  .sort((a, b) => a.length - b.length);

const today = new Date().toISOString().slice(0, 10);
const body = urls
  .map((u) => {
    const priority = u === "/" ? "1.0" : u.startsWith("/c/") ? "0.8" : "0.7";
    return `  <url>\n    <loc>${SITE_URL}${u === "/" ? "/" : u}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(join(DIST, "sitemap.xml"), xml);
console.log(`sitemap.xml: ${urls.length} URLs`);
