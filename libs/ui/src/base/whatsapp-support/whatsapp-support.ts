import { Component, computed, inject, input, signal, ViewEncapsulation } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'ui-whatsapp-support',
  imports: [LucideAngularModule, TranslocoPipe],
  template: `
    @if (!isHidden()) {
    @if (isOpen()) {
    <div
      class="fixed bottom-28 right-6 z-50 w-88 rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-up"
    >
      <div
        class="bg-primary-500 px-6 py-5 text-white flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <lucide-angular name="headset" class="text-white header-icon" />
          <span class="font-semibold text-lg">{{ 'Soporte' | transloco }}</span>
        </div>
        <button
          (click)="toggle()"
          class="text-white/80 hover:text-white transition-colors cursor-pointer"
        >
          <lucide-angular name="x" [size]="20" />
        </button>
      </div>

      <div class="p-6 pb-8">
        <p class="text-gray-700 text-base leading-relaxed mb-6">
          {{ '¡Hola! Si tienes una duda o necesitas apoyo en algo en particular haz click en el botón de abajo para comunicarte con nosotros.' | transloco }}
        </p>

        <button
          (click)="openWhatsApp()"
          class="mt-4 w-full flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#1fb855] text-white font-semibold py-3.5 px-5 rounded-xl transition-colors cursor-pointer text-base"
        >
          <img src="images/whatsapp.svg" alt="WhatsApp" class="size-7" />
          {{ 'Continuar en WhatsApp' | transloco }}
        </button>

        @if (guideUrl()) {
        <button
          (click)="openGuide()"
          class="mt-3 w-full flex items-center justify-center gap-3 bg-primary-50 hover:bg-primary-100 text-primary-600 font-semibold py-3.5 px-5 rounded-xl transition-colors cursor-pointer text-base"
        >
          <lucide-angular name="headset" class="size-6 shrink-0" />
          {{ 'Guía de ayuda' | transloco }}
        </button>
        }
      </div>
    </div>
    }

    <button
      (click)="toggle()"
      class="fixed right-6 bottom-6 sm:bottom-9 sm:right-9 z-50 size-16 sm:size-18 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-200 cursor-pointer "
    >
      @if (isOpen()) {
      <lucide-angular name="x" class="fab-icon" />
      } @else {
      <lucide-angular name="headset" class="fab-icon" />
      }
    </button>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .animate-fade-in-up {
      animation: fadeInUp 0.2s ease-out;
    }

    ui-whatsapp-support .header-icon svg {
      width: 1.75rem;  /* 28px */
      height: 1.75rem;
    }

    @media (min-width: 640px) {
      ui-whatsapp-support .header-icon svg {
        width: 1.875rem;  /* 30px */
        height: 1.875rem;
      }
    }

    ui-whatsapp-support .fab-icon svg {
      width: 1.75rem;  /* 28px */
      height: 1.75rem;
    }

    @media (min-width: 640px) {
      ui-whatsapp-support .fab-icon svg {
        width: 2.125rem;  /* 34px */
        height: 2.125rem;
      }
    }
  `,
})
export class WhatsappSupportComponent {
  public readonly phoneNumber = input('');
  public readonly defaultMessage = input('');
  public readonly hiddenRoutes = input<string[]>([]);
  /** When set, shows a "Guía de ayuda" button that opens this URL in a new tab. */
  public readonly guideUrl = input('');

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );
  public readonly isHidden = computed(() =>
    this.hiddenRoutes().some((route) => this.url().includes(route))
  );

  public readonly isOpen = signal(false);

  public toggle(): void {
    this.isOpen.update((v) => !v);
  }

  public openWhatsApp(): void {
    const phone = this.phoneNumber().replace(/\D/g, '');
    const message = encodeURIComponent(this.defaultMessage());
    const url = `https://wa.me/${phone}${message ? '?text=' + message : ''}`;
    window.open(url, '_blank');
  }

  public openGuide(): void {
    const url = this.guideUrl();
    if (url) window.open(url, '_blank', 'noopener');
  }
}
