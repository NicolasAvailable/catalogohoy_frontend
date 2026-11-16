// Estado de la app en App Store Connect y (con MODE=submit-iaps) envío de los
// paquetes de créditos (consumibles) a revisión junto con la versión.
// Lo corre el workflow `iap-credit-products.yml`.
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8_BASE64, ASC_APP_ID, MODE (status|submit-iaps)
import crypto from 'node:crypto';

const MODE = process.env.MODE || 'status';
const b64url = (b) => Buffer.from(b).toString('base64url');

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
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json.errors ?? json).slice(0, 800)}`);
  return json;
}

const appId = process.env.ASC_APP_ID;
const versions = await asc('GET', `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=5`);
for (const v of versions.data) {
  console.log(`version ${v.attributes.versionString} · ${v.attributes.appStoreState} · ${v.attributes.appVersionState ?? ''} · ${v.id}`);
}
const subs = await asc('GET', `/v1/reviewSubmissions?filter[app]=${appId}&limit=5`).catch((e) => ({ data: [], err: e.message }));
for (const s of subs.data ?? []) console.log(`reviewSubmission ${s.id} · ${s.attributes.state} · ${s.attributes.submittedDate ?? ''}`);
if (subs.err) console.log(subs.err);

const iaps = await asc('GET', `/v1/apps/${appId}/inAppPurchasesV2?limit=50`);
const credits = iaps.data.filter((i) => /^ch_credits_/.test(i.attributes.productId));
for (const i of credits) console.log(`iap ${i.attributes.productId} · ${i.attributes.state} · ${i.id}`);

if (MODE === 'submit-iaps') {
  let failed = 0;
  for (const i of credits) {
    if (i.attributes.state !== 'READY_TO_SUBMIT') {
      console.log(`skip ${i.attributes.productId} (${i.attributes.state})`);
      continue;
    }
    try {
      await asc('POST', '/v1/inAppPurchaseSubmissions', {
        data: { type: 'inAppPurchaseSubmissions', relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id: i.id } } } },
      });
      console.log(`submitted ${i.attributes.productId}`);
    } catch (e) {
      failed++;
      console.log(`ERROR ${i.attributes.productId}: ${e.message}`);
    }
  }
  if (failed) process.exit(1);
}
