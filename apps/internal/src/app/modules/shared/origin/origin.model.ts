/** Canal por el que el catálogo paga su plan hoy. */
export type PaySource = 'app_store' | 'play_store' | 'stripe' | 'manual';

/** Plataforma desde la que se registró el dueño (solo se guarda desde 2025-12-10). */
export type SignupPlatform = 'ios' | 'android' | 'web';

export interface TenantOrigin {
  tenantId: number;
  paySource: PaySource | null;
  payStatus: string | null;
  manualPaymentMethod: string | null;
  signupPlatform: SignupPlatform | null;
  signupProvider: string | null;
  signupSource: string | null;
  signupMedium: string | null;
  signupCampaign: string | null;
  ownerSignupAt: string | null;
  referredByTenantId: number | null;
  referredByName: string | null;
}

export const PAY_SOURCE_LABEL: Record<PaySource, string> = {
  app_store: 'App Store',
  play_store: 'Play Store',
  stripe: 'Web (Stripe)',
  manual: 'Manual',
};

export const PAY_SOURCE_ICON: Record<PaySource, string> = {
  app_store: 'smartphone',
  play_store: 'smartphone',
  stripe: 'globe',
  manual: 'hand-coins',
};

export const PAY_SOURCE_CLASS: Record<PaySource, string> = {
  app_store: 'bg-sky-50 text-sky-700',
  play_store: 'bg-emerald-50 text-emerald-700',
  stripe: 'bg-violet-50 text-violet-700',
  manual: 'bg-amber-50 text-amber-700',
};

export const PLATFORM_LABEL: Record<SignupPlatform, string> = {
  ios: 'App iOS',
  android: 'App Android',
  web: 'Web',
};

export function providerLabel(provider: string | null): string | null {
  if (!provider) return null;
  const labels: Record<string, string> = {
    google: 'Google',
    apple: 'Apple',
    email: 'Email',
    facebook: 'Facebook',
  };
  return labels[provider] ?? provider;
}

/** "google / organic · campaña" → texto corto de la fuente UTM. */
export function acquisitionLabel(o: {
  signupSource: string | null;
  signupMedium: string | null;
  signupCampaign: string | null;
}): string | null {
  const parts = [o.signupSource, o.signupMedium].filter(Boolean).join(' / ');
  if (!parts && !o.signupCampaign) return null;
  return o.signupCampaign ? `${parts || '—'} · ${o.signupCampaign}` : parts;
}
