// EcommerceConfigComponent (the editor) is "muy delicado" — small bugs in
// the signal wiring or save flow have a habit of causing the unsaved-changes
// banner to stick, the success toast to disappear, or the time picker to
// loop forever. This spec pins down the parts that are easy to break:
//
//   * `lastSyncedHours` MUST be a signal — otherwise mutating it after a save
//     does not trigger `hasUnsavedHours` to re-evaluate, and the banner
//     stays stuck on "Tienes cambios sin guardar".
//   * `setDayOpenDate` / `setDayCloseDate` must short-circuit when PrimeNG's
//     datepicker round-trips its own value (otherwise: infinite CD loop).
//   * `getChangedFields` must return ONLY the diffed columns so we never
//     clobber unrelated fields on the upsert.
//   * `saveAllChanges` must:
//       - call `upsertBusinessHours` only when hours actually changed,
//       - emit a unified success toast for hours-only saves,
//       - NOT emit the unified toast when `updatePartialConfig` ran (the
//         store toasts itself; duplicating is noise),
//       - update `lastSyncedHours` so the banner clears post-save.
//
// Component template compilation is intentionally bypassed via
// `overrideComponent({ template: '' })` — these tests cover class logic, not
// rendering. PhoneMockup / template-selector / PrimeNG imports do not need
// to compile for the assertions below.

jest.mock('ngx-sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@catalogohoy/core', () => ({
  SupabaseClientProvider: {
    getInstance: () => ({ from: jest.fn() }),
    create: () => ({}),
  },
}));

// `getTenantSlugFromUrl` is called in ngOnInit; stub it so we don't reach
// for `window.location` in tests.
jest.mock('@catalogohoy/tenant', () => {
  const actual = jest.requireActual('@catalogohoy/tenant');
  return {
    ...actual,
    getTenantSlugFromUrl: () => 'test-slug',
  };
});

import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmDialogService } from '@ui';
import { PlanStore } from '@catalogohoy/plan';
import { TenantStore } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import {
  DEFAULT_BUSINESS_HOURS_WEEK,
  DEFAULT_CURRENCY_CONFIG,
  DEFAULT_SOCIAL_LINKS,
  EcommerceConfig,
  EcommerceConfigComponent,
  EcommerceConfigService,
  EcommerceConfigStore,
  LocationApiService,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { E } from '@shared/domain';
import { toast } from 'ngx-sonner';

function buildConfig(overrides: Partial<EcommerceConfig> = {}): EcommerceConfig {
  return {
    tenantId: '42',
    name: 'Tienda Test',
    logo: null,
    banner: null,
    whatsappButtons: [],
    description: null,
    isAcceptingOrders: true,
    isVisible: true,
    currency: 'USD',
    currencySymbol: '$',
    showReferencePrice: true,
    showLocalCurrencyPrice: true,
    themeColor: '#10b981',
    paymentMethods: [],
    country: 'Venezuela',
    countryCode: 'VE',
    state: null,
    city: null,
    showDesignSection: true,
    showPaymentMethodsSection: true,
    showLocationSection: true,
    showCategoriesSection: true,
    socialLinks: DEFAULT_SOCIAL_LINKS,
    template: 'banner-centered',
    whatsappOrderMessage: null,
    ...overrides,
  };
}

describe('EcommerceConfigComponent (editor)', () => {
  let component: EcommerceConfigComponent;
  let configService: jest.Mocked<EcommerceConfigService>;
  let configStore: InstanceType<typeof EcommerceConfigStore>;

  beforeEach(async () => {
    // jsdom doesn't ship matchMedia; the editor's constructor reads it for
    // the responsive save-button label. Stub it before TestBed touches the
    // component class.
    if (!(window as unknown as { matchMedia?: unknown }).matchMedia) {
      (window as unknown as { matchMedia: unknown }).matchMedia = (
        query: string
      ) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      });
    }

    configService = {
      getConfig: jest.fn().mockResolvedValue(E.right(buildConfig())),
      getCurrencyConfig: jest.fn().mockResolvedValue(E.right(null)),
      getPaymentMethods: jest.fn().mockResolvedValue(E.right([])),
      createPaymentMethod: jest.fn(),
      getBusinessHours: jest
        .fn()
        .mockResolvedValue(E.right(DEFAULT_BUSINESS_HOURS_WEEK.map((d) => ({ ...d })))),
      upsertBusinessHours: jest.fn().mockResolvedValue(E.right(undefined)),
      updateConfig: jest.fn().mockResolvedValue(E.right(undefined)),
      updateCurrencyConfig: jest.fn().mockResolvedValue(E.right(undefined)),
      updateTenantCountry: jest.fn().mockResolvedValue(E.right(undefined)),
    } as unknown as jest.Mocked<EcommerceConfigService>;

    (toast.error as jest.Mock).mockClear();
    (toast.success as jest.Mock).mockClear();

    // Stub heavy collaborators with the smallest surface the component reads.
    const planStub = { currentPlan: signal({ isFree: false }) };
    const tenantStub = { getTenantIdAsync: jest.fn().mockResolvedValue(42) };
    const permissionsStub = { isOwner: () => true, can: () => () => true };
    const tenantCurrencyStub = { setCurrency: jest.fn() };
    const locationApiStub = {
      getStates: jest.fn().mockResolvedValue(E.right([])),
      getCities: jest.fn().mockResolvedValue(E.right([])),
    };
    const confirmStub = { info: jest.fn(), warning: jest.fn() };
    const routeStub = {
      snapshot: { queryParamMap: { get: () => null } },
    };
    const routerStub = { navigate: jest.fn().mockResolvedValue(true) };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: EcommerceConfigService, useValue: configService },
        { provide: PlanStore, useValue: planStub },
        { provide: TenantStore, useValue: tenantStub },
        { provide: TeamPermissionsStore, useValue: permissionsStub },
        { provide: TenantCurrencyStore, useValue: tenantCurrencyStub },
        { provide: LocationApiService, useValue: locationApiStub },
        { provide: ConfirmDialogService, useValue: confirmStub },
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: Router, useValue: routerStub },
      ],
    });

    // Skip template compilation — we are exercising the class only.
    TestBed.overrideComponent(EcommerceConfigComponent, {
      set: { template: '' },
    });

    configStore = TestBed.inject(EcommerceConfigStore);

    // Seed the store BEFORE creating the component so the constructor's
    // draft-sync effect picks up the config on its first run.
    await configStore.reloadConfig('42');

    const fixture = TestBed.createComponent(EcommerceConfigComponent);
    component = fixture.componentInstance;

    // Flush registered effects so drafts copy from the seeded config. We
    // use ApplicationRef.tick() rather than detectChanges() to avoid
    // re-entering CD with the empty-template override.
    TestBed.inject(ApplicationRef).tick();
    await Promise.resolve();

    // The constructor's draft-sync effect can be skipped in some test
    // environments because TestBed schedules effects on the microtask queue
    // and our awaits don't always flush them before the test body runs. We
    // explicitly mirror the seeded config into the drafts here so each test
    // starts from a known, "synced" baseline — this is what the effect
    // would have done in production. Tests that exercise the effect itself
    // (e.g. clearing the unsaved banner after save) still go through the
    // public methods that update both drafts and synced snapshots.
    const seeded = configStore.config();
    if (seeded) {
      component.draftName.set(seeded.name ?? '');
      component.draftDescription.set(seeded.description ?? '');
      component.draftThemeColor.set(seeded.themeColor ?? '#10b981');
      component.draftCountryCode.set(seeded.countryCode ?? null);
      component.draftState.set(seeded.state ?? null);
      component.draftCity.set(seeded.city ?? null);
      component.draftShowDesignSection.set(seeded.showDesignSection ?? true);
      component.draftShowLocationSection.set(seeded.showLocationSection ?? true);
      component.draftShowPaymentMethodsSection.set(
        seeded.showPaymentMethodsSection ?? true
      );
      component.draftShowCategoriesSection.set(
        seeded.showCategoriesSection ?? true
      );
      component.draftTemplate.set(seeded.template ?? 'banner-centered');
      component.draftCurrencySymbol.set(seeded.currencySymbol ?? '$');
      component.draftShowReferencePrice.set(seeded.showReferencePrice ?? true);
      component.draftShowLocalCurrencyPrice.set(
        seeded.showLocalCurrencyPrice ?? true
      );
      component.draftWhatsappOrderMessage.set(seeded.whatsappOrderMessage ?? null);
      component.draftWhatsappButtons.set(
        seeded.whatsappButtons?.length
          ? seeded.whatsappButtons.map((b) => ({ ...b }))
          : [{ name: '', number: '' }]
      );
      component.draftSocialLinks.set(seeded.socialLinks ?? DEFAULT_SOCIAL_LINKS);
    }
    component.draftCurrency.set({ ...DEFAULT_CURRENCY_CONFIG });
  });

  // ── lastSyncedHours signal regression ───────────────────────────────
  describe('hasUnsavedHours', () => {
    it('is false when the draft matches the synced snapshot', () => {
      // After construction both signals start from DEFAULT_BUSINESS_HOURS_WEEK.
      expect(component.hasUnsavedHours()).toBe(false);
    });

    it('flips to true the moment the user mutates the draft', () => {
      component.updateDayIsOpen(0, false);
      expect(component.hasUnsavedHours()).toBe(true);
    });

    it('CRITICAL: clears back to false after saveAllChanges persists hours', async () => {
      // This is the regression we just fixed: lastSyncedHours used to be a
      // plain class field, so reassigning it after the save did NOT cause
      // `hasUnsavedHours` (a computed) to re-evaluate. The banner stayed
      // stuck on "Tienes cambios sin guardar". Make sure that does NOT come
      // back.
      component.updateDayIsOpen(0, false);
      expect(component.hasUnsavedHours()).toBe(true);

      await component.saveAllChanges();

      expect(configService.upsertBusinessHours).toHaveBeenCalledTimes(1);
      expect(component.hasUnsavedHours()).toBe(false);
    });

    it('does NOT clear when the upsert fails', async () => {
      configService.upsertBusinessHours.mockResolvedValueOnce(
        E.left(new Error('rls denied'))
      );
      component.updateDayIsOpen(0, false);

      await component.saveAllChanges();

      expect(component.hasUnsavedHours()).toBe(true);
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/horario/i)
      );
    });
  });

  // ── setDayOpenDate / setDayCloseDate guards ─────────────────────────
  describe('time-picker round-trip guards', () => {
    it('setDayOpenDate is a no-op when the new value matches the current openTime', () => {
      const beforeWeek = component.draftBusinessHours();
      const sameTime = component.timeStringToDate(beforeWeek[1].openTime);

      component.setDayOpenDate(1, sameTime);

      // Same reference, same content — the signal should not have been
      // re-set, so a fresh read returns the EXACT same array reference.
      expect(component.draftBusinessHours()).toBe(beforeWeek);
    });

    it('setDayOpenDate updates the day when the new time differs', () => {
      const newTime = new Date();
      newTime.setHours(7, 30, 0, 0);

      component.setDayOpenDate(1, newTime);

      const monday = component
        .draftBusinessHours()
        .find((d) => d.dayOfWeek === 1);
      expect(monday?.openTime).toBe('07:30');
    });

    it('setDayCloseDate ignores null and never throws', () => {
      const before = component.draftBusinessHours();
      component.setDayCloseDate(1, null);
      expect(component.draftBusinessHours()).toBe(before);
    });
  });

  // ── orderedDraftHours ───────────────────────────────────────────────
  describe('orderedDraftHours', () => {
    it('returns 7 entries in Mon→Sun order with Domingo last', () => {
      const ordered = component.orderedDraftHours();
      expect(ordered.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 0]);
      expect(ordered.map((d) => d.label)).toEqual([
        'Lunes',
        'Martes',
        'Miércoles',
        'Jueves',
        'Viernes',
        'Sábado',
        'Domingo',
      ]);
    });

    it('precomputes Date instances and keeps the SAME reference between reads (loop prevention)', () => {
      // PrimeNG's [ngModel] compares by reference. If `orderedDraftHours`
      // produced fresh `new Date()` objects on every read, the datepicker
      // would believe the model changed every CD cycle and write back ➜
      // infinite loop. Stable references for the same draft state are the
      // whole reason this is a `computed`.
      const a = component.orderedDraftHours();
      const b = component.orderedDraftHours();
      expect(a).toBe(b);
      expect(a[0].openDate).toBe(b[0].openDate);
    });
  });

  // ── getChangedFields ────────────────────────────────────────────────
  describe('getChangedFields', () => {
    it('returns an empty object when no draft differs from the synced config', () => {
      expect(component.getChangedFields()).toEqual({});
    });

    it('captures only the fields that actually changed', () => {
      component.draftName.set('Nuevo Nombre');
      component.draftThemeColor.set('#ff0000');

      const changes = component.getChangedFields();
      expect(changes).toEqual({
        name: 'Nuevo Nombre',
        themeColor: '#ff0000',
      });
      // Crucial: untouched fields stay OUT of the patch so the upsert does
      // not clobber them.
      expect(changes).not.toHaveProperty('logo');
      expect(changes).not.toHaveProperty('banner');
      expect(changes).not.toHaveProperty('socialLinks');
    });

    it('detects whatsappButtons changes via deep equality', () => {
      component.draftWhatsappButtons.set([{ name: 'Juan', number: '1234567' }]);
      const changes = component.getChangedFields();
      expect(changes.whatsappButtons).toEqual([
        { name: 'Juan', number: '1234567' },
      ]);
    });
  });

  // ── saveAllChanges toast paths ──────────────────────────────────────
  describe('saveAllChanges — toast paths', () => {
    it('emits the unified success toast when only hours changed', async () => {
      component.updateDayIsOpen(6, false);

      await component.saveAllChanges();

      expect(configService.upsertBusinessHours).toHaveBeenCalledTimes(1);
      expect(configService.updateConfig).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        'Catálogo actualizado correctamente'
      );
    });

    it('does NOT emit the unified toast when updatePartialConfig ran (avoids duplicate toast)', async () => {
      // updatePartialConfig fires its own "Configuración actualizada" toast
      // via the store. Our unified toast must stay quiet so the user does
      // not see two stacked banners.
      component.draftName.set('Nuevo Nombre');

      await component.saveAllChanges();

      expect(configService.updateConfig).toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalledWith(
        'Catálogo actualizado correctamente'
      );
    });

    it('does NOT call upsertBusinessHours when hours are untouched', async () => {
      component.draftName.set('Solo el nombre');
      await component.saveAllChanges();
      expect(configService.upsertBusinessHours).not.toHaveBeenCalled();
    });

    it('skips the unified toast when the hours upsert errors out', async () => {
      configService.upsertBusinessHours.mockResolvedValueOnce(
        E.left(new Error('boom'))
      );
      component.updateDayIsOpen(6, false);

      await component.saveAllChanges();

      expect(toast.error).toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalledWith(
        'Catálogo actualizado correctamente'
      );
    });
  });

  // ── time string ⇄ Date roundtrip ────────────────────────────────────
  describe('timeStringToDate', () => {
    it('returns null for empty/invalid input', () => {
      expect(component.timeStringToDate(null)).toBeNull();
      expect(component.timeStringToDate(undefined)).toBeNull();
      expect(component.timeStringToDate('')).toBeNull();
      expect(component.timeStringToDate('not-a-time')).toBeNull();
    });

    it('parses HH:MM strings into a Date with matching hour/minute', () => {
      const d = component.timeStringToDate('14:30');
      expect(d).not.toBeNull();
      expect(d!.getHours()).toBe(14);
      expect(d!.getMinutes()).toBe(30);
    });

    it('parses HH:MM:SS strings (the shape supabase TIME columns return)', () => {
      const d = component.timeStringToDate('08:00:00');
      expect(d!.getHours()).toBe(8);
      expect(d!.getMinutes()).toBe(0);
    });
  });
});
