// EcommerceConfigStore lives in @catalogohoy/ecommerce-config (which has no
// jest infra). Co-located here under e-commerce.

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

import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_CURRENCY_CONFIG,
  DEFAULT_SOCIAL_LINKS,
  EcommerceConfig,
  EcommerceConfigService,
  EcommerceConfigStore,
} from '@catalogohoy/ecommerce-config';
import { E } from '@shared/domain';
import { toast } from 'ngx-sonner';

function buildConfig(overrides: Partial<EcommerceConfig> = {}): EcommerceConfig {
  return {
    tenantId: '42',
    name: 'Nortesur',
    logo: 'https://img/logo.png',
    banner: 'https://img/banner.png',
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

describe('EcommerceConfigStore', () => {
  let store: InstanceType<typeof EcommerceConfigStore>;
  let service: jest.Mocked<EcommerceConfigService>;

  beforeEach(() => {
    service = {
      getConfig: jest.fn(),
      getCurrencyConfig: jest.fn(),
      updateConfig: jest.fn(),
      updateCurrencyConfig: jest.fn(),
      updateTenantCountry: jest.fn(),
    } as unknown as jest.Mocked<EcommerceConfigService>;

    (toast.error as jest.Mock).mockClear();
    (toast.success as jest.Mock).mockClear();

    // resetTestingModule tears down the root injector, so the next
    // `inject(EcommerceConfigStore)` produces a fresh singleton with the
    // module-level `initialState` copied in.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: EcommerceConfigService, useValue: service }],
    });

    store = TestBed.inject(EcommerceConfigStore);
  });

  describe('loadConfig', () => {
    it('caches after the first call and does not refetch', async () => {
      service.getConfig.mockResolvedValue(E.right(buildConfig()));
      await store.loadConfig('42');
      await store.loadConfig('42');
      expect(service.getConfig).toHaveBeenCalledTimes(1);
    });

    it('captures service errors as state.error without throwing', async () => {
      service.getConfig.mockResolvedValue(E.left(new Error('rls denied')));
      await store.reloadConfig('42');
      expect(store.error()).toBe('rls denied');
      expect(store.isLoading()).toBe(false);
    });
  });

  describe('reloadConfig', () => {
    it('bypasses the cache guard and fetches every time', async () => {
      service.getConfig.mockResolvedValue(E.right(buildConfig()));
      await store.reloadConfig('42');
      await store.reloadConfig('42');
      await store.reloadConfig('42');
      expect(service.getConfig).toHaveBeenCalledTimes(3);
    });
  });

  describe('loadCurrencyConfig', () => {
    it('seeds defaults and flags "does not exist" when no row found', async () => {
      service.getCurrencyConfig.mockResolvedValue(E.right(null));
      await store.loadCurrencyConfig('42');
      expect(store.currencyConfig()).toEqual(DEFAULT_CURRENCY_CONFIG);
      expect(store.currencyConfigExists()).toBe(false);
    });

    it('stores the persisted row when one exists', async () => {
      const row = {
        ...DEFAULT_CURRENCY_CONFIG,
        productCurrency: 'VES',
        displayCurrency: 'USD',
        currencySymbol: 'Bs.',
      };
      service.getCurrencyConfig.mockResolvedValue(E.right(row));
      await store.loadCurrencyConfig('42');
      expect(store.currencyConfig()).toEqual(row);
      expect(store.currencyConfigExists()).toBe(true);
    });
  });

  describe('updatePartialConfig', () => {
    it('patches the local config on success and surfaces a success toast', async () => {
      service.getConfig.mockResolvedValue(E.right(buildConfig()));
      await store.reloadConfig('42');

      service.updateConfig.mockResolvedValue(E.right(undefined));
      await store.updatePartialConfig({ name: 'Nuevo Nombre' });

      expect(store.config()?.name).toBe('Nuevo Nombre');
      expect(store.isSaving()).toBe(false);
      expect(toast.success).toHaveBeenCalledWith(
        'Configuración actualizada correctamente'
      );
    });

    it('leaves config untouched when the service fails', async () => {
      service.getConfig.mockResolvedValue(E.right(buildConfig({ name: 'Old' })));
      await store.reloadConfig('42');

      service.updateConfig.mockResolvedValue(E.left(new Error('timeout')));
      await store.updatePartialConfig({ name: 'New' });

      expect(store.config()?.name).toBe('Old');
      expect(store.error()).toBe('timeout');
      expect(toast.error).toHaveBeenCalled();
    });

    it('no-ops when there is no loaded config', async () => {
      await store.updatePartialConfig({ name: 'ghost' });
      expect(service.updateConfig).not.toHaveBeenCalled();
    });
  });

  describe('saveCurrencyConfig', () => {
    it('merges the patch into currencyConfig on success', async () => {
      service.getConfig.mockResolvedValue(E.right(buildConfig()));
      await store.reloadConfig('42');

      service.updateCurrencyConfig.mockResolvedValue(E.right(undefined));
      await store.saveCurrencyConfig({
        productCurrency: 'VES',
        currencySymbol: 'Bs.',
      });

      expect(store.currencyConfig().productCurrency).toBe('VES');
      expect(store.currencyConfig().currencySymbol).toBe('Bs.');
      expect(store.currencyConfigExists()).toBe(true);
    });

    it('does not flip currencyConfigExists when the save fails', async () => {
      service.getConfig.mockResolvedValue(E.right(buildConfig()));
      await store.reloadConfig('42');

      service.updateCurrencyConfig.mockResolvedValue(
        E.left(new Error('db down'))
      );
      await store.saveCurrencyConfig({ productCurrency: 'VES' });

      expect(store.currencyConfigExists()).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('regression: showCategoriesSection is persisted through updatePartialConfig', () => {
    it('round-trips the new flag without clobbering other fields', async () => {
      service.getConfig.mockResolvedValue(E.right(buildConfig()));
      await store.reloadConfig('42');

      service.updateConfig.mockResolvedValue(E.right(undefined));
      await store.updatePartialConfig({ showCategoriesSection: false });

      const after = store.config()!;
      expect(after.showCategoriesSection).toBe(false);
      // Other fields must stay put — this was the class of bug that caused
      // logo/banner to disappear when a toggle flipped before the DB column
      // existed. Keeping an explicit assertion here so we notice regressions.
      expect(after.logo).toBe('https://img/logo.png');
      expect(after.banner).toBe('https://img/banner.png');
      expect(after.name).toBe('Nortesur');
    });
  });
});
