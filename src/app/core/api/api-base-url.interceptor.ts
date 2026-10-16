import { HttpInterceptorFn } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';

const API_PREFIX = '/api/';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const base = environment.apiBaseUrl;
  if (!base || !Capacitor.isNativePlatform() || !req.url.startsWith(API_PREFIX)) {
    return next(req);
  }
  return next(req.clone({ url: `${base}${req.url}` }));
};
