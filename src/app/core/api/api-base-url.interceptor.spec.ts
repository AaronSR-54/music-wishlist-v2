import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Capacitor } from '@capacitor/core';
import { apiBaseUrlInterceptor } from './api-base-url.interceptor';

describe('apiBaseUrlInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('leaves /api requests relative on the web', () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
    http.get('/api/push').subscribe();
    const req = httpMock.expectOne('/api/push');
    expect(req.request.url).toBe('/api/push');
    req.flush({});
  });

  it('prefixes /api requests with the base URL on a native platform', () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    http.get('/api/push').subscribe();
    const req = httpMock.expectOne('https://music-wishlist-v2.vercel.app/api/push');
    expect(req.request.url).toBe(
      'https://music-wishlist-v2.vercel.app/api/push',
    );
    req.flush({});
  });

  it('does not rewrite non-api requests on a native platform', () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    http.get('https://api.deezer.com/artist/1').subscribe();
    const req = httpMock.expectOne('https://api.deezer.com/artist/1');
    expect(req.request.url).toBe('https://api.deezer.com/artist/1');
    req.flush({});
  });
});
