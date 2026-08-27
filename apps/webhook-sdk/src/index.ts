import crypto from 'node:crypto';
export interface CodestraEvent<T = Record<string, unknown>> {
  specversion: '1.0';
  id: string;
  source: 'codestra.social';
  type: string;
  subject?: string;
  time: string;
  tenantid: string;
  correlationid: string;
  datacontenttype: 'application/json';
  data: T;
}
export interface ReplayStore {
  claim(eventId: string, expiresAt: Date): Promise<boolean>;
}
export interface VerifyOptions {
  rawBody: string | Buffer;
  signature: string | undefined;
  timestamp: string | undefined;
  secrets: readonly string[];
  toleranceSeconds?: number;
  now?: Date;
  replayStore?: ReplayStore;
}
export class CodestraWebhookError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'CodestraWebhookError';
  }
}
function parseSignature(value: string) {
  const parts = new Map(
    value
      .split(',')
      .map((part) => part.trim().split('=', 2) as [string, string])
  );
  return parts.get('v1') ?? value;
}
export async function verifyCodestraWebhook<T = Record<string, unknown>>(
  options: VerifyOptions
): Promise<CodestraEvent<T>> {
  if (!options.signature || !options.timestamp)
    throw new CodestraWebhookError('signature_headers_required');
  if (!options.secrets.length)
    throw new CodestraWebhookError('verification_secret_required');
  const now = options.now ?? new Date();
  const timestampMs = Number(options.timestamp) * 1000;
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(now.getTime() - timestampMs) >
      (options.toleranceSeconds ?? 300) * 1000
  )
    throw new CodestraWebhookError('signature_timestamp_invalid');
  const body = Buffer.isBuffer(options.rawBody)
    ? options.rawBody
    : Buffer.from(options.rawBody);
  const signed = Buffer.concat([Buffer.from(`${options.timestamp}.`), body]);
  const actual = Buffer.from(parseSignature(options.signature), 'hex');
  const valid = options.secrets.some((secret) => {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(signed)
      .digest();
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  });
  if (!valid) throw new CodestraWebhookError('signature_invalid');
  let event: CodestraEvent<T>;
  try {
    event = JSON.parse(body.toString('utf8'));
  } catch {
    throw new CodestraWebhookError('payload_json_invalid');
  }
  if (
    event.specversion !== '1.0' ||
    event.source !== 'codestra.social' ||
    !event.id ||
    !event.type ||
    !event.tenantid ||
    !event.correlationid
  )
    throw new CodestraWebhookError('event_envelope_invalid');
  if (
    options.replayStore &&
    !(await options.replayStore.claim(
      event.id,
      new Date(now.getTime() + 86400000)
    ))
  )
    throw new CodestraWebhookError('event_replayed');
  return event;
}
export function signCodestraWebhook(
  rawBody: string | Buffer,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000)
) {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`), body]))
    .digest('hex');
  return {
    'x-codestra-timestamp': String(timestamp),
    'x-codestra-signature': `v1=${signature}`,
  };
}
