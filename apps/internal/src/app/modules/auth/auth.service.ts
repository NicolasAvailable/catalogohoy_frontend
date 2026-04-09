import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { ALLOWED_ADMIN_EMAILS } from './auth.constants';

export interface AuthSession {
  email: string;
  userId: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = SupabaseClientProvider.getInstance();

  async login(
    email: string,
    password: string
  ): Promise<Either<Error, AuthSession>> {
    if (!ALLOWED_ADMIN_EMAILS.includes(email.toLowerCase().trim())) {
      return E.left(new Error('No tenés permiso para acceder a este panel.'));
    }

    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return E.left(new Error(this.translateError(error.message)));
    }

    if (!data.user || !data.user.email) {
      return E.left(new Error('No se pudo iniciar sesión.'));
    }

    return E.right({ email: data.user.email, userId: data.user.id });
  }

  async getSession(): Promise<AuthSession | null> {
    const {
      data: { session },
    } = await this.client.auth.getSession();

    if (!session?.user?.email) return null;

    if (!ALLOWED_ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
      await this.client.auth.signOut();
      return null;
    }

    return { email: session.user.email, userId: session.user.id };
  }

  async logout(): Promise<Either<Error, void>> {
    const { error } = await this.client.auth.signOut();
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  private translateError(message: string): string {
    if (message.toLowerCase().includes('invalid login credentials')) {
      return 'Correo o contraseña incorrectos.';
    }
    if (message.toLowerCase().includes('email not confirmed')) {
      return 'El correo no está confirmado.';
    }
    return message;
  }
}
