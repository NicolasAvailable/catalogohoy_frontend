import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import {
  BaseEnterpriseLeadService,
  EnterpriseLeadPayload,
  EnterpriseLeadResult,
} from '../domain';

@Injectable({ providedIn: 'root' })
export class EnterpriseLeadService implements BaseEnterpriseLeadService {
  private readonly client = SupabaseClientProvider.getInstance();

  public async submit(
    payload: EnterpriseLeadPayload
  ): Promise<E.Either<Error, EnterpriseLeadResult>> {
    const { data, error } = await this.client.functions.invoke<{
      success: boolean;
      qualified: boolean;
      score: number;
    }>('enterprise-lead', { body: payload });

    if (error) return E.left(new Error(error.message));
    if (!data?.success) return E.left(new Error('No se pudo enviar el lead'));

    return E.right({ qualified: data.qualified, score: data.score });
  }
}
