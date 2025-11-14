import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MediaWatcherService {
  private readonly breakpointObserver = inject(BreakpointObserver);

  public mediaQueryChange$(query: string | string[]): Observable<BreakpointState> {
    return this.breakpointObserver.observe(query);
  }
}
