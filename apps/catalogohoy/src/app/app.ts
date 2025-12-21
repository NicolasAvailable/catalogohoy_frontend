import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected title = 'catalogohoy';

  ngOnInit(): void {
    this.captureQueryParametersToLocalStorage();
  }

  private captureQueryParametersToLocalStorage(): void {
    const urlParams = new URLSearchParams(window.location.search);

    // Store each query parameter in localStorage
    urlParams.forEach((value, key) => {
      console.log('key', key);
      console.log('value', value);
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
