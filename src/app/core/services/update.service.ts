import { Injectable, inject, NgZone } from '@angular/core';
import { ToastService } from '../../shared/components/toast/toast.component';
import { LanguageService } from '../i18n/language.service';

@Injectable({
  providedIn: 'root',
})
export class UpdateService {
  private toast = inject(ToastService);
  private zone = inject(NgZone);
  private languageService = inject(LanguageService);

  constructor() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NEW_VERSION_AVAILABLE') {
        this.zone.run(() => {
          const t = this.languageService.t();
          this.toast.showWithAction(
            t.newVersion,
            {
              label: t.update,
              fn: () => document.location.reload(),
            },
            'info'
          );
        });
      }
    });
  }
}
