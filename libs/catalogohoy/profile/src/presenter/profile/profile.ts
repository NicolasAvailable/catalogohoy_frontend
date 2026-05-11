import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal, ViewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CheckoutService, PlanStore } from '@catalogohoy/plan';
import { TenantStore } from '@catalogohoy/tenant';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import {
  confirmPasswordValidator,
  whiteSpacesValidator,
} from '@shared/presenter';
import {
  ButtonComponent,
  CardComponent,
  ConfirmDialogComponent,
  IconComponent,
  InputMessageComponent,
  InputPasswordComponent,
  InputTextComponent,
  ToggleComponent,
} from '@ui';
import { ProfileFacade } from '../../application';
import {
  BillingEntry,
  BillingService,
  ProfileService,
  ProfileStore,
} from '../../infrastructure';

export type ProfileTabId = 'general' | 'subscription' | 'notifications' | 'danger';
const VALID_TABS: ProfileTabId[] = ['general', 'subscription', 'notifications', 'danger'];

@Component({
  selector: 'lib-profile',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    CardComponent,
    InputTextComponent,
    InputMessageComponent,
    InputPasswordComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    IconComponent,
    ToggleComponent,
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  private readonly profileFacade = inject(ProfileFacade);
  private readonly profileStore = inject(ProfileStore);
  private readonly profileService = inject(ProfileService);
  private readonly billingService = inject(BillingService);
  private readonly tenantStore = inject(TenantStore);
  private readonly checkoutService = inject(CheckoutService);
  private readonly toaster = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  public readonly planStore = inject(PlanStore);

  public readonly isCancelling = signal(false);
  public readonly isDeleting = signal(false);

  // ── Tabs ──────────────────────────────────────────────────────────────
  public readonly tabs: { id: ProfileTabId; label: string; icon: string }[] = [
    { id: 'general',       label: 'General',          icon: 'user' },
    { id: 'subscription',  label: 'Suscripción',      icon: 'credit-card' },
    { id: 'notifications', label: 'Notificaciones',   icon: 'mail' },
    { id: 'danger',        label: 'Zona de peligro',  icon: 'triangle-alert' },
  ];
  public readonly activeTab = signal<ProfileTabId>('general');

  setActiveTab(tab: ProfileTabId): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ── Billing history ────────────────────────────────────────────────
  /** null while not yet loaded, [] once loaded with no entries. Lazily
   *  fetched the first time the user clicks the Suscripción tab so we don't
   *  hit Stripe on every profile load. */
  public readonly billingEntries = signal<BillingEntry[] | null>(null);
  public readonly isLoadingBilling = signal(false);
  public readonly billingError = signal<string | null>(null);
  public readonly hasBillingHistory = computed(
    () => (this.billingEntries() ?? []).length > 0
  );

  // ── Notifications draft (Phase 3) ──────────────────────────────────
  // Mirrors the column we'll add to `users.notify_plan_expiry`. Persisted
  // through `ProfileFacade.updateNotificationPreferences` (added below).
  public readonly draftNotifyPlanExpiry = signal<boolean>(true);
  public readonly isSavingNotifications = signal(false);

  @ViewChild('cancelDialog')
  public cancelDialog!: ConfirmDialogComponent;

  @ViewChild('deleteDialog')
  public deleteDialog!: ConfirmDialogComponent;

  public readonly profileForm = inject(FormBuilder).group({
    name: [
      '',
      [Validators.required, Validators.minLength(4), whiteSpacesValidator()],
    ],
    email: [{ value: '', disabled: true }],
  });

  public readonly passwordForm = inject(FormBuilder).group(
    {
      password: [
        '',
        [Validators.required, Validators.minLength(6), whiteSpacesValidator()],
      ],
      passwordConfirmed: [
        '',
        [Validators.required, Validators.minLength(6), whiteSpacesValidator()],
      ],
    },
    {
      validators: confirmPasswordValidator,
    }
  );

  constructor() {
    // Restore active tab from query param (?tab=general|subscription|notifications|danger).
    // One-way bootstrap from URL — afterwards the signal is the source of truth.
    const initialTab = this.route.snapshot.queryParamMap.get('tab') as ProfileTabId | null;
    if (initialTab && VALID_TABS.includes(initialTab)) {
      this.activeTab.set(initialTab);
    }

    effect(() => {
      const profile = this.profileStore.profile();
      this.profileForm.get('name')?.setValue(profile.name);
      this.profileForm.get('email')?.setValue(profile.email);
      // Sync notifications draft from server state. ProfileStore exposes
      // notifyPlanExpiry; default true so existing rows that never had the
      // column read true.
      const pref = (profile as { notifyPlanExpiry?: boolean }).notifyPlanExpiry;
      this.draftNotifyPlanExpiry.set(pref ?? true);
    });

    // Lazy-load billing history the first time the user opens the tab.
    effect(() => {
      if (this.activeTab() !== 'subscription') return;
      if (this.billingEntries() !== null) return; // already loaded
      if (this.isLoadingBilling()) return;
      this.loadBillingHistory();
    });
  }

  public async loadBillingHistory(): Promise<void> {
    const tenantId = this.tenantStore.tenant().tenantId;
    if (!tenantId) {
      this.billingEntries.set([]);
      return;
    }
    this.isLoadingBilling.set(true);
    this.billingError.set(null);
    const result = await this.billingService.getPaymentHistory(tenantId);
    result.fold(
      (err) => {
        this.billingError.set(err.message);
        this.billingEntries.set([]);
      },
      (entries) => this.billingEntries.set(entries)
    );
    this.isLoadingBilling.set(false);
  }

  /** Track in-flight invoice fetches by entry id so we can show a per-row
   *  loader without flickering the whole table. */
  public readonly busyInvoiceId = signal<string | null>(null);

  public async downloadPdf(entry: BillingEntry): Promise<void> {
    if (entry.source === 'stripe') {
      // Stripe has a hosted PDF; just trigger the browser to fetch it.
      const url = entry.invoicePdfUrl ?? entry.receiptUrl;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!entry.invoiceNumber) return;
    this.busyInvoiceId.set(entry.id);
    const result = await this.billingService.downloadInvoicePdf(entry.invoiceNumber);
    result.mapLeft((err) =>
      this.toaster.error(new Exception('No se pudo descargar el PDF: ' + err.message))
    );
    this.busyInvoiceId.set(null);
  }

  public async updateName(): Promise<void> {
    const name = this.profileForm.get('name')?.value;
    if (this.profileForm.valid && name) {
      await this.profileFacade.updateName(name);
      this.profileStore.$profile();
    }
  }

  public async updatePassword(): Promise<void> {
    const password = this.passwordForm.get('password')?.value;
    if (this.passwordForm.valid && password) {
      await this.profileFacade.updatePassword(password);
      this.passwordForm.reset();
    }
  }

  public async saveNotificationPreferences(): Promise<void> {
    this.isSavingNotifications.set(true);
    const result = await this.profileService.updateNotificationPreferences({
      notifyPlanExpiry: this.draftNotifyPlanExpiry(),
    });
    result.fold(
      (err) => {
        this.toaster.error(
          new Exception('No se pudo guardar tus preferencias: ' + (err.message || ''))
        );
      },
      () => {
        this.profileStore.$profile();
      }
    );
    this.isSavingNotifications.set(false);
  }

  public onCancelSubscription(): void {
    this.cancelDialog.warning();
  }

  public async onConfirmCancel(): Promise<void> {
    const tenantId = this.tenantStore.tenant().tenantId;
    if (!tenantId) return;

    this.isCancelling.set(true);
    await this.checkoutService.cancelSubscription(tenantId);
    this.isCancelling.set(false);
  }

  public onDeleteAccount(): void {
    this.deleteDialog.warning();
  }

  public async onConfirmDelete(): Promise<void> {
    this.isDeleting.set(true);
    const result = await this.profileService.deleteAccount();
    // Previously the result was discarded: if the `delete-account` edge
    // function isn't deployed or returns 4xx/5xx, the user saw nothing —
    // just the loading spinner stopping — and thought "no me deja eliminar
    // cuenta". Surface the failure instead of swallowing it.
    result.mapLeft((err) => {
      this.toaster.error(
        new Exception('No se pudo eliminar la cuenta: ' + (err.message || 'error desconocido'))
      );
    });
    this.isDeleting.set(false);
  }

  /** Render helper for the billing table — labels match the entry status
   *  union so we can colour-code without polluting the template. */
  public statusLabel(status: BillingEntry['status']): string {
    switch (status) {
      case 'paid': return 'Pagado';
      case 'open': return 'Pendiente';
      case 'pending': return 'Pendiente';
      case 'failed': return 'Fallido';
      case 'refunded': return 'Reembolsado';
      case 'void': return 'Anulado';
    }
  }

  public statusBadgeClass(status: BillingEntry['status']): string {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-700';
      case 'open':
      case 'pending': return 'bg-amber-50 text-amber-700';
      case 'failed': return 'bg-red-50 text-red-700';
      case 'refunded': return 'bg-sky-50 text-sky-700';
      case 'void': return 'bg-grey-50 text-grey-500';
    }
  }
}
