import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { IdentityService } from './identity.service';
import { AUTH_AUTHORITY } from '../api/api-client';

const HQ_ROUTES = [
  '/api/v1/companies',
  '/api/v1/billing',
  '/api/v1/catalog',
  '/api/v1/dev-hub',
  '/api/v1/os-releases',
  '/api/v1/auth/hq'
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const identityService = inject(IdentityService);

  // If calling an API route, attach appropriate authorization token
  if (req.url.startsWith('/api/v1')) {
    const authority = req.context.get(AUTH_AUTHORITY);
    const hqToken = identityService.getHqToken();
    const clientToken = identityService.getClientToken();

    let chosenToken: string | null = null;

    if (authority === 'hq') {
      chosenToken = hqToken;
    } else if (authority === 'client') {
      chosenToken = clientToken;
    } else {
      // Auto-resolution:
      // 1. Check if the URL is an HQ route
      const isHqRoute = HQ_ROUTES.some(route => req.url.startsWith(route)) || req.url.includes('/hq-login');
      // 2. Check if current browser path is in /hq
      const isHqLocation = typeof window !== 'undefined' && window.location.pathname.startsWith('/hq');

      if ((isHqRoute || isHqLocation) && hqToken) {
        chosenToken = hqToken;
      } else {
        chosenToken = clientToken;
      }
    }

    if (chosenToken) {
      const cloned = req.clone({
        setHeaders: {
          Authorization: `Bearer ${chosenToken}`
        }
      });
      return next(cloned);
    }
  }

  return next(req);
};
