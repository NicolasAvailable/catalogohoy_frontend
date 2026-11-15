// Crea (o actualiza) los 4 paquetes de créditos de IA como compras in-app
// CONSUMIBLES en App Store Connect y Google Play. Idempotente: si un producto
// ya existe, lo deja y solo completa lo que falte. Lo corre el workflow
// `iap-credit-products.yml` con los secretos que ya usa la publicación móvil.
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8_BASE64, ASC_APP_ID,
//      PLAY_SERVICE_ACCOUNT_JSON, PLAY_PACKAGE, SCREENSHOT (ruta PNG), ONLY (ios|android|'')
import crypto from 'node:crypto';
import fs from 'node:fs';

const PACKS = [
  { credits: 150, usd: '2.99' },
  { credits: 500, usd: '9.99' },
  { credits: 1000, usd: '19.99' },
  { credits: 2000, usd: '38.99' },
];
const id = (p) => `ch_credits_${p.credits}`;
const nameEs = (p) => `${p.credits} créditos de IA`;
const descEs = (p) => `${p.credits} créditos para fotos y textos con IA`; // ≤55 chars (Apple)
const nameEn = (p) => `${p.credits} AI credits`;
const descEn = (p) => `${p.credits} credits for AI photos and texts`;
const ONLY = process.env.ONLY || '';
const b64url = (b) => Buffer.from(b).toString('base64url');
let failures = 0;
const log = (...a) => console.log(...a);
const fail = (...a) => { failures++; console.log('ERROR', ...a); };

// ───────────────────────── App Store Connect ─────────────────────────
function ascToken() {
  const key = Buffer.from(process.env.ASC_KEY_P8_BASE64, 'base64').toString('utf8');
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64url(sig)}`;
}
async function asc(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${ascToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json.errors ?? json).slice(0, 600)}`);
  return json;
}
async function ascAll(path) {
  let out = [];
  let next = path;
  while (next) {
    const j = await asc('GET', next);
    out = out.concat(j.data ?? []);
    next = j.links?.next ? j.links.next.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  return out;
}

async function ios() {
  const appId = process.env.ASC_APP_ID;
  const existing = await ascAll(`/v1/apps/${appId}/inAppPurchasesV2?limit=200`);
  const territories = await ascAll('/v1/territories?limit=200');
  log(`ASC: ${existing.length} compras in-app existentes, ${territories.length} territorios`);
  for (const p of PACKS) {
    try {
      let iap = existing.find((x) => x.attributes.productId === id(p));
      if (!iap) {
        iap = (await asc('POST', '/v2/inAppPurchases', {
          data: {
            type: 'inAppPurchases',
            attributes: {
              name: `Créditos IA ${p.credits}`,
              productId: id(p),
              inAppPurchaseType: 'CONSUMABLE',
              reviewNote: 'Créditos de IA para la app (generar/editar fotos de productos y mejorar textos). Se compran en el menú del perfil → Créditos de IA. Los créditos se acreditan en el servidor al confirmar la compra y no vencen.',
              familySharable: false,
            },
            relationships: { app: { data: { type: 'apps', id: appId } } },
          },
        })).data;
        log(`iOS ${id(p)}: creado (${iap.id})`);
      } else {
        log(`iOS ${id(p)}: ya existe (${iap.id}, estado ${iap.attributes.state})`);
      }

      // Localizaciones
      const locs = await ascAll(`/v2/inAppPurchases/${iap.id}/inAppPurchaseLocalizations`);
      for (const [locale, name, description] of [
        ['es-MX', nameEs(p), descEs(p)],
        ['es-ES', nameEs(p), descEs(p)],
        ['en-US', nameEn(p), descEn(p)],
      ]) {
        if (locs.some((l) => l.attributes.locale === locale)) continue;
        await asc('POST', '/v1/inAppPurchaseLocalizations', {
          data: {
            type: 'inAppPurchaseLocalizations',
            attributes: { locale, name, description },
            relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iap.id } } },
          },
        });
        log(`  localización ${locale} ok`);
      }

      // Precio base en USA (Apple ajusta el resto de países)
      const points = await ascAll(`/v2/inAppPurchases/${iap.id}/pricePoints?filter[territory]=USA&limit=200`);
      const point = points.find((pt) => pt.attributes.customerPrice === p.usd);
      if (!point) throw new Error(`no hay price point de $${p.usd} en USA`);
      try {
        await asc('POST', '/v1/inAppPurchasePriceSchedules', {
          data: {
            type: 'inAppPurchasePriceSchedules',
            relationships: {
              inAppPurchase: { data: { type: 'inAppPurchases', id: iap.id } },
              baseTerritory: { data: { type: 'territories', id: 'USA' } },
              manualPrices: { data: [{ type: 'inAppPurchasePrices', id: '${price1}' }] },
            },
          },
          included: [{
            type: 'inAppPurchasePrices',
            id: '${price1}',
            attributes: { startDate: null },
            relationships: {
              inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iap.id } },
              inAppPurchasePricePoint: { data: { type: 'inAppPurchasePricePoints', id: point.id } },
            },
          }],
        });
        log(`  precio $${p.usd} ok`);
      } catch (e) { fail(`  precio ${id(p)}:`, e.message); }

      // Disponible en todos los países
      try {
        await asc('POST', '/v1/inAppPurchaseAvailabilities', {
          data: {
            type: 'inAppPurchaseAvailabilities',
            attributes: { availableInNewTerritories: true },
            relationships: {
              inAppPurchase: { data: { type: 'inAppPurchases', id: iap.id } },
              availableTerritories: { data: territories.map((t) => ({ type: 'territories', id: t.id })) },
            },
          },
        });
        log('  disponibilidad (todos los países) ok');
      } catch (e) { fail(`  disponibilidad ${id(p)}:`, e.message); }

      // Captura para la revisión de Apple
      const shot = process.env.SCREENSHOT;
      if (shot && fs.existsSync(shot)) {
        try {
          const cur = await asc('GET', `/v2/inAppPurchases/${iap.id}/appStoreReviewScreenshot`).catch(() => ({ data: null }));
          if (!cur.data) {
            const bytes = fs.readFileSync(shot);
            const md5 = crypto.createHash('md5').update(bytes).digest('hex');
            const res = (await asc('POST', '/v1/inAppPurchaseAppStoreReviewScreenshots', {
              data: {
                type: 'inAppPurchaseAppStoreReviewScreenshots',
                attributes: { fileName: 'creditos.png', fileSize: bytes.length },
                relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iap.id } } },
              },
            })).data;
            for (const op of res.attributes.uploadOperations) {
              const part = bytes.subarray(op.offset, op.offset + op.length);
              const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
              const up = await fetch(op.url, { method: op.method, headers, body: part });
              if (!up.ok) throw new Error(`subida ${up.status}`);
            }
            await asc('PATCH', `/v1/inAppPurchaseAppStoreReviewScreenshots/${res.id}`, {
              data: { type: 'inAppPurchaseAppStoreReviewScreenshots', id: res.id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
            });
            log('  captura de revisión ok');
          } else log('  captura de revisión ya estaba');
        } catch (e) { fail(`  captura ${id(p)}:`, e.message); }
      }
    } catch (e) {
      fail(`iOS ${id(p)}:`, e.message);
    }
  }
}

// ───────────────────────── Google Play ─────────────────────────
async function playToken() {
  const sa = JSON.parse(process.env.PLAY_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000 }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), sa.private_key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${b64url(sig)}` }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`token Google: ${JSON.stringify(j)}`);
  return j.access_token;
}

async function android() {
  const pkg = process.env.PLAY_PACKAGE;
  const token = await playToken();
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}`;
  const g = async (method, path, body) => {
    const res = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 600)}`);
    return text ? JSON.parse(text) : {};
  };
  // Idioma por defecto de la ficha (los listings deben incluirlo).
  let defaultLanguage = 'es-419';
  try {
    const edit = await g('POST', '/edits');
    const details = await g('GET', `/edits/${edit.id}/details`);
    defaultLanguage = details.defaultLanguage || defaultLanguage;
    await g('DELETE', `/edits/${edit.id}`).catch(() => {});
  } catch (e) { log('Play: no pude leer el idioma por defecto:', e.message); }
  log(`Play: idioma por defecto ${defaultLanguage}`);

  // API nueva de Google (one-time products con "purchase options"); la vieja
  // `inappproducts` ya responde "Please migrate to the new publishing API".
  const money = (usd) => {
    const [u, c = '0'] = usd.split('.');
    return { currencyCode: 'USD', units: u, nanos: Number(c.padEnd(9, '0').slice(0, 9)) };
  };
  for (const p of PACKS) {
    try {
      const conv = await g('POST', '/pricing:convertRegionPrices', { price: money(p.usd) });
      const regionsVersion = conv.regionVersion?.version ?? '2022/02';
      const regional = Object.values(conv.convertedRegionPrices ?? {}).map((r) => ({
        regionCode: r.regionCode,
        price: r.price,
        availability: 'AVAILABLE',
      }));
      const listings = [{ languageCode: defaultLanguage, title: nameEs(p), description: descEs(p) }];
      if (!defaultLanguage.startsWith('en')) listings.push({ languageCode: 'en-US', title: nameEn(p), description: descEn(p) });
      const body = {
        packageName: pkg,
        productId: id(p),
        listings,
        purchaseOptions: [{
          purchaseOptionId: 'default',
          buyOption: { legacyCompatible: true, multiQuantityEnabled: false },
          regionalPricingAndAvailabilityConfigs: regional,
          newRegionsConfig: {
            usdPrice: money(p.usd),
            eurPrice: conv.convertedOtherRegionsPrice?.eurPrice ?? { currencyCode: 'EUR', units: p.usd.split('.')[0], nanos: 0 },
            availability: 'AVAILABLE',
          },
        }],
      };
      const q = new URLSearchParams({ allowMissing: 'true', updateMask: 'listings,purchaseOptions', 'regionsVersion.version': regionsVersion });
      await g('PATCH', `/onetimeproducts/${id(p)}?${q}`, body);
      log(`Android ${id(p)}: guardado (${regional.length} regiones, versión ${regionsVersion})`);
      try {
        await g('POST', `/oneTimeProducts/${id(p)}/purchaseOptions:batchUpdateStates`, {
          requests: [{ activatePurchaseOptionRequest: { packageName: pkg, productId: id(p), purchaseOptionId: 'default' } }],
        });
        log('  activado');
      } catch (e) { fail(`  activar ${id(p)}:`, e.message); }
    } catch (e) {
      fail(`Android ${id(p)}:`, e.message);
    }
  }
}

if (ONLY !== 'android') await ios().catch((e) => fail('iOS:', e.message));
if (ONLY !== 'ios') await android().catch((e) => fail('Android:', e.message));
log(failures ? `Terminó con ${failures} error(es)` : 'Todo listo');
process.exit(failures ? 1 : 0);
