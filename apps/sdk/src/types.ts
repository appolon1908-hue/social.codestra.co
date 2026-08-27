export type JsonObject = Record<string, unknown>;
export interface CodestraRequestOptions {
  correlationId?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}
export interface CodestraClientOptions {
  accessToken: string | (() => string | Promise<string>);
  baseUrl?: string;
  tenantId?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  userAgent?: string;
}
export interface CodestraErrorBody {
  code?: string;
  message?: string;
  correlation_id?: string;
  details?: unknown;
}
export class CodestraApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly correlationId: string | undefined,
    public readonly details: unknown,
    message: string
  ) {
    super(message);
    this.name = 'CodestraApiError';
  }
}
export interface Page<T> {
  data: T[];
  next_cursor?: string | null;
}
export interface AcceptedCommand {
  command_id: string;
  state: 'accepted' | 'blocked';
  replayed: boolean;
}
export type Query = Record<
  string,
  string | number | boolean | null | undefined
>;
