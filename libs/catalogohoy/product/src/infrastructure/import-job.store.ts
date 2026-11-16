import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { ProductImportJob } from '../domain';
import { ImportJobService } from './import-job.service';

/** Aviso de Productos con el resultado del último import en segundo plano
 *  (o de uno que se cortó porque se cerró la app a mitad de camino). */
export const ImportJobStore = signalStore(
  { providedIn: 'root' },
  withState({
    latest: null as ProductImportJob | null,
    /** Job que está corriendo en ESTE navegador (pausado incluido): el aviso
     *  de Productos no lo marca como "interrumpido". */
    activeJobId: null as string | null,
  }),
  withMethods((store, service = inject(ImportJobService)) => ({
    async load(): Promise<void> {
      const result = await service.latestUnseen();
      result.mapRight((job) => patchState(store, { latest: job }));
    },
    setActive(id: string | null): void {
      patchState(store, { activeJobId: id });
    },
    setLatest(job: ProductImportJob | null): void {
      patchState(store, { latest: job });
    },
    async dismiss(): Promise<void> {
      const job = store.latest();
      if (!job) return;
      patchState(store, { latest: null });
      await service.dismiss(job.id);
    },
  }))
);
