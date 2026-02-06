import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SupabaseClientProvider } from '@catalogohoy/core';
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

  constructor() {
    SupabaseClientProvider.create();
    this.subscriber.init();
  }
  protected title = 'catalogohoy';

  ngOnInit(): void {
    this.captureQueryParametersToLocalStorage();
  }

  private captureQueryParametersToLocalStorage(): void {
    const urlParams = new URLSearchParams(window.location.search);

    // Store each query parameter in localStorage
    urlParams.forEach((value, key) => {
      localStorage.setItem(key, value);
    });

    // Clean up URL by removing all query parameters
    if (urlParams.toString()) {
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, '', url.toString());
    }
  }
}
