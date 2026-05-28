import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';

export interface ImpersonationLink {
  actionLink: string;
  slug: string;
  ownerEmail: string;
}

@Injectable({ providedIn: 'root' })
export class ImpersonateTenantService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getImpersonationLink(
    tenantId: number
  ): Promise<Either<Error, ImpersonationLink>> {
    const { data, error } = await this.client.functions.invoke<ImpersonationLink>(
      'impersonate-tenant',
      { body: { tenantId } }
    );

    if (error) {
      return E.left(new Error(error.message ?? 'No se pudo generar el enlace'));
    }
    if (!data?.actionLink) {
      return E.left(new Error('Respuesta inválida del servidor'));
    }
    return E.right(data);
  }
}
