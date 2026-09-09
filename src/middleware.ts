/**
 * T10.8 — security headers.
 *
 * Headers only: this runs on the edge runtime, where Prisma cannot, so
 * authentication is enforced in the route handlers and server components
 * instead (see src/lib/authz.ts). Putting an auth check here as well would mean
 * maintaining a second, weaker copy of the rules.
 */
import { NextResponse, type NextRequest } from 'next/server';

/**
 * The map needs more than a locked-down default allows: tiles come from a
 * third-party host, MapLibre renders through a blob: worker, and photos are
 * served from R2. Everything else is closed.
 *
 * `'unsafe-inline'` for scripts is Next's hydration bootstrap. Removing it
 * needs per-request nonces threaded through the whole app; it is worth doing
 * before this handles anything sensitive, and it is noted in the runbook rather
 * than quietly skipped.
 */
/**
 * Next's development server serves modules through `eval` for hot reloading, so
 * a production-grade `script-src` silently breaks every client component in
 * development — the page renders, and nothing responds to a tap.
 */
const scriptSrc =
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const CSP = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set('content-security-policy', CSP);
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  // The app asks for geolocation and the camera; nothing else, and nothing at
  // all from an embedded frame.
  response.headers.set(
    'permissions-policy',
    'geolocation=(self), camera=(self), microphone=(), payment=(), interest-cohort=()',
  );

  // Railway terminates TLS in front of the container, so HSTS is only
  // meaningful once the request actually arrived over HTTPS.
  if (request.headers.get('x-forwarded-proto') === 'https') {
    response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  }

  return response;
}

export const config = {
  // Static assets are served straight from the CDN edge and need none of this.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/).*)'],
};
