import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { ARTICLES } from "@/blog";

/**
 * El blog renderiza cada imagen como <picture> con un <source> .webp.
 * Si el .webp no existe el navegador muestra la imagen rota (no cae al .jpg),
 * así que cada imagen local necesita el archivo original y su .webp.
 */
const PUBLIC = path.resolve(__dirname, "../../public");

describe("imágenes del blog", () => {
  const srcs = ARTICLES.flatMap((a) => [
    ...a.blocks.flatMap((b) => (b.type === "img" ? [{ slug: a.slug, src: b.src }] : [])),
    ...(a.coverImage ? [{ slug: a.slug, src: a.coverImage }] : []),
  ]).filter(({ src }) => !/^https?:\/\//.test(src));

  it.each(srcs)("$slug → $src existe con su .webp", ({ src }) => {
    expect(existsSync(path.join(PUBLIC, src))).toBe(true);
    if (/\.(jpe?g|png)$/.test(src)) {
      expect(existsSync(path.join(PUBLIC, src.replace(/\.(jpe?g|png)$/, ".webp")))).toBe(true);
    }
  });
});
