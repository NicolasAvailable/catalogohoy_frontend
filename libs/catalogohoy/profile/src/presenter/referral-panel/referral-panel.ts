import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { ButtonComponent, CardComponent, IconComponent } from '@ui';

interface ReferralListItem {
  id: number;
  status: 'pending' | 'qualified' | 'rewarded' | 'expired';
  signupAt: string;
  rewardUsd: number | null;
}

// Programa de referidos del tenant. Por privacidad NO mostramos email ni
// slug del referido al referrer: solo fecha, status y crédito ganado.
// Es información suficiente para que el referrer entienda su programa
// sin exponer datos personales de los invitados.
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

    const [{ data: codeData }, { data: tenantRow }, { data: rows }] = await Promise.all([
      this.client.rpc('get_or_create_referral_code', { p_tenant_id: tenantId }),
      this.client
        .from('tenants')
        .select('referral_credit_usd, referral_credit_used_usd')
        .eq('id', tenantId)
        .maybeSingle(),
      this.client
        .from('referrals')
        .select('id, status, signup_at, referrer_credit_usd')
        .eq('referrer_tenant_id', tenantId)
        .order('signup_at', { ascending: false }),
    ]);

    if (typeof codeData === 'string') this.code.set(codeData);
    if (tenantRow) {
      this.creditUsd.set(Number(tenantRow.referral_credit_usd ?? 0));
      this.creditUsedUsd.set(Number(tenantRow.referral_credit_used_usd ?? 0));
    }

    if (rows?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.referrals.set((rows as any[]).map((r) => ({
        id: r.id as number,
        status: r.status as ReferralListItem['status'],
        signupAt: r.signup_at as string,
        rewardUsd: r.referrer_credit_usd != null ? Number(r.referrer_credit_usd) : null,
      })));
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
}
