import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(async () => {
    if (!('serviceWorker' in navigator)) return;

    // Version the service worker script URL so every release triggers a new
    // install/activate cycle and purges the previous cache.
    let version = '';
    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (res.ok) version = (await res.json()).version ?? '';
    } catch {
      // Offline: register the default script.
    }

    const swUrl = version
      ? `/service-worker.js?v=${encodeURIComponent(version)}`
      : '/service-worker.js';

    navigator.serviceWorker
      .register(swUrl)
      .catch((err) => console.log('Service Worker registration failed', err));
  })
  .catch((err) => console.error(err));
