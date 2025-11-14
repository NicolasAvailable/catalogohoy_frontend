import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LoaderStore } from '@shared/infrastructure';

export class BaseComponent {
  public readonly loaderStore = inject(LoaderStore);
  protected readonly destroyRef = inject(DestroyRef);

  public unsubscribe = <T>() => takeUntilDestroyed<T>(this.destroyRef);
}
