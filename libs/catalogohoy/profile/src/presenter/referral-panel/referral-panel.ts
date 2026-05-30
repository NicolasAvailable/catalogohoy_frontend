import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { ButtonComponent, CardComponent, IconComponent } from '@ui';

interface ReferralListItem {
  id: number;
  status: 'pending' | 'qualified' | 'rewarded' | 'expired';
  signupAt: string;
  qualifiedAt: string | null;
  rewardedAt: string | null;
  referredSlug: string | null;
  referredName: string | null;
  referredEmailMasked: string | null;
  rewardUsd: number | null;
}

// Programa de referidos del tenant: muestra su código compartible + lista
// de invitados con status y crédito ganado. Se renderiza como una card
// dentro del tab "Referidos" de Mi Perfil.
@Component({
  selector: 'lib-referral-panel',
  standalone: true,
  imports: [DatePipe, DecimalPipe, CardComponent, IconComponent, ButtonComponent],
  templateUrl: './referral-panel.html',
})
export class ReferralPanel implements OnInit {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);

  public readonly isLoading = signal(true);
  public readonly code = signal<string | null>(null);
  public readonly referrals = signal<ReferralListItem[]>([]);
  public readonly creditUsd = signal(0);
  public readonly creditUsedUsd = signal(0);
  public readonly justCopied = signal(false);

  public readonly link = computed(() => {
    const c = this.code();
    return c ? `https://catalogohoy.com/?ref=${c}` : '';
  });

  public readonly counts = computed(() => {
    const list = this.referrals();
    return {
      pending:   list.filter((r) => r.status === 'pending').length,
      qualified: list.filter((r) => r.status === 'qualified').length,
      rewarded:  list.filter((r) => r.status === 'rewarded').length,
      expired:   list.filter((r) => r.status === 'expired').length,
    };
  });

  async ngOnInit(): Promise<void> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.isLoading.set(false);
      return;
    }

    // 1) Código (lazy) y balance del tenant
    const [{ data: codeData }, { data: tenantRow }] = await Promise.all([
      this.client.rpc('get_or_create_referral_code', { p_tenant_id: tenantId }),
      this.client
        .from('tenants')
        .select('referral_credit_usd, referral_credit_used_usd')
        .eq('id', tenantId)
        .maybeSingle(),
    ]);

    if (typeof codeData === 'string') this.code.set(codeData);
    if (tenantRow) {
      this.creditUsd.set(Number(tenantRow.referral_credit_usd ?? 0));
      this.creditUsedUsd.set(Number(tenantRow.referral_credit_used_usd ?? 0));
    }

    // 2) Lista de referrals donde este tenant es el referrer
    const { data: rows } = await this.client
      .from('referrals')
      .select('id, status, signup_at, qualified_at, rewarded_at, referrer_credit_usd, referred_tenant_id')
      .eq('referrer_tenant_id', tenantId)
      .order('signup_at', { ascending: false });

    if (rows?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedRows = rows as any[];
      const referredIds = typedRows.map((r) => r.referred_tenant_id as number);

      const { data: referredTenants } = await this.client
        .from('tenants')
        .select('id, slug, name')
        .in('id', referredIds);

      const { data: ownerLinks } = await this.client
        .from('users_tenants')
        .select('tenant_id, users!inner(email)')
        .in('tenant_id', referredIds)
        .eq('role', 'owner');

      const slugByTenant = new Map<number, { slug: string; name: string | null }>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((referredTenants ?? []) as any[]).forEach((t) =>
        slugByTenant.set(t.id as number, { slug: t.slug, name: t.name })
      );

      const emailByTenant = new Map<number, string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((ownerLinks ?? []) as any[]).forEach((l) => {
        const u = l.users;
        const email = Array.isArray(u) ? u[0]?.email : u?.email;
        if (email) emailByTenant.set(l.tenant_id as number, email);
      });

      this.referrals.set(
        typedRows.map((r) => {
          const referredTenantId = r.referred_tenant_id as number;
          const tn = slugByTenant.get(referredTenantId);
          return {
            id: r.id as number,
            status: r.status as ReferralListItem['status'],
            signupAt: r.signup_at as string,
            qualifiedAt: r.qualified_at as string | null,
            rewardedAt: r.rewarded_at as string | null,
            referredSlug: tn?.slug ?? null,
            referredName: tn?.name ?? null,
            referredEmailMasked: this.maskEmail(emailByTenant.get(referredTenantId)),
            rewardUsd: r.referrer_credit_usd != null ? Number(r.referrer_credit_usd) : null,
          };
        })
      );
    }

    this.isLoading.set(false);
  }

  public async copyLink(): Promise<void> {
    const link = this.link();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.justCopied.set(true);
      setTimeout(() => this.justCopied.set(false), 1800);
    } catch {
      /* clipboard puede no estar disponible (browser viejo o iframe) */
    }
  }

  public statusLabel(s: ReferralListItem['status']): string {
    return {
      pending:   'Pendiente',
      qualified: 'Calificado',
      rewarded:  'Acreditado',
      expired:   'Expirado',
    }[s];
  }

  public statusClass(s: ReferralListItem['status']): string {
    return {
      pending:   'bg-amber-100 text-amber-700',
      qualified: 'bg-blue-100 text-blue-700',
      rewarded:  'bg-emerald-100 text-emerald-700',
      expired:   'bg-grey-100 text-grey-500',
    }[s];
  }

  /** Enmascara `prv.audio@gmail.com` → `p**.a***@gmail.com` para no exponer
   *  el email completo del referido en el panel del referrer. */
  private maskEmail(email: string | undefined): string | null {
    if (!email) return null;
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const masked = local
      .split('.')
      .map((part) => (part.length <= 1 ? part : part[0] + '*'.repeat(Math.min(3, part.length - 1))))
      .join('.');
    return `${masked}@${domain}`;
  }
}
