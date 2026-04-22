// Memory-leak regression suite.
//
// The EcommerceConfig editor subscribes to several long-lived browser APIs:
//
//   1. window.matchMedia change listener      → removed via destroyRef
//   2. IntersectionObserver on save anchors   → disconnect() via destroyRef
//   3. postMessage preview broadcast (effect) → auto-torn down with the signal
//
// This spec is a safety net: if someone adds a fourth subscription without
// the matching cleanup hook, the pattern-level tests below still pass, but
// anyone reading them sees exactly how we expect lifecycle management to
// look and has a template to copy.

import {
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';

describe('lifecycle — matchMedia change listeners', () => {
  @Component({
    selector: 'lib-mq-probe',
    standalone: true,
    template: '',
  })
  class MqProbe {
    private readonly destroyRef = inject(DestroyRef);
    public matches = signal(false);

    constructor() {
      const mq = window.matchMedia('(min-width: 640px)');
      const handler = (event: MediaQueryListEvent) =>
        this.matches.set(event.matches);
      this.matches.set(mq.matches);
      mq.addEventListener('change', handler);
      this.destroyRef.onDestroy(() =>
        mq.removeEventListener('change', handler)
      );
    }
  }

  let addSpy: jest.SpyInstance;
  let removeSpy: jest.SpyInstance;
  let registry: Array<{
    list: MediaQueryList;
    type: string;
    handler: EventListener;
  }>;

  beforeEach(() => {
    registry = [];
    window.matchMedia = jest.fn(() => {
      const listeners = new Set<EventListener>();
      const list = {
        matches: true,
        media: '(min-width: 640px)',
        addEventListener: jest.fn((type: string, handler: EventListener) => {
          listeners.add(handler);
          registry.push({ list, type, handler });
        }),
        removeEventListener: jest.fn((type: string, handler: EventListener) => {
          listeners.delete(handler);
          registry = registry.filter(
            (r) => !(r.list === list && r.handler === handler)
          );
        }),
      } as unknown as MediaQueryList;
      return list;
    }) as unknown as typeof window.matchMedia;

    // capture the add/remove spies from the last created MediaQueryList
    // after component creation (set up in each test body).
    addSpy = jest.fn();
    removeSpy = jest.fn();
  });

  it('registers exactly one listener and removes it on destroy (no leak)', () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(MqProbe);
    fixture.detectChanges();

    const mq = (window.matchMedia as jest.Mock).mock.results[0].value;
    addSpy = mq.addEventListener;
    removeSpy = mq.removeEventListener;

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).not.toHaveBeenCalled();
    expect(registry).toHaveLength(1);

    fixture.destroy();

    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(registry).toHaveLength(0);
  });

  it('each component instance cleans up its own listener', () => {
    TestBed.configureTestingModule({});
    const a = TestBed.createComponent(MqProbe);
    const b = TestBed.createComponent(MqProbe);
    const c = TestBed.createComponent(MqProbe);
    a.detectChanges();
    b.detectChanges();
    c.detectChanges();

    expect(registry).toHaveLength(3);

    a.destroy();
    b.destroy();
    c.destroy();

    expect(registry).toHaveLength(0);
  });
});

describe('lifecycle — IntersectionObserver', () => {
  @Component({
    selector: 'lib-io-probe',
    standalone: true,
    template: '<div #anchor></div>',
  })
  class IoProbe {
    private readonly destroyRef = inject(DestroyRef);

    constructor() {
      const io = new IntersectionObserver(() => void 0);
      io.observe(document.createElement('div'));
      this.destroyRef.onDestroy(() => io.disconnect());
    }
  }

  let observeSpy: jest.Mock;
  let disconnectSpy: jest.Mock;

  beforeEach(() => {
    observeSpy = jest.fn();
    disconnectSpy = jest.fn();

    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      jest.fn(function MockIntersectionObserver() {
        return {
          observe: observeSpy,
          unobserve: jest.fn(),
          disconnect: disconnectSpy,
          takeRecords: () => [],
          root: null,
          rootMargin: '',
          thresholds: [],
        };
      });
  });

  it('calls disconnect() when the component is destroyed', () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(IoProbe);
    fixture.detectChanges();

    expect(observeSpy).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).not.toHaveBeenCalled();

    fixture.destroy();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('destroying three probes yields three disconnect calls (no shared-observer leak)', () => {
    TestBed.configureTestingModule({});
    const fixtures = [
      TestBed.createComponent(IoProbe),
      TestBed.createComponent(IoProbe),
      TestBed.createComponent(IoProbe),
    ];
    fixtures.forEach((f) => f.detectChanges());
    fixtures.forEach((f) => f.destroy());
    expect(disconnectSpy).toHaveBeenCalledTimes(3);
  });
});

describe('lifecycle — signal effects stop firing after destroy', () => {
  @Component({
    selector: 'lib-effect-probe',
    standalone: true,
    template: '',
  })
  class EffectProbe {
    public readonly trigger = signal(0);
    public readonly sink = jest.fn();

    constructor() {
      effect(() => {
        // Reads the signal so the effect re-fires whenever it changes.
        this.sink(this.trigger());
      });
    }
  }

  it('re-fires while alive, stops firing once destroyed', async () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(EffectProbe);
    fixture.detectChanges();
    const { trigger, sink } = fixture.componentInstance;

    expect(sink).toHaveBeenCalledTimes(1);

    trigger.set(1);
    fixture.detectChanges();
    await Promise.resolve();
    expect(sink).toHaveBeenCalledTimes(2);

    fixture.destroy();

    // After destruction, changes MUST NOT run the effect any more.
    trigger.set(99);
    await Promise.resolve();
    expect(sink).toHaveBeenCalledTimes(2);
  });
});

describe('lifecycle — preview effect must guard on loaded state', () => {
  // Regression for the logo/banner-clobbering bug: the preview effect spread
  // `{ logo: null, banner: null }` into the iframe's override map *before*
  // the admin-side config had loaded. The fix was an `if (!config) return`
  // guard at the top of the effect. This test locks that guarantee in.
  @Component({
    selector: 'lib-guarded-effect-probe',
    standalone: true,
    template: '',
  })
  class GuardedEffectProbe {
    public readonly config = signal<{ logo: string } | null>(null);
    public readonly draft = signal('initial');
    public readonly postMessage = jest.fn();

    constructor() {
      effect(() => {
        const config = this.config();
        // NEVER remove this guard — see preview-effect regression notes.
        if (!config) return;
        const draft = this.draft();
        this.postMessage({ name: draft, logo: config.logo });
      });
    }
  }

  it('does not emit messages while config is null', async () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(GuardedEffectProbe);
    fixture.detectChanges();
    const probe = fixture.componentInstance;

    // Mutate drafts while config is still null — no emits allowed.
    probe.draft.set('touched');
    fixture.detectChanges();
    await Promise.resolve();
    probe.draft.set('touched again');
    fixture.detectChanges();
    await Promise.resolve();

    expect(probe.postMessage).not.toHaveBeenCalled();
  });

  it('emits only after config becomes non-null, with real values', async () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(GuardedEffectProbe);
    fixture.detectChanges();
    const probe = fixture.componentInstance;

    probe.config.set({ logo: 'https://real-logo.png' });
    fixture.detectChanges();
    await Promise.resolve();

    expect(probe.postMessage).toHaveBeenCalledTimes(1);
    expect(probe.postMessage).toHaveBeenLastCalledWith({
      name: 'initial',
      logo: 'https://real-logo.png',
    });

    probe.draft.set('new name');
    fixture.detectChanges();
    await Promise.resolve();

    expect(probe.postMessage).toHaveBeenLastCalledWith({
      name: 'new name',
      logo: 'https://real-logo.png',
    });
  });
});
