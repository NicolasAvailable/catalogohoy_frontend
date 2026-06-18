// Internal-only edge function to manage Stripe coupons + promotion codes from
// the company admin (apps/internal). The Stripe secret key never leaves the
// server. Restricted to internal admins via an email allowlist.
//
// Actions (POST body { action, ... }):
//   list_products  -> products + their prices (for the form dropdowns)
//   list_coupons   -> active coupons + their promotion codes
//   create         -> create a coupon (+ optional promotion code)
//   deactivate     -> deactivate a promotion code (active=false)
//
// Env required:
//   STRIPE_SECRET_KEY        Stripe secret (live or test)
//   INTERNAL_ADMIN_EMAILS    comma-separated allowlist of admin emails
//   SUPABASE_URL / SUPABASE_ANON_KEY (auto-provided) — to verify the caller

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE = 'https://api.stripe.com/v1';
const SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const ADMIN_EMAILS = (Deno.env.get('INTERNAL_ADMIN_EMAILS') ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

/** Flattens nested params into Stripe's form-encoded bracket notation. */
function encodeForm(obj: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const k = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (v !== null && typeof v === 'object') {
          parts.push(encodeForm(v as Record<string, unknown>, `${k}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${k}[${i}]`)}=${encodeURIComponent(String(v))}`);
        }
      });
    } else if (typeof value === 'object') {
      parts.push(encodeForm(value as Record<string, unknown>, k));
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join('&');
}

async function stripe(
  method: 'GET' | 'POST',
  path: string,
  params?: Record<string, unknown>
): Promise<any> {
  const url = method === 'GET' && params
    ? `${STRIPE}${path}?${encodeForm(params)}`
    : `${STRIPE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'POST' && params ? encodeForm(params) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Stripe error (${res.status})`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!SECRET) return json({ error: 'STRIPE_SECRET_KEY not configured' }, 500);

    // --- Auth: must be an authenticated internal admin -----------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email?.toLowerCase() ?? '';
    if (!email || (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email))) {
      return json({ error: 'No autorizado' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // --- list_products -------------------------------------------------------
    if (action === 'list_products') {
      const products = await stripe('GET', '/products', { active: true, limit: 100 });
      const result = [];
      for (const p of products.data) {
        const prices = await stripe('GET', '/prices', {
          product: p.id,
          active: true,
          limit: 100,
        });
        result.push({
          id: p.id,
          name: p.name,
          planId: p.metadata?.plan_id ?? null,
          prices: prices.data.map((pr: any) => ({
            id: pr.id,
            nickname: pr.nickname,
            unitAmount: pr.unit_amount,
            currency: pr.currency,
            interval: pr.recurring?.interval ?? null,
            intervalCount: pr.recurring?.interval_count ?? null,
          })),
        });
      }
      return json({ products: result });
    }

    // --- list_coupons --------------------------------------------------------
    if (action === 'list_coupons') {
      const codes = await stripe('GET', '/promotion_codes', { limit: 100 });
      return json({
        promotionCodes: codes.data.map((c: any) => ({
          id: c.id,
          code: c.code,
          active: c.active,
          timesRedeemed: c.times_redeemed,
          maxRedemptions: c.max_redemptions,
          expiresAt: c.expires_at,
          minimumAmount: c.restrictions?.minimum_amount ?? null,
          coupon: {
            id: c.coupon?.id,
            name: c.coupon?.name,
            percentOff: c.coupon?.percent_off,
            amountOff: c.coupon?.amount_off,
            duration: c.coupon?.duration,
            durationInMonths: c.coupon?.duration_in_months,
          },
        })),
      });
    }

    // --- create --------------------------------------------------------------
    if (action === 'create') {
      const {
        productId,
        percentOff,
        amountOff,
        duration = 'once',
        durationInMonths,
        name,
        code,
        minimumAmount,
        maxRedemptions,
        expiresAt,
      } = body;

      if (!productId) return json({ error: 'Falta el producto' }, 400);
      if (!percentOff && !amountOff)
        return json({ error: 'Indicá un % o un monto de descuento' }, 400);

      const couponParams: Record<string, unknown> = {
        duration,
        name: name || undefined,
        applies_to: { products: [productId] },
      };
      if (percentOff) couponParams.percent_off = percentOff;
      if (amountOff) {
        couponParams.amount_off = amountOff;
        couponParams.currency = 'usd';
      }
      if (duration === 'repeating' && durationInMonths)
        couponParams.duration_in_months = durationInMonths;

      const coupon = await stripe('POST', '/coupons', couponParams);

      let promotionCode = null;
      if (code) {
        const promoParams: Record<string, unknown> = {
          promotion: { type: 'coupon', coupon: coupon.id },
          code,
        };
        if (maxRedemptions) promoParams.max_redemptions = maxRedemptions;
        if (expiresAt) promoParams.expires_at = expiresAt;
        if (minimumAmount) {
          promoParams.restrictions = {
            minimum_amount: minimumAmount,
            minimum_amount_currency: 'usd',
          };
        }
        promotionCode = await stripe('POST', '/promotion_codes', promoParams);
      }

      return json({ coupon, promotionCode });
    }

    // --- deactivate ----------------------------------------------------------
    if (action === 'deactivate') {
      const { promotionCodeId } = body;
      if (!promotionCodeId)
        return json({ error: 'Falta el id del código' }, 400);
      const updated = await stripe(
        'POST',
        `/promotion_codes/${promotionCodeId}`,
        { active: false }
      );
      return json({ promotionCode: updated });
    }

    return json({ error: 'Acción desconocida' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
