import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SuperuserService {
  private readonly STORAGE_KEY = 'superuser_enabled';
  private readonly REQUIRED_TAPS = 10;
  private readonly RESET_TIMEOUT = 1500;

  enabled = signal(this.loadEnabled());

  private taps = 0;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  private loadEnabled(): boolean {
    try {
      return localStorage.getItem(this.STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Handles a tap on the version label.
   * Returns 'enabled' | 'disabled' when the threshold is reached, otherwise null.
   */
  handleVersionTap(): 'enabled' | 'disabled' | null {
    this.taps++;
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      this.taps = 0;
    }, this.RESET_TIMEOUT);

    if (this.taps >= this.REQUIRED_TAPS) {
      this.taps = 0;
      if (this.resetTimer) {
        clearTimeout(this.resetTimer);
        this.resetTimer = null;
      }
      if (this.enabled()) {
        this.disable();
        return 'disabled';
      } else {
        this.enable();
        return 'enabled';
      }
    }
    return null;
  }

  private enable(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, 'true');
    } catch {}
    this.enabled.set(true);
  }

  private disable(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {}
    this.enabled.set(false);
  }
}
