import { Component, inject, OnInit } from '@angular/core';
import { Base } from './layouts';
import { PushService } from '../mobile/push.service';

@Component({
  selector: 'app-layout',
  imports: [Base],
  template: `<app-base />`,
  styleUrl: './layout.css',
})
export default class Layout implements OnInit {
  private readonly push = inject(PushService);

  ngOnInit(): void {
    // Registro de push al entrar al admin (autenticado + slug resuelto).
    // No-op en web.
    void this.push.init();
  }
}
