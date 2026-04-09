import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { NgxSonnerToaster } from 'ngx-sonner';
import { AppSubscriber } from './app.subscriber';
import { ThemeStore } from './modules/theme/theme.store';

@Component({
  imports: [RouterModule, NgxSonnerToaster],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly subscriber = inject(AppSubscriber);
  private readonly themeStore = inject(ThemeStore);

  constructor() {
    SupabaseClientProvider.create();
    this.subscriber.init();
    this.themeStore.init();
  }
}
