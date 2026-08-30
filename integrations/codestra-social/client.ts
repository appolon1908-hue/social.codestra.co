export type RuntimePost = { id: string; status: string; scheduledAt?: string; metrics?: Record<string, number> };

export class CodestraSocialRuntimeClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly publishingEnabled = false,
  ) {}

  private headers(correlationId?: string): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
      ...(correlationId ? { "X-Correlation-ID": correlationId } : {}),
    };
  }

  async getPost(runtimePostId: string, correlationId?: string): Promise<RuntimePost> {
    const response = await fetch(`${this.baseUrl}/api/posts/${encodeURIComponent(runtimePostId)}`, {
      method: "GET",
      headers: this.headers(correlationId),
    });
    if (!response.ok) throw new Error(`runtime_read_failed:${response.status}`);
    return (await response.json()) as RuntimePost;
  }

  async getMetrics(runtimePostId: string, correlationId?: string): Promise<Record<string, number>> {
    const response = await fetch(`${this.baseUrl}/api/posts/${encodeURIComponent(runtimePostId)}/metrics`, {
      method: "GET",
      headers: this.headers(correlationId),
    });
    if (!response.ok) throw new Error(`runtime_metrics_failed:${response.status}`);
    return (await response.json()) as Record<string, number>;
  }

  async publish(): Promise<never> {
    if (!this.publishingEnabled) throw new Error("social_publishing_disabled");
    throw new Error("publish_not_implemented_until_stage5_approval");
  }
}
