'use client';

/**
 * The browser's side of the API contract: one place that knows how this app
 * reports errors, so no component has to guess.
 */
export type ApiFailure = {
  error: string;
  code?: string;
  fields?: Record<string, string[]>;
  requestId?: string;
};

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiFailure,
  ) {
    super(body.error || `Request failed (${status})`);
    this.name = 'ApiClientError';
  }

  /** Per-field messages, ready to render next to the input that caused them. */
  get fields(): Record<string, string[]> {
    return this.body.fields ?? {};
  }

  /** A retry might succeed: the network dropped, or the server is overloaded. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new ApiClientError(0, {
      error: error instanceof Error ? error.message : 'Network request failed',
      code: 'network_error',
    });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body = text ? safeParse(text) : {};

  if (!response.ok) {
    const failure = body as Partial<ApiFailure>;
    throw new ApiClientError(response.status, {
      ...failure,
      error: failure.error || `Request failed (${response.status})`,
      requestId: response.headers.get('x-request-id') ?? undefined,
    });
  }

  return body as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 200) };
  }
}
