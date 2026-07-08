import { Component, computed, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  findCountryByCode,
  SUPPORTED_COUNTRIES,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { ProfileStore } from '@catalogohoy/profile';
import { TenantStore } from '@catalogohoy/tenant';
import {
  ButtonComponent,
  DialogComponent,
  IconComponent,
  InputPhoneComponent,
  InputTextComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
} from '@ui';
import {
  buildCalendlyUrl,
  ENTERPRISE_CATALOG_OPTIONS,
  ENTERPRISE_NEED_OPTIONS,
  ENTERPRISE_RANGE_OPTIONS,
  ENTERPRISE_TEAM_OPTIONS,
  EnterpriseCatalogs,
  EnterpriseFunnelAnswers,
  EnterpriseLeadResult,
  EnterpriseNeed,
  EnterpriseRange,
  EnterpriseTeamSize,
  scoreEnterpriseLead,
} from '../../domain';
import { EnterpriseLeadService } from '../../infrastructure/enterprise-lead.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Paso final del wizard (pantalla de resultado). */
const RESULT_STEP = 5;

@Component({
  selector: 'lib-enterprise-contact-dialog',
  imports: [
    FormsModule,
    DialogComponent,
    ButtonComponent,
    IconComponent,
    InputTextComponent,
    InputPhoneComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
  ],
  templateUrl: './enterprise-contact-dialog.html',
  styleUrl: './enterprise-contact-dialog.css',
})
export class EnterpriseContactDialog {
  private readonly router = inject(Router);
  private readonly tenantStore = inject(TenantStore);
  private readonly profileStore = inject(ProfileStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly leadService = inject(EnterpriseLeadService);

  @ViewChild(DialogComponent) dialog!: DialogComponent;

  public readonly rangeOptions = ENTERPRISE_RANGE_OPTIONS;
  public readonly catalogOptions = ENTERPRISE_CATALOG_OPTIONS;
  public readonly teamOptions = ENTERPRISE_TEAM_OPTIONS;
  public readonly needOptions = ENTERPRISE_NEED_OPTIONS;
  /** Mismo selector de país (con banderas) que la ubicación del editor. */
  public readonly supportedCountries = SUPPORTED_COUNTRIES;

  public readonly step = signal(0);
  public readonly resultStep = RESULT_STEP;

  // Respuestas del funnel
  public readonly businessName = signal('');
  /** Código ISO del país (VE, AR…) — se persiste el label en español. */
  public readonly country = signal('');
  public readonly website = signal('');
  public readonly productsRange = signal<EnterpriseRange | null>(null);
  public readonly ordersRange = signal<EnterpriseRange | null>(null);
  public readonly catalogsNeeded = signal<EnterpriseCatalogs | null>(null);
  public readonly teamSize = signal<EnterpriseTeamSize | null>(null);
  public readonly needs = signal<EnterpriseNeed[]>([]);
  public readonly name = signal('');
  public readonly email = signal('');
  public readonly phone = signal('');

  public readonly submitState = signal<'idle' | 'submitting' | 'done' | 'error'>('idle');
  public readonly result = signal<EnterpriseLeadResult | null>(null);

  public readonly canContinue = computed(() => {
    switch (this.step()) {
      case 0:
        return this.businessName().trim().length > 0;
      case 1:
        return this.productsRange() !== null && this.ordersRange() !== null;
      case 2:
        return this.catalogsNeeded() !== null && this.teamSize() !== null;
      case 3:
        return this.needs().length > 0;
      case 4:
        return (
          this.name().trim().length > 0 && EMAIL_RE.test(this.email().trim())
        );
      default:
        return false;
    }
  });

  public readonly calendlyUrl = computed(() =>
    buildCalendlyUrl(this.name().trim(), this.email().trim())
  );

  public readonly phoneDefaultIso = computed(() =>
    (this.country() || 've').toLowerCase()
  );

  public flagUrl(code: string): string {
    return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
  }

  public show(): void {
    this.step.set(0);
    this.submitState.set('idle');
    this.result.set(null);

    // Prefill con lo que ya sabemos del tenant/usuario logueado.
    this.businessName.set(this.tenantStore.tenantName() ?? '');
    this.country.set(
      findCountryByCode(this.tenantCurrency.countryCode())?.code ?? ''
    );
    const profile = this.profileStore.profile();
    this.name.set(profile.name ?? '');
    this.email.set(profile.email ?? '');

    this.dialog.show();
  }

  public close(): void {
    this.dialog.hide();
  }

  public back(): void {
    if (this.step() > 0) this.step.update((s) => s - 1);
  }

  public next(): void {
    if (!this.canContinue()) return;
    if (this.step() === 4) {
      this.submit();
      return;
    }
    this.step.update((s) => s + 1);
  }

  public toggleNeed(need: EnterpriseNeed): void {
    this.needs.update((current) =>
      current.includes(need)
        ? current.filter((n) => n !== need)
        : [...current, need]
    );
  }

  public isNeedSelected(need: EnterpriseNeed): boolean {
    return this.needs().includes(need);
  }

  /** El resultado se calcula local (UX inmediata); el envío corre en paralelo
   *  y la edge function re-puntúa server-side lo que persiste. */
  public submit(): void {
    const answers = this.collectAnswers();
    this.result.set(scoreEnterpriseLead(answers));
    this.step.set(RESULT_STEP);
    this.sendLead(answers);
  }

  public retrySend(): void {
    this.sendLead(this.collectAnswers());
  }

  public openCalendly(): void {
    window.open(this.calendlyUrl(), '_blank', 'noopener');
  }

  public goToAvanzado(): void {
    this.dialog.hide();
    this.router.navigate(['/admin/plans/checkout', 'avanzado']);
  }

  private collectAnswers(): EnterpriseFunnelAnswers {
    return {
      businessName: this.businessName().trim(),
      country:
        this.supportedCountries.find((c) => c.code === this.country())?.label ??
        '',
      website: this.website().trim(),
      // canContinue garantiza que los selects no son null al llegar acá
      productsRange: this.productsRange() ?? 'lt_100',
      ordersRange: this.ordersRange() ?? 'lt_100',
      catalogsNeeded: this.catalogsNeeded() ?? '1',
      teamSize: this.teamSize() ?? 'solo',
      needs: this.needs(),
      name: this.name().trim(),
      email: this.email().trim(),
      phone: this.phone().trim(),
    };
  }

  private sendLead(answers: EnterpriseFunnelAnswers): void {
    this.submitState.set('submitting');
    this.leadService
      .submit({
        source: 'admin',
        tenantSlug: this.tenantStore.tenantSlug(),
        answers,
      })
      .then((result) => {
        result
          .mapRight(() => this.submitState.set('done'))
          .mapLeft(() => this.submitState.set('error'));
      });
  }
}
