// Backend falso de Supabase para probar el admin en local sin tocar producción.
const REF = 'yvkurjivijnhliofmfmj';
const USER = { id: '00000000-0000-0000-0000-0000000000aa', aud: 'authenticated', role: 'authenticated', email: 'demo@catalogohoy.com', app_metadata: { provider: 'email' }, user_metadata: { name: 'Demo' }, created_at: '2026-01-01T00:00:00Z' };
const TENANT = { id: 1, name: 'Tienda Demo', slug: 'catalogohoy' };

// `routes`: handlers extra por pathname para la feature que se prueba, p. ej.
//   { '/rest/v1/mi_tabla': (route, req, url, db) => route.fulfill({ json: [] }) }
async function setupMock(page, { log = false, routes = {} } = {}) {
  const db = { tenant_expenses: [], expense_stages: [] };
  const unmatched = new Set();
  const session = { access_token: 'x.eyJzdWIiOiIwIn0.x', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 36000, user: USER };
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);

  await page.route(/^https:\/\/s3mock\.local\//, (r) => r.fulfill({ status: 200, body: '' }));
  await page.route(/^https:\/\/[^/]*(supabase\.co|api\.catalogohoy\.com|posthog|sentry|i\.posthog)/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const method = req.method();
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const send = (data, status = 200) => route.fulfill({ status, json: single && Array.isArray(data) ? (data[0] ?? null) : data });
    if (log) console.log(method, p + url.search);

    if (p.startsWith('/auth/v1/user')) return route.fulfill({ json: USER });
    if (p.startsWith('/auth/v1/token')) return route.fulfill({ json: session });
    if (p === '/rest/v1/users') return send([{ id: 1, name: 'Demo', email: USER.email }]);
    if (p === '/rest/v1/users_tenants') return send([{ tenant_id: 1, is_default: true, role: 'owner', tenants: TENANT }]);
    if (p === '/rest/v1/tenants') return send([{ ...TENANT, plan: 'pro', country_code: 'VE' }]);
    if (p === '/rest/v1/rpc/get_my_profile_with_tenants') return route.fulfill({ json: { user: { id: 1, name: 'Demo', email: USER.email }, tenants: [{ ...TENANT, role: 'owner', is_default: true }] } });
    if (p === '/rest/v1/rpc/get_my_team_permissions') return route.fulfill({ json: [{ module: '', action: '', is_member: false, is_owner: true }] });
    if (p === '/rest/v1/rpc/tenant_exists_by_slug') return route.fulfill({ json: true });
    if (p === '/rest/v1/tenant_currency_config') return send([{ product_currency: 'VES', display_currency: 'USD', show_dual_currency: true, currency_symbol: 'Bs' }]);
    if (p === '/functions/v1/storage-sign-upload') {
      const body = JSON.parse(req.postData() || '{}');
      return route.fulfill({ json: { uploadUrl: 'https://s3mock.local/put', publicUrl: `https://cdn.catalogohoy.com/invoices/1/${body.fileName}`, headers: { 'content-type': body.contentType } } });
    }
    if (routes[p]) return routes[p](route, req, url, db, single);
    if (p === '/rest/v1/tenant_expenses') return expenses(route, req, url, db, single);
    if (p === '/rest/v1/expense_stages') return stages(route, req, url, db, single);

    unmatched.add(`${method} ${p}`);
    if (p.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
    return send([]);
  });
  return { db, unmatched };
}

function expenses(route, req, url, db, single) {
  const m = req.method();
  const q = url.searchParams;
  const id = q.get('id')?.replace('eq.', '');
  const reply = (data) => route.fulfill({ json: single ? data[0] ?? null : data });
  if (m === 'GET') {
    const gte = q.get('issue_date')?.replace('gte.', '');
    const lt = q.getAll('issue_date').find((v) => v.startsWith('lt.'))?.replace('lt.', '');
    const from = q.getAll('issue_date').find((v) => v.startsWith('gte.'))?.replace('gte.', '') ?? gte;
    return reply(db.tenant_expenses.filter((e) => (!from || e.issue_date >= from) && (!lt || e.issue_date < lt)).sort((a, b) => b.issue_date.localeCompare(a.issue_date)));
  }
  if (m === 'POST') {
    const row = { id: `exp-${db.tenant_expenses.length + 1}-${Date.now()}`, created_at: new Date().toISOString(), ...JSON.parse(req.postData()) };
    db.tenant_expenses.push(row);
    return reply([row]);
  }
  if (m === 'PATCH') {
    const row = db.tenant_expenses.find((e) => e.id === id);
    Object.assign(row, JSON.parse(req.postData()));
    return reply([row]);
  }
  if (m === 'DELETE') {
    db.tenant_expenses = db.tenant_expenses.filter((e) => e.id !== id);
    return route.fulfill({ status: 204, body: '' });
  }
  return route.fulfill({ json: [] });
}

// Estados de gastos (`expense_stages`) en memoria.
function stages(route, req, url, db, single) {
  const m = req.method();
  const q = url.searchParams;
  const reply = (data) => route.fulfill({ json: single ? data[0] ?? null : data });
  if (m === 'GET') return reply([...db.expense_stages].sort((a, b) => a.position - b.position));
  if (m === 'POST') {
    const row = { id: `stg-${db.expense_stages.length + 1}`, created_at: new Date().toISOString(), is_hidden: false, ...JSON.parse(req.postData()) };
    db.expense_stages.push(row);
    return reply([row]);
  }
  if (m === 'PATCH') {
    const id = q.get('id')?.replace('eq.', '');
    const row = db.expense_stages.find((e) => e.id === id);
    if (row) Object.assign(row, JSON.parse(req.postData()));
    return reply(row ? [row] : []);
  }
  if (m === 'DELETE') {
    const ids = (q.get('id') || '').replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/"/g, ''));
    db.expense_stages = db.expense_stages.filter((e) => !ids.includes(e.id));
    for (const e of db.tenant_expenses) if (ids.includes(e.stage_id)) e.stage_id = null;
    return route.fulfill({ status: 204, body: '' });
  }
  return route.fulfill({ json: [] });
}

module.exports = { setupMock, USER, TENANT };
