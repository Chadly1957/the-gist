// Resend API client
// Docs reference: https://resend.com/docs
// Configure API key and sending domain in Admin > Settings

interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  baseUrl?: string;
}

interface ResendResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DomainRecord {
  record?: string;
  type: string;
  name: string;
  value: string;
  ttl?: string;
  status?: string;
  priority?: number;
}

export interface DomainData {
  id: string;
  name: string;
  status?: string;
  records?: DomainRecord[];
  created_at?: string;
}

interface BatchRecipient {
  to: string;
  subject: string;
  htmlBody: string;
}

// Resend's batch endpoint accepts at most 100 emails per request
const BATCH_CHUNK_SIZE = 100;

export class ResendClient {
  private config: ResendConfig;
  private baseUrl: string;

  constructor(config: ResendConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || "https://api.resend.com";
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ResendResult<T>> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const json = await res.json();

      if (!res.ok) {
        return { success: false, error: json.message || `HTTP ${res.status}` };
      }

      return { success: true, data: json as T };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  private fromHeader(): string {
    return this.config.fromName
      ? `${this.config.fromName} <${this.config.fromEmail}>`
      : this.config.fromEmail;
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    htmlBody: string;
  }): Promise<ResendResult<{ id: string }>> {
    return this.request("POST", "/emails", {
      from: this.fromHeader(),
      to: [params.to],
      subject: params.subject,
      html: params.htmlBody,
    });
  }

  // Sends in chunks of BATCH_CHUNK_SIZE via /emails/batch (Resend's batch limit)
  async sendBatch(
    recipients: BatchRecipient[]
  ): Promise<ResendResult<{ id: string }[]>> {
    const from = this.fromHeader();
    const ids: { id: string }[] = [];

    for (let i = 0; i < recipients.length; i += BATCH_CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_CHUNK_SIZE);
      const result = await this.request<{ data: { id: string }[] }>(
        "POST",
        "/emails/batch",
        chunk.map((r) => ({
          from,
          to: [r.to],
          subject: r.subject,
          html: r.htmlBody,
        }))
      );

      if (!result.success) return { success: false, error: result.error };
      ids.push(...(result.data?.data || []));
    }

    return { success: true, data: ids };
  }

  async createDomain(name: string): Promise<ResendResult<DomainData>> {
    return this.request("POST", "/domains", { name });
  }

  async getDomain(id: string): Promise<ResendResult<DomainData>> {
    return this.request("GET", `/domains/${id}`);
  }

  async verifyDomain(id: string): Promise<ResendResult<DomainData>> {
    const result = await this.request<{ id: string }>("POST", `/domains/${id}/verify`);
    if (!result.success) return { success: false, error: result.error };
    // Verify only returns {id, object}; fetch the full domain to get updated records/status
    return this.getDomain(id);
  }

  // Lightweight auth check, used by the Settings "Test Connection" button
  async testConnection(): Promise<ResendResult<unknown>> {
    return this.request("GET", "/domains");
  }
}

// Build client from DB settings or env fallback
export async function getResendClient(
  settings: Record<string, string>
): Promise<ResendClient | null> {
  const apiKey =
    settings["resend_api_key"] || process.env.RESEND_API_KEY || "";
  const fromEmail =
    settings["resend_from_email"] ||
    process.env.RESEND_FROM_EMAIL ||
    "newsletter@thegistdecatur.com";
  const fromName =
    settings["resend_from_name"] ||
    process.env.RESEND_FROM_NAME ||
    "The Gist Decatur";

  if (!apiKey) return null;

  return new ResendClient({ apiKey, fromEmail, fromName });
}
