import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '@ui';
import { AuthenticationFacade } from '../../../application';

/**
 * Página de callback de la verificación de correo. Supabase redirige aquí tras
 * el clic en el link del email, con los tokens en el fragment de la URL. Acá
 * establecemos la sesión y redirigimos al admin del tenant del usuario.
 */
@Component({
  selector: 'app-confirm-email',
  imports: [ButtonComponent],
  templateUrl: './confirm-email.html',
})
export class ConfirmEmail implements OnInit {
  private readonly facade = inject(AuthenticationFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  public readonly state = signal<'loading' | 'error'>('loading');
  public readonly message = signal<string>('Verificando tu correo…');

  private processing = false;

  ngOnInit(): void {
    this.route.fragment.subscribe((fragment) => this.handle(fragment));
  }

  private async handle(fragment: string | null): Promise<void> {
    if (this.processing) return;
    const params = new URLSearchParams(fragment ?? '');

    if (params.get('error')) {
      this.fail('El enlace de verificación expiró o no es válido.');
      return;
    }
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token') ?? '';
    if (!accessToken) {
      this.fail('No pudimos verificar tu correo. Iniciá sesión para continuar.');
      return;
    }

    this.processing = true;
    const result = await this.facade.confirmEmail(accessToken, refreshToken);
    result
      .mapRight((url) => {
        window.location.href = url; // al admin del tenant (cross-app)
      })
      .mapLeft(() => {
        this.processing = false;
        this.fail('No pudimos completar la verificación. Iniciá sesión.');
      });
  }

  private fail(msg: string): void {
    this.state.set('error');
    this.message.set(msg);
  }

  public goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
