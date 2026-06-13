/** Flag emoji from an ISO-3166 alpha-2 code (regional indicator symbols). */
const flagFromCode = (cc: string): string => {
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(
    ...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
};

const regionNamer = new Intl.DisplayNames(['es'], { type: 'region' });

/** "MX" → "🇲🇽 México". Falls back to the code, or "—" when missing. */
export const countryLabel = (code: string | null | undefined): string => {
  const cc = (code ?? '').trim().toUpperCase();
  if (!cc) return '—';
  let name = cc;
  try {
    name = regionNamer.of(cc) ?? cc;
  } catch {
    /* invalid code — keep the raw code */
  }
  const flag = flagFromCode(cc);
  return flag ? `${flag} ${name}` : name;
};
