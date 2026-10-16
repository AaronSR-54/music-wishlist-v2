import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';

const API_PREFIX = '/api/';

export function apiUrl(path: string): string {
  const base = environment.apiBaseUrl;
  if (!base || !Capacitor.isNativePlatform() || !path.startsWith(API_PREFIX)) {
    return path;
  }
  return `${base}${path}`;
}
