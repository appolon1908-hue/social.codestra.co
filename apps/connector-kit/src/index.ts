export type ConnectorName =
  | 'middleware'
  | 'odoo'
  | 'n8n'
  | 'klyrow'
  | 'telnexa';
export interface ConnectorContext {
  tenantId: string;
  correlationId: string;
  idempotencyKey: string;
  liveWritesEnabled: boolean;
}
export interface ConnectorCommand {
  type: string;
  payload: Record<string, unknown>;
}
export interface ConnectorResult {
  accepted: boolean;
  externalId?: string;
  replayed?: boolean;
  metadata?: Record<string, unknown>;
}
export interface ConnectorHealth {
  state: 'healthy' | 'degraded' | 'unavailable' | 'disabled';
  checkedAt: string;
  details?: Record<string, unknown>;
}
export interface ConnectorAdapter {
  readonly name: ConnectorName;
  validateConfiguration(): Promise<void>;
  health(): Promise<ConnectorHealth>;
  execute(
    context: ConnectorContext,
    command: ConnectorCommand
  ): Promise<ConnectorResult>;
}
export class ConnectorPolicyError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ConnectorPolicyError';
  }
}
export abstract class MiddlewareOnlyAdapter implements ConnectorAdapter {
  abstract readonly name: ConnectorName;
  constructor(
    protected readonly middlewareUrl: string,
    protected readonly fetcher: typeof fetch = fetch
  ) {}
  async validateConfiguration() {
    const url = new URL(this.middlewareUrl);
    if (
      url.protocol !== 'https:' &&
      !['localhost', '127.0.0.1'].includes(url.hostname)
    )
      throw new ConnectorPolicyError('https_middleware_url_required');
  }
  async health(): Promise<ConnectorHealth> {
    return {
      state: 'disabled',
      checkedAt: new Date().toISOString(),
      details: { live_writes: false },
    };
  }
  async execute(
    context: ConnectorContext,
    command: ConnectorCommand
  ): Promise<ConnectorResult> {
    if (
      !context.tenantId ||
      !context.correlationId ||
      context.idempotencyKey.length < 16
    )
      throw new ConnectorPolicyError('command_context_invalid');
    if (!context.liveWritesEnabled)
      return {
        accepted: false,
        metadata: {
          blocked_by: 'live_write_kill_switch',
          connector: this.name,
        },
      };
    const response = await this.fetcher(
      `${this.middlewareUrl}/v2/connectors/${this.name}/commands`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': context.tenantId,
          'x-correlation-id': context.correlationId,
          'idempotency-key': context.idempotencyKey,
        },
        body: JSON.stringify(command),
      }
    );
    if (!response.ok)
      throw new ConnectorPolicyError(
        `middleware_command_failed:${response.status}`
      );
    return (await response.json()) as ConnectorResult;
  }
}
export class MiddlewareAdapter extends MiddlewareOnlyAdapter {
  readonly name = 'middleware' as const;
}
export class OdooAdapter extends MiddlewareOnlyAdapter {
  readonly name = 'odoo' as const;
}
export class N8nAdapter extends MiddlewareOnlyAdapter {
  readonly name = 'n8n' as const;
}
export class KlyrowAdapter extends MiddlewareOnlyAdapter {
  readonly name = 'klyrow' as const;
}
export class TelnexaAdapter extends MiddlewareOnlyAdapter {
  readonly name = 'telnexa' as const;
}
export function createEnterpriseAdapters(
  middlewareUrl: string,
  fetcher?: typeof fetch
) {
  return {
    middleware: new MiddlewareAdapter(middlewareUrl, fetcher),
    odoo: new OdooAdapter(middlewareUrl, fetcher),
    n8n: new N8nAdapter(middlewareUrl, fetcher),
    klyrow: new KlyrowAdapter(middlewareUrl, fetcher),
    telnexa: new TelnexaAdapter(middlewareUrl, fetcher),
  };
}
