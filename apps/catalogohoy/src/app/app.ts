import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  MetaPixelService,
  PosthogService,
  SupabaseClientProvider,
} from '@catalogohoy/core';
import { NgxSonnerToaster } from 'ngx-sonner';
import { AppSubscriber } from './app.subscriber';

@Component({
  imports: [RouterModule, NgxSonnerToaster],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly subscriber = inject(AppSubscriber);
  // La inyección del servicio dispara su constructor (init + router tracking)
  readonly posthog = inject(PosthogService);
  readonly metaPixel = inject(MetaPixelService);

  constructor() {
    this.captureQueryParametersToLocalStorage();
    SupabaseClientProvider.create();
    this.subscriber.init();
  }

  protected title = 'catalogohoy';

  ngOnInit(): void {}

  /** Keys que NO se mueven a localStorage al inicio: tienen que quedar
   *  visibles en la URL porque otras partes de la app los leen vía
   *  `route.snapshot.queryParamMap` (deep-links). El resto sigue el
   *  comportamiento original — se persiste en localStorage para futuras
   *  navegaciones internas y se limpia de la URL. */
  private static readonly QUERY_PARAMS_KEEP_IN_URL = new Set(['product']);

  private captureQueryParametersToLocalStorage(): void {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.toString() === '') return;

    const keepInUrl = new URLSearchParams();

    urlParams.forEach((value, key) => {
      if (App.QUERY_PARAMS_KEEP_IN_URL.has(key)) {
        keepInUrl.append(key, value);
      } else {
        localStorage.setItem(key, value);
      }
    });

    const currentSearch = window.location.search.replace(/^\?/, '');
    const newSearch = keepInUrl.toString();
    if (currentSearch !== newSearch) {
      const url = new URL(window.location.href);
      url.search = newSearch;
      window.history.replaceState({}, '', url.toString());
    }
  }
}
