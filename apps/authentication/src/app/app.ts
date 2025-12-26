import { Component, inject } from '@angular/core';
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
export class App {
  private readonly subscriber = inject(AppSubscriber);

  constructor() {
    SupabaseClientProvider.create();
    this.subscriber.init();
  }
}
