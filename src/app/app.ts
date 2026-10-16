import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { UpdateService } from './core/services/update.service';
import { NativeShellService } from './core/native/native-shell.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  template: `
    <router-outlet />
    <app-toast-container />
  `,
  styles: [`:host { display: block; height: 100%; }`]
})
export class App {
  constructor() {
    inject(ThemeService);
    inject(UpdateService);
    inject(NativeShellService);
  }
}
