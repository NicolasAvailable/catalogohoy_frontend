-- ============================================================================
-- Sistema propio de tasas BCV
-- ----------------------------------------------------------------------------
-- Replace the third-party aggregator (ve.dolarapi.com) with a scraper that
-- reads the official USD/EUR rates directly from the BCV homepage
-- (https://www.bcv.org.ve/). This gives us control over latency, format and
-- availability of the data instead of depending on the aggregator.
--
-- Wiring is unchanged: the existing pg_cron job (every 4h) calls
-- public.fetch_bcv_rates(), which inserts into public.bcv_rates; the bcv-rates
-- edge function and the frontend keep reading from that table.
--
-- Notes:
--   * BCV's TLS certificate is frequently invalid, so we disable curl's TLS
--     verification for this request (CURLOPT_SSL_VERIFY*).
--   * The page lists both rates, so a single GET replaces the two dolarapi
--     calls. Numbers use the Venezuelan format ('.' thousands, ',' decimal).
--   * ve.dolarapi.com is kept as a *fallback* only — used if the BCV scrape
--     fails or the markup can't be parsed — so a BCV outage / markup change
--     never leaves tenants without a rate update. Remove the fallback block
--     once the direct scrape has proven stable in production.
--
-- Validated against production via BEGIN/ROLLBACK dry-run: scraped values match
-- both the latest stored row and dolarapi exactly (USD 582.6862, EUR 671.4235).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fetch_bcv_rates()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  bcv_response extensions.http_response;
  html text;
  usd_raw text;
  eur_raw text;
  fecha_iso text;
  usd_oficial numeric;
  eur_oficial numeric;
  -- dolarapi fallback
  usd_response extensions.http_response;
  eur_response extensions.http_response;
BEGIN
  -- BCV's TLS cert is frequently invalid; skip verification + set UA/timeout.
  PERFORM extensions.http_set_curlopt('CURLOPT_SSL_VERIFYPEER', '0');
  PERFORM extensions.http_set_curlopt('CURLOPT_SSL_VERIFYHOST', '0');
  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT', '20');
  PERFORM extensions.http_set_curlopt('CURLOPT_USERAGENT',
    'Mozilla/5.0 (compatible; CatalogoHoyBot/1.0; +https://catalogohoy.com)');

  -- ============================================================
  -- PRIMARY SOURCE: bcv.org.ve (official, scraped directly)
  -- The homepage embeds both rates:
  --   <div id="dolar"> ... <strong class="strong-tb">582,68620000</strong>
  --   <div id="euro">  ... <strong class="strong-tb">671,42348139</strong>
  -- and the valuation date in the date-display-single `content` attribute.
  -- ============================================================
  BEGIN
    SELECT * INTO bcv_response FROM extensions.http_get('https://www.bcv.org.ve/');

    IF bcv_response.status = 200 THEN
      html := bcv_response.content;

      usd_raw := (regexp_match(
        substr(html, position('id="dolar"' in html), 600),
        '<strong[^>]*>\s*([0-9.,]+)\s*</strong>'))[1];
      eur_raw := (regexp_match(
        substr(html, position('id="euro"' in html), 600),
        '<strong[^>]*>\s*([0-9.,]+)\s*</strong>'))[1];
      fecha_iso := (regexp_match(
        html, 'date-display-single"[^>]*content="([^"]+)"'))[1];

      IF usd_raw IS NOT NULL AND eur_raw IS NOT NULL THEN
        -- Venezuelan number format: '.' = thousands, ',' = decimal.
        usd_oficial := replace(replace(usd_raw, '.', ''), ',', '.')::numeric;
        eur_oficial := replace(replace(eur_raw, '.', ''), ',', '.')::numeric;
      ELSE
        RAISE WARNING 'BCV markup parse failed (usd_raw=%, eur_raw=%)', usd_raw, eur_raw;
      END IF;
    ELSE
      RAISE WARNING 'BCV request failed: status=%', bcv_response.status;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'BCV scrape error: %', SQLERRM;
  END;

  -- ============================================================
  -- FALLBACK: ve.dolarapi.com — only when the BCV scrape yielded no rates.
  -- ============================================================
  IF usd_oficial IS NULL OR eur_oficial IS NULL THEN
    RAISE WARNING 'BCV unavailable, falling back to ve.dolarapi.com';

    SELECT * INTO usd_response FROM extensions.http_get('https://ve.dolarapi.com/v1/dolares');
    SELECT * INTO eur_response FROM extensions.http_get('https://ve.dolarapi.com/v1/euros');

    IF usd_response.status = 200 AND eur_response.status = 200 THEN
      SELECT (elem->>'promedio')::numeric, elem->>'fechaActualizacion'
      INTO usd_oficial, fecha_iso
      FROM jsonb_array_elements(usd_response.content::jsonb) AS elem
      WHERE elem->>'fuente' = 'oficial';

      SELECT (elem->>'promedio')::numeric
      INTO eur_oficial
      FROM jsonb_array_elements(eur_response.content::jsonb) AS elem
      WHERE elem->>'fuente' = 'oficial';
    END IF;
  END IF;

  IF usd_oficial IS NULL OR eur_oficial IS NULL THEN
    RAISE WARNING 'Could not obtain BCV rates from any source';
    RETURN;
  END IF;

  -- Only insert if the rate changed vs the latest stored record.
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT usd, eur FROM public.bcv_rates ORDER BY fetched_at DESC LIMIT 1
    ) latest
    WHERE latest.usd = usd_oficial AND latest.eur = eur_oficial
  ) THEN
    INSERT INTO public.bcv_rates (usd, eur, fecha_bcv)
    VALUES (usd_oficial, eur_oficial, coalesce(fecha_iso, now()::text));
  END IF;

  -- Keep only the last 90 days of records.
  DELETE FROM public.bcv_rates
  WHERE fetched_at < now() - interval '90 days';
END;
$function$;
