import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// meta-catalog-feed — feed CSV de productos para el Commerce Catalog de Meta
// (CAT-64). Meta lo ingiere en un schedule diario (y bajo demanda con
// "Sincronizar ahora" desde meta-catalog).
//
//   GET ?t=<tenantId>&sig=<hmac>  →  text/csv
//
// Público (Meta lo consume sin JWT) pero no enumerable: `sig` es
// HMAC-SHA256(FB_APP_SECRET, "feed|<tenantId>") — la misma firma que genera
// meta-catalog al registrar el feed. Formato de columnas según
// https://developers.facebook.com/docs/commerce-platform/catalog/fields
//
// Reglas de mapeo (espejo del storefront):
//   - Se omiten productos ocultos (is_hidden) y variantes ocultas (isHidden).
//   - Se omiten filas sin foto (Meta las rechaza igual).
//   - Variantes → una fila por variante con item_group_id del producto padre.
//   - availability: agotado si is_sold_out o stock=0 (stock null = sin control
//     de stock = disponible). Variante con stock numérico manda sobre el padre.
//   - price/sale_price: price_promotional (si es menor) va como sale_price.
//   - link: https://<slug>.catalogohoy.com/product/<id>
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FB_APP_SECRET = Deno.env.get("FB_APP_SECRET") ?? Deno.env.get("WA_APP_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function feedSig(tenantId) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(FB_APP_SECRET || "dev-secret"),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`feed|${tenantId}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const HEADER = [
  "id", "item_group_id", "title", "description", "availability", "condition",
  "price", "sale_price", "link", "image_link", "brand",
];

function csvCell(value) {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return `"${s.replaceAll('"', '""')}"`;
}

/** Las descripciones del editor son HTML; Meta espera texto plano (el markup
 *  saldría literal en el Shop). Tags → espacio, entidades comunes decodificadas. */
function stripHtml(html) {
  return String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

function fmtPrice(value, currency) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toFixed(2)} ${currency}`;
}

/** availability de Meta: "in stock" | "out of stock". stock null = sin control. */
function availability(soldOut, stock) {
  if (soldOut) return "out of stock";
  if (stock !== null && stock !== undefined && Number(stock) <= 0) return "out of stock";
  return "in stock";
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const url = new URL(req.url);
  const tenantId = Number(url.searchParams.get("t") ?? "");
  const sig = url.searchParams.get("sig") ?? "";
  if (!tenantId || sig !== (await feedSig(tenantId))) {
    return new Response("Not found", { status: 404 });
  }

  const [{ data: tenant }, { data: config }, { data: products }] = await Promise.all([
    admin.from("tenants").select("slug, name").eq("id", tenantId).maybeSingle(),
    admin.from("tenant_ecommerce_config").select("currency").eq("tenant_id", tenantId).maybeSingle(),
    admin.from("products")
      .select("id, name, description, price, price_promotional, stock, is_sold_out, is_hidden, is_variant, variants, photos")
      .eq("tenant_id", tenantId).eq("is_hidden", false)
      .order("position", { ascending: true }).order("id", { ascending: true })
      .limit(5000),
  ]);
  if (!tenant) return new Response("Not found", { status: 404 });

  const currency = (config?.currency ?? "USD").toUpperCase();
  const brand = tenant.name ?? tenant.slug;
  const baseUrl = `https://${tenant.slug}.catalogohoy.com`;

  const rows = [HEADER.map(csvCell).join(",")];
  for (const p of products ?? []) {
    const link = `${baseUrl}/product/${p.id}`;
    const productImage = (p.photos ?? [])[0] ?? null;
    const description = stripHtml(p.description) || p.name;
    const basePrice = fmtPrice(p.price, currency);

    const variants = p.is_variant && Array.isArray(p.variants) ? p.variants : [];
    if (variants.length > 0) {
      for (const v of variants) {
        if (v?.isHidden) continue;
        const image = (v?.photos ?? [])[0] ?? productImage;
        const price = fmtPrice(v?.price, currency) ?? basePrice;
        if (!image || !price) continue;
        rows.push([
          `v_${v.id}`, `p_${p.id}`, `${p.name} - ${v.name}`, description,
          availability(p.is_sold_out, v?.stock ?? p.stock), "new",
          price, "", link, image, brand,
        ].map(csvCell).join(","));
      }
    } else {
      if (!productImage || !basePrice) continue;
      const promo = fmtPrice(p.price_promotional, currency);
      const salePrice = promo && Number(p.price_promotional) < Number(p.price) ? promo : "";
      rows.push([
        `p_${p.id}`, "", p.name, description,
        availability(p.is_sold_out, p.stock), "new",
        basePrice, salePrice, link, productImage, brand,
      ].map(csvCell).join(","));
    }
  }

  return new Response(rows.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
});
