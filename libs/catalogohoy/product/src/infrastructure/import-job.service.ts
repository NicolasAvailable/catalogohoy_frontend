import { inject, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import {
  ProductImportJob,
  ProductImportJobFailure,
  ProductImportJobProgress,
  ProductImportJobSource,
  ProductImportJobStatus,
} from '../domain';

const COLUMNS =
  'id, source, file_name, status, total, processed, success, errors, skipped, failed, backgrounded, created_at, updated_at, finished_at';
/** Tope de filas fallidas que se guardan (la tabla tiene el mismo CHECK). */
const MAX_FAILED = 200;

function toJob(r: Record<string, unknown>): ProductImportJob {
  return {
    id: String(r['id']),
    source: r['source'] as ProductImportJobSource,
    fileName: (r['file_name'] as string | null) ?? null,
    status: r['status'] as ProductImportJobStatus,
    total: Number(r['total'] ?? 0),
    processed: Number(r['processed'] ?? 0),
    success: Number(r['success'] ?? 0),
    errors: Number(r['errors'] ?? 0),
    skipped: Number(r['skipped'] ?? 0),
    failed: Array.isArray(r['failed'])
      ? (r['failed'] as ProductImportJobFailure[])
      : [],
    backgrounded: !!r['backgrounded'],
    createdAt: String(r['created_at']),
    updatedAt: String(r['updated_at']),
    finishedAt: (r['finished_at'] as string | null) ?? null,
  };
}

function trimFailed(failed?: ProductImportJobFailure[]) {
  return (failed ?? []).slice(0, MAX_FAILED).map((f) => ({
    name: String(f.name ?? '').slice(0, 200),
    error: String(f.error ?? '').slice(0, 300),
  }));
}

/** Registro de imports en segundo plano (`product_import_jobs`) + correo de
 *  resumen (edge `send-import-summary`). Todo es best-effort: si falla, el
 *  import sigue igual (solo se pierde el aviso). */
@Injectable({ providedIn: 'root' })
export class ImportJobService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);

  public async start(input: {
    source: ProductImportJobSource;
    fileName: string | null;
    total: number;
  }): Promise<E.Either<Error, string>> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return E.left(new Error('No tenant'));
    const { data, error } = await this.client
      .from('product_import_jobs')
      .insert({
        tenant_id: tenantId,
        source: input.source,
        file_name: input.fileName?.slice(0, 200) ?? null,
        total: input.total,
      })
      .select('id')
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(String(data.id));
  }

  public async progress(
    id: string,
    p: ProductImportJobProgress
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('product_import_jobs')
      .update({
        processed: p.processed,
        success: p.success,
        errors: p.errors,
        skipped: p.skipped ?? 0,
        failed: trimFailed(p.failed),
      })
      .eq('id', id);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  /** Cierra el job. `seen` = el usuario vio el resultado en el modal, así que
   *  no hace falta mostrarlo de nuevo en Productos. */
  public async finish(
    id: string,
    p: ProductImportJobProgress & {
      status: 'done' | 'cancelled';
      backgrounded: boolean;
      seen: boolean;
    }
  ): Promise<E.Either<Error, ProductImportJob>> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from('product_import_jobs')
      .update({
        status: p.status,
        processed: p.processed,
        success: p.success,
        errors: p.errors,
        skipped: p.skipped ?? 0,
        failed: trimFailed(p.failed),
        backgrounded: p.backgrounded,
        finished_at: now,
        dismissed_at: p.seen ? now : null,
      })
      .eq('id', id)
      .select(COLUMNS)
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(toJob(data));
  }

  /** Último import sin descartar (de los últimos 7 días) de este usuario en
   *  esta tienda, para el aviso de Productos. */
  public async latestUnseen(): Promise<E.Either<Error, ProductImportJob | null>> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return E.right(null);
    const { data: auth } = await this.client.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return E.right(null);
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data, error } = await this.client
      .from('product_import_jobs')
      .select(COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', uid)
      .is('dismissed_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return E.left(new Error(error.message));
    return E.right(data?.[0] ? toJob(data[0]) : null);
  }

  public async dismiss(id: string): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('product_import_jobs')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  /** Correo con el resumen al usuario que importó (una sola vez por job). */
  public async sendSummaryEmail(id: string): Promise<E.Either<Error, void>> {
    try {
      const { error } = await this.client.functions.invoke(
        'send-import-summary',
        { body: { jobId: id } }
      );
      if (error) return E.left(new Error(error.message));
      return E.right(undefined);
    } catch (e) {
      return E.left(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
