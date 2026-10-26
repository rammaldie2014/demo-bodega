import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  isDevMode,
  provideAppInitializer,
} from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { BodegaRepository } from './core/domain/repository';
import { IndexedDbRepository } from './core/infrastructure/indexeddb.repository';
import { BodegaStore } from './core/application/store';
import { Notifications } from './core/application/notifications';
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withPreloading(PreloadAllModules)),
    { provide: BodegaRepository, useFactory: () => new IndexedDbRepository() },
    { provide: ErrorHandler, useExisting: Notifications },
    provideAppInitializer(() => inject(BodegaStore).initialize()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
    }),
  ],
};
