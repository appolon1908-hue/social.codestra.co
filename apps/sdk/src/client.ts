import {
  CodestraApiError,
  CodestraClientOptions,
  CodestraErrorBody,
  CodestraRequestOptions,
  JsonObject,
  Query,
} from './types';
const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
export class CodestraHttpClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  constructor(private readonly options: CodestraClientOptions) {
    this.baseUrl = (
      options.baseUrl ?? 'https://api.codestra.co/v2/social'
    ).replace(/\/$/, '');
    this.fetcher = options.fetch ?? globalThis.fetch;
    if (!this.fetcher) throw new Error('fetch_implementation_required');
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }
  async request<T>(
    method: string,
    path: string,
    body?: JsonObject,
    query?: Query,
    options: CodestraRequestOptions = {}
  ): Promise<T> {
    const token =
      typeof this.options.accessToken === 'function'
        ? await this.options.accessToken()
        : this.options.accessToken;
    if (!token) throw new Error('access_token_required');
    const correlationId = options.correlationId ?? randomId();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Correlation-ID': correlationId,
      'X-Codestra-SDK': this.options.userAgent ?? '@codestra/social-sdk/2',
      ...options.headers,
    };
    if (this.options.tenantId) headers['X-Tenant-ID'] = this.options.tenantId;
    if (body) headers['Content-Type'] = 'application/json';
    if (mutationMethods.has(method))
      headers['Idempotency-Key'] = options.idempotencyKey ?? randomId();
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {}))
      if (value !== null && value !== undefined)
        url.searchParams.set(key, String(value));
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: options.signal ?? timeout.signal,
      });
      const responseBody =
        response.status === 204 ? undefined : await response.json();
      if (!response.ok) {
        const error = (responseBody ?? {}) as CodestraErrorBody;
        throw new CodestraApiError(
          response.status,
          error.code ?? 'codestra_api_error',
          error.correlation_id ??
            response.headers.get('x-correlation-id') ??
            undefined,
          error.details,
          error.message ?? `Codestra API returned ${response.status}`
        );
      }
      return responseBody as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
