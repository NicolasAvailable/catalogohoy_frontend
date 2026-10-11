import { bootstrapApplication } from '@angular/platform-browser';
import { initSentry } from '@catalogohoy/core';
import { environment } from '@catalogohoy/env';
import { App } from './app/app';
import { appConfig } from './app/app.config';

initSentry({ dsn: environment.sentryDsnInternal, appName: 'internal' });

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
