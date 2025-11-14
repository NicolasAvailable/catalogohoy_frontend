import { Directive, ElementRef, HostListener, input, OnDestroy, Renderer2, signal } from '@angular/core';

@Directive({ selector: '[appDisableTimer]', exportAs: 'appDisableTimer' })
export class DisableTimerDirective implements OnDestroy {
  public static readonly timerSpeed = 1000;

  public readonly appDisableTimer = input.required<number>();
  public readonly time = signal(0);

  private intervalId: unknown | undefined;

  constructor(private readonly el: ElementRef, private readonly renderer: Renderer2) {}

  public isDisabled() {
    return this.el.nativeElement.classList.contains('disabled-directive');
  }

  @HostListener('click', ['$event'])
  onClick() {
    if (this.isDisabled()) return;

    this.disable();
    this.time.set(this.appDisableTimer());
    this.intervalId = setInterval(() => {
      this.time.set(this.time() - 1);
      if (this.time() <= 0) {
        this.enable();
        clearInterval(this.intervalId as number);
      }
    }, DisableTimerDirective.timerSpeed);
  }

  private disable() {
    this.renderer.addClass(this.el.nativeElement, 'disabled-directive');
    this.renderer.addClass(this.el.nativeElement, 'opacity-50');
    this.renderer.setStyle(this.el.nativeElement, 'pointer-events', 'none');
  }

  private enable() {
    this.renderer.removeClass(this.el.nativeElement, 'disabled-directive');
    this.renderer.removeClass(this.el.nativeElement, 'opacity-50');
    this.renderer.removeStyle(this.el.nativeElement, 'pointer-events');
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId as number);
    }
  }
}
