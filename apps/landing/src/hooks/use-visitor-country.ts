import { useEffect, useState } from "react";

/**
 * Detecta el código de país (ISO-3166 alpha-2, p.ej. "VE", "AR", "US") del
 * visitante a partir de su IP pública. Si el visitante está conectado por VPN,
 * la API verá la IP del exit-node de la VPN — así que efectivamente "VE con
 * VPN apuntando a US" devuelve "US", que es exactamente lo que queremos para
 * mostrar/ocultar la referencia a Bs. / BCV en la landing.
 *
 * Estrategia:
 *  1. Caché en localStorage por 24h para no martillar la API en cada visita.
 *  2. API primaria: api.country.is (sin auth, free, sin rate-limit publicado).
 *  3. Fail-safe: si todo falla, devolvemos null → el caller debe ocultar el
 *     contenido VE-only.
 */
const STORAGE_KEY = "chy_visitor_country";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CachedCountry {
  country: string | null;
  expiresAt: number;
}

function readCache(): string | null | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CachedCountry;
    if (parsed.expiresAt < Date.now()) return undefined;
    return parsed.country;
  } catch {
    return undefined;
  }
}

function writeCache(country: string | null): void {
  try {
    const payload: CachedCountry = {
      country,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* localStorage puede estar deshabilitado (modo incógnito estricto) */
  }
}

export function useVisitorCountry(): {
  country: string | null;
  isLoading: boolean;
} {
  const cached = readCache();
  const [country, setCountry] = useState<string | null>(
    cached === undefined ? null : cached
  );
  const [isLoading, setIsLoading] = useState<boolean>(cached === undefined);

  useEffect(() => {
    if (cached !== undefined) return;

    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    fetch("https://api.country.is/", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { country?: string } | null) => {
        if (cancelled) return;
        const c = data?.country?.toUpperCase() ?? null;
        setCountry(c);
        writeCache(c);
      })
      .catch(() => {
        if (cancelled) return;
        setCountry(null);
        writeCache(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
        clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [cached]);

  return { country, isLoading };
}

export function isVenezuela(country: string | null): boolean {
  return country === "VE";
}
