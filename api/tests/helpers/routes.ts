import type { Express } from 'express';

interface RouteInfo {
  path: string;
  methods: Record<string, boolean>;
}

interface Layer {
  route?: RouteInfo;
  regexp: RegExp;
  handle: { stack?: Layer[] };
}

export interface AppRoute {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
}

const MOUNT_PATTERN = /^\^((?:\\\/[^\\()?]+)*)\\\/\?\(\?=\\\/\|\$\)$/;

const mountPathOf = (layer: Layer): string => {
  const match = MOUNT_PATTERN.exec(layer.regexp.source);
  return match ? match[1].replace(/\\\//g, '/') : '';
};

const walk = (stack: Layer[], prefix: string, found: AppRoute[]): void => {
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        found.push({
          method: method as AppRoute['method'],
          path: `${prefix}${layer.route.path}`.replace(/\/$/, '') || '/',
        });
      }
    } else if (layer.handle.stack) {
      walk(layer.handle.stack, prefix + mountPathOf(layer), found);
    }
  }
};

export const listRoutes = (app: Express): AppRoute[] => {
  const router = (app as unknown as { _router: { stack: Layer[] } })._router;
  const found: AppRoute[] = [];
  walk(router.stack, '', found);
  return found.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
};

export const toOpenApiPath = (path: string): string => path.replace(/:(\w+)/g, '{$1}');

export type Audience = 'public' | 'authenticated' | 'staff' | 'customer';

export const routeLabel = (route: AppRoute): string =>
  `${route.method.toUpperCase()} ${route.path}`;

export const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  'GET /api/health',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'GET /api/dealerships',
  'GET /api/dealerships/:id',
  'GET /api/vehicles',
  'GET /api/vehicles/filters',
  'GET /api/vehicles/:id',
  'GET /api/vehicles/:vehicleId/slots',
]);

export const audienceOf = (route: AppRoute): Audience => {
  if (PUBLIC_ROUTES.has(routeLabel(route))) return 'public';
  if (route.path.startsWith('/api/admin/') || route.path.startsWith('/api/staff')) return 'staff';
  if (route.path.startsWith('/api/bookings')) return 'customer';
  if (/^\/api\/(auth\/me|profile|notifications)/.test(route.path)) return 'authenticated';
  throw new Error(
    `Route ${routeLabel(route)} is not classified: decide whether it is public, authenticated, staff or customer`,
  );
};
