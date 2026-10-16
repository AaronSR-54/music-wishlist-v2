import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';
import { apiUrl } from './api-url';

describe('apiUrl', () => {
  let originalBase: string;

  beforeEach(() => {
    originalBase = environment.apiBaseUrl;
  });

  afterEach(() => {
    environment.apiBaseUrl = originalBase;
  });

  it('leaves /api paths relative on the web', () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
    expect(apiUrl('/api/search?q=test')).toBe('/api/search?q=test');
  });

  it('prefixes /api paths with the base URL on a native platform', () => {
    environment.apiBaseUrl = 'https://music-wishlist-v2.vercel.app';
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    expect(apiUrl('/api/search?q=test')).toBe(
      'https://music-wishlist-v2.vercel.app/api/search?q=test',
    );
  });

  it('leaves /api paths unchanged on native when no base URL is configured', () => {
    environment.apiBaseUrl = '';
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    expect(apiUrl('/api/preview?url=abc')).toBe('/api/preview?url=abc');
  });

  it('does not rewrite absolute or non-api URLs on a native platform', () => {
    environment.apiBaseUrl = 'https://music-wishlist-v2.vercel.app';
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    expect(apiUrl('https://api.deezer.com/artist/1')).toBe(
      'https://api.deezer.com/artist/1',
    );
    expect(apiUrl('/version.json')).toBe('/version.json');
  });
});
