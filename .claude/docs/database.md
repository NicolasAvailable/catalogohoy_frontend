# Supabase Database Schema

Source of truth extracted directly from Supabase table definitions.
All queries use `@supabase/supabase-js` via `inject(SupabaseClientProvider).client`.

---

## Entity Relationship Overview

```
tenants (slug → unique)
  ├── tenant_ecommerce_config  (tenant_id → tenants.id)
  ├── tenant_currency_config   (tenant_id → tenants.id)
  ├── tenant_business_hours    (tenant_id → tenants.id)
  ├── categories               (tenant_id → tenants.id, auth_user_id → users.auth_user_id)
  ├── products                 (tenant_id → tenants.id, auth_user_id → users.auth_user_id)
  │     └── product_categories (product_id + category_id  junction)
  ├── orders                   (tenant_id → tenants.id)
  ├── whatsapp_accounts        (tenant_id → tenants.id)
  └── users_tenants            (tenant_id + user_id  junction, role, is_default)
        └── users              (auth_user_id → Supabase auth.users.id)

exchange_rates                 (singleton id=1 · UNRESTRICTED · no RLS)
```

---

## Tables

### `tenants`

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | — | PK |
| name | text | NULL | Display name |
| slug | text | NULL | **Unique** — primary storefront filter |
| country_code | text | `'VE'` | ISO country code |
| created_at | timestamp | `now()` | |
| updated_at | timestamp | `now()` | |

**RLS:** Enabled

| Policy | Command | Roles | USING (qual) | WITH CHECK |
| --- | --- | --- | --- | --- |
| Lectura pública de tenants | SELECT | public | `true` | — |
| public can read tenant slugs | SELECT | public | `true` | — |
| tenant_update | UPDATE | public | `true` | `true` |

**Storefront lookup:**
```typescript
await supabase.from('tenants').select('id, name').eq('slug', slug).single();
```

---

### `tenant_slug_changes` (2026-07-08)

Historial de cambios de slug (auditoría + rate limit). Solo la RPC
`change_tenant_slug` escribe (security definer); RLS SELECT para miembros del
tenant (vía `users_tenants` + `users.auth_user_id`).

| Column | Type | Notes |
| --- | --- | --- |
| id | int8 | PK identity |
| tenant_id | int8 | FK → tenants (cascade) |
| old_slug / new_slug | text | |
| changed_by | uuid | auth.uid() del owner |
| changed_at | timestamptz | default now() |

**RPC `change_tenant_slug(p_tenant_id, p_new_slug)`** → jsonb `{slug, remaining}`.
Valida: sesión, rol `owner`, formato `^[a-z0-9]+(-[a-z0-9]+)*$` (3–40), lista de
subdominios reservados (www/api/auth/admin/…), unicidad, y **máx
`coalesce(tenants.slug_change_limit, 2)` cambios por 30 días rodantes** (override
por tenant; el demo tenant 6 tiene 100). Errores por `raise exception`: `not_authorized`,
`invalid_slug`, `reserved_slug`, `same_slug`, `slug_taken`, `limit_reached`.
Solo `authenticated` puede ejecutarla. Migraciones: `20260708_tenant_slug_change.sql` + `20260708_tenant_slug_change_limit_override.sql` (columna `tenants.slug_change_limit`).

---

### `users`

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | — | PK |
| name | text | NULL | |
| last_name | text | NULL | |
| email | text | NULL | Unique |
| phone | text | NULL | |
| timezone | text | `'America/Caracas'` | |
| country_code | text | `'VE'` | |
| auth_user_id | uuid | `gen_random_uuid()` | **Unique** — links to `supabase.auth.users.id` |
| created_at | timestamp | `now()` | |
| updated_at | timestamp | `now()` | |

**RLS:** Enabled

| Policy | Command | Roles | USING (qual) | WITH CHECK |
| --- | --- | --- | --- | --- |
| users read own row | SELECT | public | `auth.uid() = auth_user_id` | — |
| auth hook can insert users | INSERT | supabase_auth_admin | — | `true` |
| user can update own profile | UPDATE | public | `auth_user_id = auth.uid()` | `auth_user_id = auth.uid()` |
| users can update own profile | UPDATE | public | `auth_user_id = auth.uid()` | `auth_user_id = auth.uid()` |
| users can update their own profile | UPDATE | public | `auth.uid() = auth_user_id` | `auth.uid() = auth_user_id` |
| users update own row | UPDATE | public | `auth.uid() = auth_user_id` | `auth.uid() = auth_user_id` |

> **Note:** There are 4 duplicate UPDATE policies — consider consolidating into one.

**Lookup by auth session:**
```typescript
const { data: { user } } = await supabase.auth.getUser(); // user.id = UUID
await supabase.from('users').select('id').eq('auth_user_id', user.id).maybeSingle();
```

---

### `users_tenants`

Junction table — links users to the tenants they manage.

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | — | PK |
| user_id | int8 | NULL | FK → users.id |
| tenant_id | int8 | NULL | FK → tenants.id |
| role | text | NULL | e.g. `'owner'`, `'admin'`, `'member'` |
| is_default | bool | `false` | Primary tenant for this user |
| created_at | timestamp | `now()` | |
| updated_at | timestamp | `now()` | |

**RLS:** Enabled — **No policies defined**

> **Warning:** RLS is ON but there are zero policies, so all access is **denied** by default. Reads work only through joins from tables that already passed their own RLS checks, or via service-role key.

**Get active tenant for logged-in user:**
```typescript
// Preferred: default tenant
await supabase.from('users_tenants')
  .select('tenant_id, tenants(id, name, slug)')
  .eq('user_id', userData.id)
  .eq('is_default', true)
  .maybeSingle();

// Fallback: first tenant
await supabase.from('users_tenants')
  .select('tenant_id, tenants(id, name, slug)')
  .eq('user_id', userData.id)
  .limit(1).maybeSingle();
```

---

### `categories`

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | — | PK |
| name | text | NULL | Unique |
| description | varchar | NULL | |
| position | numeric | NULL | Display order |
| is_visible | bool | `true` | |
| auth_user_id | uuid | `gen_random_uuid()` | FK → users.auth_user_id |
| tenant_id | int8 | NULL | FK → tenants.id |
| created_at | timestamp | `now()` | |
| updated_at | timestamp | `now()` | |

**RLS:** Enabled

| Policy | Command | Roles | USING (qual) | WITH CHECK |
| --- | --- | --- | --- | --- |
| Lectura pública de categorías | SELECT | public | `true` | — |
| Users can view own categories | SELECT | public | `auth.uid() = auth_user_id` | — |
| Users can insert own categories | INSERT | public | — | `auth.uid() = auth_user_id` |
| Users can update own categories | UPDATE | public | `auth.uid() = auth_user_id` | — |
| Users can delete own categories | DELETE | public | `auth.uid() = auth_user_id` | — |

**Admin query (by auth user, ordered by position):**
```typescript
await supabase.from('categories')
  .select('*')
  .eq('auth_user_id', user.id)
  .order('position', { ascending: true });
```

**Storefront query (visible only):**
```typescript
await supabase.from('categories')
  .select('id, name')
  .eq('tenant_id', tenant.id)
  .eq('is_visible', true)
  .order('position', { ascending: true });
```

**Reorder (bulk update):**
```typescript
await Promise.all(
  categories.map((cat, index) =>
    supabase.from('categories').update({ position: index }).eq('id', cat.id)
  )
);
```

---

### `products`

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | — | PK |
| name | text | NULL | |
| description | varchar | NULL | |
| price | numeric | NULL | |
| price_promotional | numeric | NULL | |
| production_cost | numeric | NULL | Cost of production |
| photos | text[] | NULL | PostgreSQL text array (`text[]`) |
| stock | numeric | NULL | |
| sku | text | NULL | Unique product code (optional) |
| auth_user_id | uuid | `gen_random_uuid()` | FK → users.auth_user_id |
| tenant_id | int8 | NULL | FK → tenants.id |
| created_at | timestamp | `now()` | |
| position | int4 | NULL | Orden manual en el catálogo |
| is_hidden | bool | `false` | Oculto del storefront (el sitemap dinámico `api/sitemap.ts` lo excluye) |
| is_sold_out | bool | — | Agotado (se sigue mostrando) |
| is_wholesale / wholesale_tiers | bool / jsonb | — | Precios de mayoreo |
| is_sized / sizes | bool / jsonb | — | Tallas |
| is_variant / variants | bool / jsonb | — | Variantes |
| search_blob | text | NULL | Texto plano para búsqueda |

**RLS:** Enabled

| Policy | Command | Roles | USING (qual) | WITH CHECK |
| --- | --- | --- | --- | --- |
| Lectura pública de productos | SELECT | public | `true` | — |
| Users can view their own products | SELECT | authenticated | `auth.uid() = auth_user_id` | — |
| Users can insert their own products | INSERT | authenticated | — | `auth.uid() = auth_user_id` |
| Users can update their own products | UPDATE | authenticated | `auth.uid() = auth_user_id` | `auth.uid() = auth_user_id` |
| Users can delete their own products | DELETE | authenticated | `auth.uid() = auth_user_id` | — |

**Join with categories (storefront):**
```typescript
await supabase.from('products')
  .select('*, product_categories(categories(*))')
  .eq('tenant_id', tenant.id);
```

**Search + sort (storefront):**
```typescript
let q = supabase.from('products')
  .select('*, product_categories(categories(*))')
  .eq('tenant_id', tenant.id);

if (search) q = q.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
if (orderBy === 'price_asc')  q = q.order('price', { ascending: true });
if (orderBy === 'price_desc') q = q.order('price', { ascending: false });
if (orderBy === 'name_asc')   q = q.order('name',  { ascending: true });
```

---

### `product_categories`

Junction table — many-to-many between products and categories.

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | `nextval(...)` | PK (auto-sequence) |
| product_id | int8 | NULL | FK → products.id |
| category_id | int8 | NULL | FK → categories.id |
| position | int4 | `0` | |
| created_at | timestamp | `now()` | |

**RLS:** Enabled

| Policy | Command | Roles | USING (qual) | WITH CHECK |
| --- | --- | --- | --- | --- |
| Authenticated users can read product categories | SELECT | authenticated | `true` | — |
| Authenticated users can insert product categories | INSERT | authenticated | — | `true` |
| Authenticated users can update product categories | UPDATE | authenticated | `true` | `true` |
| Authenticated users can delete product categories | DELETE | authenticated | `true` | — |

> **Note:** Only `authenticated` role has access. Anonymous/public users cannot read `product_categories` directly — storefront reads products with nested joins which rely on the `products` table's public SELECT policy.

**Insert after product create/update:**
```typescript
await Promise.all(
  categoryIds.map((category_id) =>
    supabase.from('product_categories').insert({ product_id, category_id })
  )
);
```

---

### `orders`

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | — | PK (ALWAYS generated) |
| tenant_id | int8 | NULL | FK → tenants.id |
| name | text | NULL | Customer name |
| phone | text | NULL | |
| comments | text | NULL | |
| status | text | `'pending'` | `'pending'` \| `'completed'` |
| products | jsonb | `'[]'::jsonb` | **Embedded order lines** — see `OrderItem` below |
| total_usd | numeric | `0` | |
| total_bs | numeric | `0` | Venezuelan bolivares |
| created_at | timestamp | `timezone('utc')` | |
| updated_at | timestamp | `timezone('utc')` | |

**RLS:** Enabled

| Policy | Command | Roles | USING (qual) | WITH CHECK |
| --- | --- | --- | --- | --- |
| lectura_publica | SELECT | anon, authenticated | `true` | — |
| creacion_publica | INSERT | anon, authenticated | — | `true` |
| Allow update orders for authenticated users | UPDATE | authenticated | `true` | `true` |

> **Note:** No DELETE policy — orders cannot be deleted via client.

**`OrderItem` shape (stored in `products` JSONB column):**
```typescript
interface OrderItem {
  productId: string | number;
  name: string;
  price: number;
  quantity: number;
  total: number;
  photo?: string;
}
```

**List with date + search filters:**
```typescript
let q = supabase.from('orders')
  .select('*')
  .eq('tenant_id', tenantId)
  .order('created_at', { ascending: false });

if (date)   q = q.gte('created_at', startOfDay).lt('created_at', endOfDay);
if (search) q = q.ilike('name', `%${search}%`);
```

---

### `tenant_ecommerce_config`

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | — | PK |
| tenant_id | int8 | NULL | FK → tenants.id (**Unique**) |
| whatsapp_buttons | jsonb | `'[]'` | Array of `{ name, number }` — max 3 WhatsApp sales contacts |
| logo | text | NULL | URL |
| banner | text | NULL | URL |
| description | text | NULL | |
| is_accepting_orders | bool | `true` | |
| is_visible | bool | `true` | Storefront publicly visible |
| currency | text | `'USD'` | |
| currency_symbol | text | `'$'` | |
| created_at | timestamp | `now()` | |
| updated_at | timestamp | `now()` | |

**RLS:** Enabled

| Policy | Command | Roles | USING (qual) | WITH CHECK |
| --- | --- | --- | --- | --- |
| Lectura pública de configuración e-commerce | SELECT | public | `true` | — |
| tenant_ecommerce_config_select | SELECT | authenticated | `tenant_id IN (SELECT ut.tenant_id FROM users_tenants ut JOIN users u ON u.id = ut.user_id WHERE u.auth_user_id = auth.uid())` | — |
| Usuarios pueden crear config de su tenant | INSERT | authenticated | — | `EXISTS(users_tenants check via auth.uid())` |
| tenant_ecommerce_config_insert | INSERT | authenticated | — | `tenant_id IN (SELECT ut.tenant_id ... WHERE u.auth_user_id = auth.uid())` |
| tenant_ecommerce_config_update | UPDATE | authenticated | `true` | `true` |
| Usuarios pueden eliminar config de su tenant | DELETE | authenticated | `EXISTS(users_tenants check via auth.uid())` | — |

> **Note:** Has duplicate INSERT policies and a permissive UPDATE that allows any authenticated user to update any config. Consider tightening.

**Upsert pattern:**
```typescript
const { data: existing } = await supabase.from('tenant_ecommerce_config')
  .select('id').eq('tenant_id', tenantId).maybeSingle();

if (existing) {
  await supabase.from('tenant_ecommerce_config')
    .update(payload).eq('tenant_id', tenantId).select('id');
} else {
  await supabase.from('tenant_ecommerce_config')
    .insert({ tenant_id: tenantId, ...payload }).select('id');
}
```

---

### `tenant_currency_config`

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | — | PK |
| tenant_id | int8 | NULL | FK → tenants.id (**Unique**) |
| product_currency | text | `'USD'` | Currency used for product prices |
| display_currency | text | `'USD'` | Currency shown to customers |
| exchange_rate_type | text | `'none'` | Rate source: `'none'`, `'bcv_usd'`, `'bcv_eur'`, `'custom'` |
| custom_rate | numeric | NULL | Manual exchange rate |
| show_dual_currency | bool | `false` | Show both currencies in storefront |
| currency_symbol | text | `'$'` | |
| decimal_separator | text | `','` | e.g. `,` (Venezuelan format) |
| thousand_separator | text | `'.'` | e.g. `.` (Venezuelan format) |
| created_at | timestamp | `now()` | |
| updated_at | timestamp | `now()` | |

**RLS:** Enabled

| Policy | Command | Roles | USING (qual) | WITH CHECK |
| --- | --- | --- | --- | --- |
| Lectura pública de config moneda | SELECT | public | `true` | — |
| Usuarios pueden crear config moneda de su tenant | INSERT | authenticated | — | `EXISTS(users_tenants check via auth.uid())` |
| Usuarios pueden modificar config moneda de su tenant | UPDATE | authenticated | `EXISTS(users_tenants check via auth.uid())` | `EXISTS(users_tenants check via auth.uid())` |
| Usuarios pueden eliminar config moneda de su tenant | DELETE | authenticated | `EXISTS(users_tenants check via auth.uid())` | — |

---

### `tenant_business_hours`

Description: *Horarios de apertura por día de la semana*

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | — | PK |
| tenant_id | int8 | NULL | FK → tenants.id |
| day_of_week | int2 | NULL | `0`=Sunday … `6`=Saturday (CHECK: 0–6) |
| open_time | time | `'08:00:00'` | |
| close_time | time | `'20:00:00'` | |
| is_open | bool | `true` | |
| created_at | timestamp | `now()` | |
| updated_at | timestamp | `now()` | |

**RLS:** Enabled

| Policy | Command | Roles | USING (qual) | WITH CHECK |
| --- | --- | --- | --- | --- |
| Lectura pública de horarios | SELECT | public | `true` | — |
| Usuarios pueden crear horarios de su tenant | INSERT | authenticated | — | `EXISTS(users_tenants check via auth.uid())` |
| Usuarios pueden modificar horarios de su tenant | UPDATE | authenticated | `EXISTS(users_tenants check via auth.uid())` | `EXISTS(users_tenants check via auth.uid())` |
| Usuarios pueden eliminar horarios de su tenant | DELETE | authenticated | `EXISTS(users_tenants check via auth.uid())` | — |

**Query today's hours:**
```typescript
const dayOfWeek = new Date().getDay(); // 0-6
await supabase.from('tenant_business_hours')
  .select('open_time, close_time, is_open')
  .eq('tenant_id', tenant.id)
  .eq('day_of_week', dayOfWeek)
  .single();
```

---

### `whatsapp_accounts`

WhatsApp Business API accounts per tenant. RLS: tenant member check via `users_tenants` join.

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | identity | PK |
| tenant_id | int8 | — | FK → tenants.id, ON DELETE CASCADE |
| phone_number | text | — | WhatsApp phone number |
| display_name | text | null | Business display name |
| waba_id | text | null | WhatsApp Business Account ID (Meta) |
| phone_number_id | text | null | Meta phone number ID |
| access_token | text | null | API access token (sensitive, excluded from frontend queries) |
| status | text | `'active'` | CHECK: `active` or `inactive` |
| created_at | timestamptz | `now()` | |
| updated_at | timestamptz | `now()` | |

**RLS Policies:** SELECT / INSERT / UPDATE / DELETE — all require authenticated user to be a tenant member.

### `social_accounts` (fundación omnicanal, 2026-07-22)

Cuentas conectadas de redes sociales por tenant — Instagram / TikTok / Messenger (WhatsApp se queda en `whatsapp_accounts` porque las funciones en prod dependen de ella). Migración `20260722_omnichannel_inbox_foundation.sql`, proyecto Linear "Bandeja omnicanal" (CAT-38..44).

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | identity | PK |
| tenant_id | int8 | — | FK → tenants.id, ON DELETE CASCADE |
| channel | text | — | CHECK: `instagram` / `tiktok` / `messenger` |
| external_account_id | text | — | IG user id / TikTok business id; UNIQUE (channel, external_account_id) |
| username / display_name | text | null | |
| access_token / refresh_token | text | null | ⚠️ IG vence a los 60 días → cron de refresh (CAT-40) |
| token_expires_at | timestamptz | null | |
| status | text | `'active'` | |
| metadata | jsonb | `{}` | |

**RLS + privilegios por columna:** SELECT solo para miembros del tenant y **sin** las columnas de tokens (`revoke all` + `grant select` de columnas públicas); las edge functions leen tokens con service role.

La bandeja también es omnicanal: `chats.channel` (default `'whatsapp'`), `chats.external_user_id` (IGSID/open_id — ruteo en redes sin teléfono) y `chats.customer_username`, con unique parcial `(tenant_id, channel, external_user_id)`.

**Frontend query pattern:**
```ts
this.client
  .from('whatsapp_accounts')
  .select('id, tenant_id, phone_number, display_name, waba_id, phone_number_id, status, created_at, updated_at')
  .eq('tenant_id', tenantId)
```

---

### `exchange_rates`

Singleton — always `id = 1`. **UNRESTRICTED** (no Row Level Security).

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | `1` | Always 1 (CHECK: id = 1) |
| bcv_usd | numeric | `0` | BCV official USD rate |
| bcv_eur | numeric | `0` | BCV official EUR rate |
| custom_rate | numeric | `0` | Manual override |
| active_rate | text | `'bcv_usd'` | `'bcv_usd'` \| `'bcv_eur'` \| `'custom'` |
| updated_at | timestamp | `now()` | |

**RLS:** Disabled

**Storefront — get active rate:**
```typescript
await supabase.from('exchange_rates')
  .select('bcv_usd, bcv_eur, custom_rate, active_rate')
  .order('updated_at', { ascending: false })
  .limit(1).single();
```

**Admin — update active rate:**
```typescript
await supabase.from('exchange_rates')
  .update({ active_rate: rateType, updated_at: new Date().toISOString() })
  .eq('id', 1);
```

---

### `enterprise_leads`

Leads del funnel "Contactar ventas" del plan Enterprise (2026-07-07). **RLS ON sin policies**
= anon/authenticated denegados; solo escribe/lee la edge function `enterprise-lead` (service role).

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | identity | |
| source | text | — | `'landing'` \| `'admin'` (CHECK) |
| tenant_slug | text | NULL | Solo cuando viene del admin |
| business_name / country / website | text | — | country/website opcionales |
| name / email / phone | text | — | Contacto (phone opcional) |
| products_range / orders_range | text | — | `lt_100\|100_500\|500_2000\|gt_2000` |
| catalogs_needed | text | — | `1\|2_3\|4_10\|gt_10` |
| team_size | text | — | `solo\|2_5\|6_15\|gt_15` |
| needs | text[] | `{}` | Whitelist de 8 necesidades |
| score / qualified | int / bool | — | Re-calculados server-side (≥4 = qualified) |
| status | text | `'new'` | `new\|contacted\|demo_scheduled\|won\|lost` (CHECK) |
| answers | jsonb | NULL | Payload crudo (future-proof) |

Índices: `created_at desc`, `status`.

RPCs admin (SECURITY DEFINER + `_assert_internal_admin`): `list_enterprise_leads_admin()`
y `update_enterprise_lead_status_admin(id, status)` — las usa el módulo "Leads Enterprise"
del panel interno (tabla con filtros, detalle expandible y pipeline de estado).

**RPCs con planes hardcodeados** (actualizados 2026-07-07 para incluir `'enterprise'`):
`assign_tenant_plan_admin` (2 overloads, valida `p_tier IN (...)`), `list_paying_clients_admin`
y `list_expired_clients_admin` (`plan_id IN (...)`), y el CASE de créditos IA en
`ensure_ai_credits` / `reset_due_ai_credits` / `sync_ai_credits_on_plan_change`
(`WHEN 'enterprise' THEN 2000`). Si se agrega otro plan pago, tocar TODOS estos.

**`list_paying_clients_admin`** (2026-07-09): devuelve también `stripe_subscription_status`
para que "Catálogos activos" del panel interno muestre el estado **"En gracia"**
(`past_due` = la renovación ya extendió `plan_expires_at` — el webhook lo trata como
válido — pero Stripe sigue reintentando el cobro; por fechas solas parecerían activos).

**`list_expired_clients_admin`** (2026-07-10): histórico completo de vencidos para el tab
"Vencidos" — todos los que tuvieron plan pago y hoy no tienen uno vigente. Une (A) plan_id
pago con `plan_expires_at` pasado (sin degradar aún, excluye `past_due`) y (B) degradados
a gratis con historial en `tenant_subscriptions` o `previous_plan_id` (al degradar se
nullea `plan_expires_at`, así que tier/ciclo/fechas salen de la última suscripción).
Excluye checkouts que nunca pagaron (`incomplete_expired` sin historial). Mismo shape que
`list_paying_clients_admin`; el filtro por rango de fechas se hace client-side en la UI.

### `business_expenses`

Gastos del negocio (2026-07-09): suscripciones/servicios que paga la empresa (Supabase,
Vercel, Google Workspace, …), administrados desde la sección "Gastos" del panel interno.
**RLS ON sin policies** = acceso solo vía RPCs.

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | int8 | identity | |
| name / company | text | — | Nombre del servicio y de la empresa |
| amount_usd | numeric(10,2) | — | CHECK ≥ 0 |
| period | text | `'monthly'` | `monthly\|yearly` (CHECK) |
| created_at / updated_at | timestamptz | `now()` | |

RPCs admin (SECURITY DEFINER + `_assert_internal_admin`): `list_business_expenses_admin()`,
`save_business_expense_admin(id, name, company, amount_usd, period)` (id NULL = insert) y
`delete_business_expense_admin(id)`. El panel normaliza totales (anual/12 para el mensual).

---

## RLS Summary

| Table | RLS | Public SELECT | Auth INSERT | Auth UPDATE | Auth DELETE | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| tenants | ON | `true` | — | `true` (public!) | — | UPDATE too permissive |
| users | ON | own row | auth_admin only | own row | — | 4 duplicate UPDATE policies |
| users_tenants | ON | **none** | **none** | **none** | **none** | No policies = all denied |
| categories | ON | `true` | own (`auth_user_id`) | own | own | |
| products | ON | `true` | own (`auth_user_id`) | own | own | |
| product_categories | ON | authenticated only | authenticated | authenticated | authenticated | No anon/public read |
| orders | ON | anon + auth | anon + auth | authenticated | — | No DELETE |
| tenant_ecommerce_config | ON | `true` | tenant member | any auth (!) | tenant member | UPDATE too permissive |
| tenant_currency_config | ON | `true` | tenant member | tenant member | tenant member | |
| tenant_business_hours | ON | `true` | tenant member | tenant member | tenant member | |
| exchange_rates | OFF | — | — | — | — | Singleton, no RLS |
| enterprise_leads | ON | **none** | **none** | **none** | **none** | Solo service role (edge fn `enterprise-lead`) |

**"Tenant member" check pattern:**
```sql
EXISTS (
  SELECT 1 FROM users_tenants ut
  WHERE ut.tenant_id = <table>.tenant_id
    AND ut.user_id = (SELECT users.id FROM users WHERE users.auth_user_id = auth.uid())
)
```

---

## Auth Flow

```text
supabase.auth.getUser()
  └── user.id (UUID)
        └── users.auth_user_id
              └── users.id
                    └── users_tenants.user_id
                          └── users_tenants.tenant_id → tenants
```

- Supabase auth UUID ≠ `users.id` — always join via `auth_user_id`
- Default tenant: `users_tenants.is_default = true`
- Fallback: first row in `users_tenants` for that user

## Defaults & Conventions

| Convention | Value |
| --- | --- |
| Default country | `VE` (Venezuela) |
| Default timezone | `America/Caracas` |
| Default currency | `USD` |
| Decimal separator | `,` (Venezuelan format) |
| Thousand separator | `.` (Venezuelan format) |
| Default order status | `pending` |
| Default exchange rate | `bcv_usd` |
| Business hours open | `08:00 – 20:00` |
