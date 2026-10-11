import { Component, inject, OnInit } from '@angular/core';
import { PushService, RevenueCatService } from '@catalogohoy/core';
import { Base } from './layouts';

@Component({
  selector: 'app-layout',
  imports: [Base],
  template: `<app-base />`,
  styleUrl: './layout.css',
})
export default class Layout implements OnInit {
  private readonly push = inject(PushService);
  private readonly revenueCat = inject(RevenueCatService);

  ngOnInit(): void {
    // Registro de push al entrar al admin (autenticado + slug resuelto).
    // No-op en web.
    void this.push.init();
    // Configura RevenueCat (IAP) con el usuario logueado. Solo iOS; no-op en
    // web/Android. Deja el SDK listo para abrir la paywall desde cualquier CTA.
    void this.revenueCat.init();
  }
}
