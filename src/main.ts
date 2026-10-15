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

    try {
      // Remove any legacy Angular service worker (ngsw-worker.js) so that a
      // single service worker owns the push/notification handlers. Installed
      // PWAs may still have one registered from an earlier build.
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter((reg) => {
            const script =
              reg.active?.scriptURL ??
              reg.installing?.scriptURL ??
              reg.waiting?.scriptURL ??
              '';
            return script.includes('ngsw-worker.js');
          })
          .map((reg) => reg.unregister()),
      );

      await navigator.serviceWorker.register(swUrl);
    } catch (err) {
      console.log('Service Worker registration failed', err);
    }
  })
  .catch((err) => console.error(err));
