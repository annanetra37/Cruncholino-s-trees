/**
 * Shared HTTP plumbing for the route handlers: consistent error shapes, a
 * request id on every response, and one place that turns a thrown error into a
 * status code.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string = 'error',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, message, 'bad_request', details);
export const unauthorized = (message = 'Sign in to continue') =>
  new ApiError(401, message, 'unauthorized');
export const forbidden = (message = 'You do not have permission to do that') =>
  new ApiError(403, message, 'forbidden');
export const notFound = (message = 'Not found') => new ApiError(404, message, 'not_found');
export const tooManyRequests = (message = 'Slow down a moment') =>
  new ApiError(429, message, 'rate_limited');

export function requestId(request: Request): string {
  return (
    request.headers.get('x-request-id') ??
    request.headers.get('x-railway-request-id') ??
    crypto.randomUUID()
  );
}

export function json<T>(body: T, init?: ResponseInit & { requestId?: string }) {
  const response = NextResponse.json(body, init);
  if (init?.requestId) response.headers.set('x-request-id', init.requestId);
  return response;
}

/**
 * Field-level validation errors, keyed by dotted path, so a form can render
 * each message next to the input that caused it (T3.1).
 */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

type Handler = (request: Request, context: RouteContext) => Promise<Response> | Response;
export type RouteContext = { params: Promise<Record<string, string>> };

/**
 * Wraps a route handler so every failure leaves the same trace: a logged line
 * with the request id, and a JSON body the client can rely on.
 */
export function route(name: string, handler: Handler): Handler {
  return async (request, context) => {
    const id = requestId(request);
    const log = logger.child({ requestId: id, route: name, method: request.method });
    const startedAt = Date.now();

    try {
      const response = await handler(request, context);
      response.headers.set('x-request-id', id);
      log.info('request completed', { status: response.status, durationMs: Date.now() - startedAt });
      return response;
    } catch (error) {
      if (error instanceof z.ZodError) {
        log.warn('validation failed', { durationMs: Date.now() - startedAt });
        return json(
          { error: 'Validation failed', code: 'validation_failed', fields: fieldErrors(error) },
          { status: 422, requestId: id },
        );
      }

      if (error instanceof ApiError) {
        const level = error.status >= 500 ? 'error' : 'warn';
        log[level]('request failed', {
          status: error.status,
          code: error.code,
          error,
          durationMs: Date.now() - startedAt,
        });
        return json(
          { error: error.message, code: error.code, details: error.details },
          { status: error.status, requestId: id },
        );
      }

      log.error('unhandled error', { error, durationMs: Date.now() - startedAt });
      return json(
        { error: 'Something went wrong', code: 'internal_error', requestId: id },
        { status: 500, requestId: id },
      );
    }
  };
}

/** Parses a JSON body, turning a malformed one into a 400 rather than a 500. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw badRequest('Request body must be valid JSON');
  }
}
