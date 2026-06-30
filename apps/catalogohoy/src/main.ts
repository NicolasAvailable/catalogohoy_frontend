import { bootstrapApplication } from '@angular/platform-browser';
import { initSentry } from '@catalogohoy/core';
import { environment } from '@catalogohoy/env';
import { appConfig } from './app/app.config';
import { App } from './app/app';

initSentry({ dsn: environment.sentryDsnCatalogohoy, appName: 'catalogohoy' });

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
