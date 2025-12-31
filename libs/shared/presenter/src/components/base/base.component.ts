import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UseCaseProgress } from '@shared/application';
import { LoaderStore } from '@shared/infrastructure';

export class BaseComponent {
  public readonly loaderStore = inject(LoaderStore);
  protected readonly destroyRef = inject(DestroyRef);
  public readonly useCaseProgress = UseCaseProgress;

  public unsubscribe = <T>() => takeUntilDestroyed<T>(this.destroyRef);
}
