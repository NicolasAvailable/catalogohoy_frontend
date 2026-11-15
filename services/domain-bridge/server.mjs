// domain-bridge — puente mínimo entre Supabase y la API de Namecheap.
//
// Namecheap solo acepta llamadas desde IPs en lista blanca y las edge functions
// de Supabase no tienen IP fija. Este servicio corre en un servidor con IP fija
// (AWS Lightsail) y expone SOLO las operaciones que necesita la venta de
// dominios. Sin dependencias: Node 20+ (fetch nativo).
//
// Seguridad: cada request debe traer `x-bridge-secret` = BRIDGE_SECRET. El
// servicio no guarda estado; la lógica de negocio (precios, cobros, cuándo
// comprar) vive en la edge function `domains`.
//
// Variables de entorno (ver README.md):
//   BRIDGE_SECRET, NAMECHEAP_API_USER, NAMECHEAP_API_KEY, NAMECHEAP_USERNAME
//   (por defecto = API_USER), NAMECHEAP_CLIENT_IP (la IP fija en lista blanca),
//   NAMECHEAP_SANDBOX=1 para el sandbox, PORT (8787),
//   REGISTRANT_* (datos de contacto del titular: CATALOGOHOY, LLC).

import http from "node:http";
import { timingSafeEqual } from "node:crypto";

const env = process.env;
const PORT = Number(env.PORT || 8787);
const SANDBOX = env.NAMECHEAP_SANDBOX === "1";
const API_URL = env.NAMECHEAP_API_URL || (SANDBOX
  ? "https://api.sandbox.namecheap.com/xml.response"
  : "https://api.namecheap.com/xml.response");

// DNS de Vercel para el proyecto del catálogo.
const VERCEL_APEX_IP = env.VERCEL_APEX_IP || "76.76.21.21";
const VERCEL_CNAME = env.VERCEL_CNAME || "cname.vercel-dns.com";

const REQUIRED = ["BRIDGE_SECRET", "NAMECHEAP_API_USER", "NAMECHEAP_API_KEY", "NAMECHEAP_CLIENT_IP"];
for (const k of REQUIRED) {
  if (!env[k]) {
    console.error(`Falta la variable de entorno ${k}`);
    process.exit(1);
  }
}

// ── XML mínimo ─────────────────────────────────────────────────────────────
// Las respuestas de Namecheap ponen casi todo en atributos. Con esto basta.
function attrs(tagSource) {
  const out = {};
  const re = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
  let m;
  while ((m = re.exec(tagSource))) out[m[1]] = decode(m[2]);
  return out;
}
function decode(s) {
  return s
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
/** Todas las etiquetas `<name ...>` (abiertas o auto-cerradas) como objetos de atributos. */
function tags(xml, name) {
  const re = new RegExp(`<${name}(\\s[^>]*)?/?>`, "g");
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push(attrs(m[1] || ""));
  return out;
}

class NamecheapError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function namecheap(command, params = {}) {
  const qs = new URLSearchParams({
    ApiUser: env.NAMECHEAP_API_USER,
    ApiKey: env.NAMECHEAP_API_KEY,
    UserName: env.NAMECHEAP_USERNAME || env.NAMECHEAP_API_USER,
    ClientIp: env.NAMECHEAP_CLIENT_IP,
    Command: command,
    ...params,
  });
  // POST con form-urlencoded: domains.create lleva muchos campos.
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: qs.toString(),
    signal: AbortSignal.timeout(60_000),
  });
  const xml = await res.text();
  const status = attrs((xml.match(/<ApiResponse([^>]*)>/) || [])[1] || "").Status;
  if (status !== "OK") {
    const err = xml.match(/<Error[^>]*Number="(\d+)"[^>]*>([\s\S]*?)<\/Error>/);
    throw new NamecheapError(err ? decode(err[2]).trim() : `Respuesta inválida de Namecheap (${res.status})`, err ? err[1] : "unknown");
  }
  return xml;
}

function splitDomain(domain) {
  const i = domain.indexOf(".");
  return { sld: domain.slice(0, i), tld: domain.slice(i + 1) };
}

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z]{2,24}){1,2}$/;
function cleanDomain(d) {
  const v = String(d || "").trim().toLowerCase();
  if (!DOMAIN_RE.test(v)) throw new NamecheapError(`Dominio inválido: ${v}`, "invalid_domain");
  return v;
}

// ── Contacto del titular (siempre CATALOGOHOY, LLC) ───────────────────────
function contactParams() {
  const c = {
    FirstName: env.REGISTRANT_FIRST_NAME,
    LastName: env.REGISTRANT_LAST_NAME,
    OrganizationName: env.REGISTRANT_ORG || "CATALOGOHOY, LLC",
    Address1: env.REGISTRANT_ADDRESS1,
    City: env.REGISTRANT_CITY,
    StateProvince: env.REGISTRANT_STATE,
    PostalCode: env.REGISTRANT_ZIP,
    Country: env.REGISTRANT_COUNTRY || "US",
    Phone: env.REGISTRANT_PHONE, // formato Namecheap: +1.4045551234
    EmailAddress: env.REGISTRANT_EMAIL,
  };
  for (const [k, v] of Object.entries(c)) {
    if (!v) throw new NamecheapError(`Falta REGISTRANT_* para ${k}`, "config");
  }
  const out = {};
  for (const role of ["Registrant", "Tech", "Admin", "AuxBilling"]) {
    for (const [k, v] of Object.entries(c)) out[`${role}${k}`] = v;
  }
  return out;
}

// ── Operaciones ────────────────────────────────────────────────────────────
const pricingCache = new Map(); // tld → { at, value }
const PRICING_TTL_MS = 6 * 60 * 60 * 1000;

async function tldPricing(tld, action) {
  const xml = await namecheap("namecheap.users.getPricing", {
    ProductType: "DOMAIN",
    ProductCategory: "DOMAINS",
    ActionName: action,
    ProductName: tld,
  });
  const p = tags(xml, "Price").find((x) => x.Duration === "1" && (x.DurationType || "YEAR").toUpperCase() === "YEAR");
  if (!p) return null;
  const price = Number(p.YourPrice || p.Price);
  // Namecheap escribe "YourAdditonalCost" (sic) en algunas respuestas.
  const extra = Number(p.YourAdditonalCost ?? p.YourAdditionalCost ?? p.AdditionalCost ?? 0);
  return Number.isFinite(price) ? Math.round((price + (Number.isFinite(extra) ? extra : 0)) * 100) : null;
}

async function pricing(tlds) {
  const out = {};
  for (const raw of tlds) {
    const tld = String(raw).toLowerCase().replace(/^\./, "");
    if (!/^[a-z]{2,24}(\.[a-z]{2,24})?$/.test(tld)) continue;
    const hit = pricingCache.get(tld);
    if (hit && Date.now() - hit.at < PRICING_TTL_MS) { out[tld] = hit.value; continue; }
    const [registerCents, renewCents] = await Promise.all([tldPricing(tld, "REGISTER"), tldPricing(tld, "RENEW")]);
    const value = { registerCents, renewCents };
    pricingCache.set(tld, { at: Date.now(), value });
    out[tld] = value;
  }
  return out;
}

async function check(domains) {
  const list = domains.slice(0, 30).map(cleanDomain);
  const xml = await namecheap("namecheap.domains.check", { DomainList: list.join(",") });
  return tags(xml, "DomainCheckResult").map((r) => ({
    domain: r.Domain?.toLowerCase(),
    available: r.Available === "true",
    premium: r.IsPremiumName === "true",
    premiumRegisterCents: r.PremiumRegistrationPrice ? Math.round(Number(r.PremiumRegistrationPrice) * 100) : null,
    premiumRenewCents: r.PremiumRenewalPrice ? Math.round(Number(r.PremiumRenewalPrice) * 100) : null,
  }));
}

async function register(domain, years) {
  const d = cleanDomain(domain);
  const xml = await namecheap("namecheap.domains.create", {
    DomainName: d,
    Years: String(years || 1),
    AddFreeWhoisguard: "yes",
    WGEnabled: "yes",
    ...contactParams(),
  });
  const r = tags(xml, "DomainCreateResult")[0] || {};
  if (r.Registered !== "true") throw new NamecheapError(`Namecheap no registró ${d}`, "not_registered");
  return {
    domain: d,
    orderId: r.OrderID || null,
    transactionId: r.TransactionID || null,
    domainId: r.DomainID || null,
    chargedCents: r.ChargedAmount ? Math.round(Number(r.ChargedAmount) * 100) : null,
  };
}

async function setHosts(domain) {
  const { sld, tld } = splitDomain(cleanDomain(domain));
  await namecheap("namecheap.domains.dns.setHosts", {
    SLD: sld,
    TLD: tld,
    HostName1: "@", RecordType1: "A", Address1: VERCEL_APEX_IP, TTL1: "1800",
    HostName2: "www", RecordType2: "CNAME", Address2: VERCEL_CNAME, TTL2: "1800",
  });
  return { domain, ok: true };
}

async function renew(domain, years) {
  const d = cleanDomain(domain);
  const xml = await namecheap("namecheap.domains.renew", { DomainName: d, Years: String(years || 1) });
  const r = tags(xml, "DomainRenewResult")[0] || {};
  const det = tags(xml, "DomainDetails")[0] || {};
  return {
    domain: d,
    renewed: r.Renew === "true",
    orderId: r.OrderID || null,
    chargedCents: r.ChargedAmount ? Math.round(Number(r.ChargedAmount) * 100) : null,
    expiresAt: det.ExpiredDate || null,
  };
}

async function info(domain) {
  const d = cleanDomain(domain);
  const xml = await namecheap("namecheap.domains.getInfo", { DomainName: d });
  const r = tags(xml, "DomainGetInfoResult")[0] || {};
  const created = (xml.match(/<CreatedDate>([^<]*)<\/CreatedDate>/) || [])[1] || null;
  const expires = (xml.match(/<ExpiredDate>([^<]*)<\/ExpiredDate>/) || [])[1] || null;
  return { domain: d, status: r.Status || null, createdAt: created, expiresAt: expires };
}

async function balance() {
  const xml = await namecheap("namecheap.users.getBalances");
  const r = tags(xml, "UserGetBalancesResult")[0] || {};
  return {
    currency: r.Currency || "USD",
    availableCents: Math.round(Number(r.AvailableBalance || 0) * 100),
  };
}

// ── HTTP ───────────────────────────────────────────────────────────────────
const ROUTES = {
  "/check": (b) => check(Array.isArray(b.domains) ? b.domains : []),
  "/pricing": (b) => pricing(Array.isArray(b.tlds) ? b.tlds : []),
  "/register": (b) => register(b.domain, b.years),
  "/set-hosts": (b) => setHosts(b.domain),
  "/renew": (b) => renew(b.domain, b.years),
  "/info": (b) => info(b.domain),
  "/balance": () => balance(),
};

function authorized(req) {
  const got = Buffer.from(String(req.headers["x-bridge-secret"] || ""));
  const want = Buffer.from(env.BRIDGE_SECRET);
  return got.length === want.length && timingSafeEqual(got, want);
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, sandbox: SANDBOX });
  const route = ROUTES[req.url || ""];
  if (req.method !== "POST" || !route) return send(res, 404, { ok: false, error: "not_found" });
  if (!authorized(req)) return send(res, 401, { ok: false, error: "unauthorized" });

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) return send(res, 413, { ok: false, error: "too_large" });
  }
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { return send(res, 400, { ok: false, error: "invalid_json" }); }

  try {
    const data = await route(body);
    send(res, 200, { ok: true, data });
  } catch (e) {
    const code = e instanceof NamecheapError ? e.code : "internal";
    console.error(`[${req.url}]`, code, e?.message);
    send(res, e instanceof NamecheapError ? 422 : 500, { ok: false, error: e?.message || "error", code });
  }
});

server.listen(PORT, () => {
  console.log(`domain-bridge escuchando en :${PORT} (${SANDBOX ? "sandbox" : "producción"})`);
});
