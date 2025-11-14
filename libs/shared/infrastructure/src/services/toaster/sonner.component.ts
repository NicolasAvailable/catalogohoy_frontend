import { Component, input, ViewEncapsulation } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { toast } from 'ngx-sonner';

@Component({
  selector: 'app-sonner',
  imports: [LucideAngularModule],
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      [data-sonner-toaster] {
        width: 28rem !important;
      }

      @media (min-width: 1200px) {
        [data-sonner-toaster] {
          width: 30rem !important;
        }
      }

      [data-sonner-toast]:has(.custom-toast) {
        width: 100%;
        border-radius: 0.625rem;
        background-color: #fff;
        box-shadow: 0 1px 1rem 0 #00000040;
        overflow: hidden;
      }
    `,
  ],
  template: `
    <section
      class="custom-toast h-full grid grid-cols-[auto_1fr_auto] items-center gap-5 px-4 py-3 border-l-[13px]"
      [style.borderLeftColor]="color()"
    >
      <div class="w-12 h-12 rounded-full flex items-center justify-center" [style.background]="blur()">
        <lucide-icon [name]="icon()" size="30" [color]="color()"></lucide-icon>
      </div>
      <div>
        <p class="text-balance text-grey-800! font-sans! text-base! font-medium!">{{ message() }}</p>
      </div>
      <div>
        <lucide-icon (click)="close()" name="x" size="22" color="#73757B" class=" cursor-pointer"></lucide-icon>
      </div>
    </section>
  `,
})
export class SonnerComponent {
  public readonly id = input.required<string>();
  public readonly icon = input.required<string>();
  public readonly color = input.required<string>();
  public readonly blur = input.required<string>();
  public readonly message = input.required<string>();

  public close() {
    toast.dismiss(this.id());
  }
}
