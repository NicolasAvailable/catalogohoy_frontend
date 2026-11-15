// Compra de créditos: en la app nativa NUNCA se ofrece Stripe (Apple 3.1.1);
// se muestran los paquetes de la tienda (RevenueCat) y se compra in-app.
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ToastService } from '@shared/infrastructure';
import { LoaderCircle, LUCIDE_ICONS, LucideIconProvider, Minus, Plus, Sparkles } from 'lucide-angular';

let native = false;
const revenueCat = {
  getCreditPacks: jest.fn(),
  purchaseCreditPack: jest.fn(),
};

// Transloco es ESM y el jest del repo no lo transforma: pipe identidad que
// interpola {param} (los textos fuente ya están en español).
jest.mock('@jsverse/transloco', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pipe } = require('@angular/core');
  class TranslocoPipe {
    transform(key: string, params?: Record<string, unknown>) {
      return key.replace(/\{(\w+)\}/g, (_m: string, k: string) => String(params?.[k] ?? ''));
    }
  }
  Pipe({ name: 'transloco', standalone: true })(TranslocoPipe);
  return { TranslocoPipe };
});

jest.mock('@catalogohoy/core', () => ({
  isNativeApp: () => native,
  RevenueCatService: class RevenueCatService {},
}));

// eslint-disable-next-line @nx/enforce-module-boundaries
import { RevenueCatService } from '@catalogohoy/core';
import { CreditsStore } from '../../../infrastructure';
import { CreditsWidgetComponent } from './credits-widget';

const pack = (credits: number, price: string) => ({
  id: `ch_credits_${credits}`,
  credits,
  priceString: price,
  product: { identifier: `ch_credits_${credits}` },
});

async function render(isNative: boolean) {
  native = isNative;
  const balance = signal<number | null>(120);
  const store = {
    balance,
    load: jest.fn(async () => undefined),
    buyCredits: jest.fn(),
    confirmPurchase: jest.fn(),
  };
  const toast = { success: jest.fn(), error: jest.fn() };
  await TestBed.configureTestingModule({
    imports: [
      CreditsWidgetComponent,
    ],
    providers: [
      provideNoopAnimations(),
      {
        provide: LUCIDE_ICONS,
        multi: true,
        useValue: new LucideIconProvider({ Sparkles, Minus, Plus, LoaderCircle }),
      },
      { provide: CreditsStore, useValue: store },
      { provide: ToastService, useValue: toast },
      { provide: RevenueCatService, useValue: revenueCat },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map() } } },
      { provide: Router, useValue: { navigate: jest.fn() } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(CreditsWidgetComponent);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, store, toast, balance };
}

const settle = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
  for (let i = 0; i < 3; i++) {
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
  }
};

describe('CreditsWidget', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    jest.clearAllMocks();
    revenueCat.getCreditPacks.mockResolvedValue([
      pack(150, '$2.99'),
      pack(500, '$9.99'),
      pack(1000, '$19.99'),
      pack(2000, '$38.99'),
    ]);
  });

  it('web: muestra el armado libre y el botón de pago con Stripe', async () => {
    const { fixture, cmp } = await render(false);
    cmp.open();
    await settle(fixture);
    const text = document.body.textContent ?? '';
    expect(text).toContain('Continuar al pago');
    expect(revenueCat.getCreditPacks).not.toHaveBeenCalled();
  });

  it('app nativa: muestra los 4 paquetes de la tienda y NO el pago con Stripe', async () => {
    const { fixture, cmp } = await render(true);
    cmp.open();
    await settle(fixture);
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('Continuar al pago');
    for (const p of ['$2.99', '$9.99', '$19.99', '$38.99']) expect(text).toContain(p);
    expect(cmp.packs()?.map((p) => p.credits)).toEqual([150, 500, 1000, 2000]);
  });

  it('app nativa sin productos en la tienda: avisa que no están disponibles', async () => {
    revenueCat.getCreditPacks.mockResolvedValue([]);
    const { fixture, cmp } = await render(true);
    cmp.open();
    await settle(fixture);
    expect(document.body.textContent).toContain('no están disponibles');
    expect(document.body.textContent).not.toContain('Continuar al pago');
  });

  it('compra in-app: espera a que el webhook sume el saldo y avisa', async () => {
    jest.useFakeTimers();
    const { cmp, store, toast, balance } = await render(true);
    revenueCat.purchaseCreditPack.mockResolvedValue({ ok: true, cancelled: false });
    store.load.mockImplementation(async () => {
      balance.set(620);
    });
    const p = cmp.buyPack(pack(500, '$9.99') as never);
    await jest.advanceTimersByTimeAsync(2000);
    await p;
    expect(revenueCat.purchaseCreditPack).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('¡500 créditos agregados!');
    expect(cmp.buyingId()).toBeNull();
    jest.useRealTimers();
  });

  it('compra cancelada por el usuario: no muestra error ni recarga', async () => {
    const { cmp, store, toast } = await render(true);
    revenueCat.purchaseCreditPack.mockResolvedValue({ ok: false, cancelled: true });
    store.load.mockClear(); // ngOnInit ya cargó el saldo una vez
    await cmp.buyPack(pack(150, '$2.99') as never);
    expect(toast.error).not.toHaveBeenCalled();
    expect(store.load).not.toHaveBeenCalled();
    expect(cmp.buyingId()).toBeNull();
  });
});
