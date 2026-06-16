// Unosend API client
// Docs reference: https://docs.unosend.co
// Configure API key and sending domain in Admin > Settings

interface UnosendConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  baseUrl?: string;
}

interface UnosendResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DnsRecord {
  name: string;
  type: string;
  value: string;
  status?: string;
  purpose?: string;
  recordType?: string;
}

export interface DomainData {
  id: string;
  domain: string;
  status?: string;
  dns_records?: { records: DnsRecord[] };
  created_at?: string;
}

interface BatchRecipient {
  to: string;
  subject: string;
  htmlBody: string;
}

const BATCH_CHUNK_SIZE = 100;

export class UnosendClient {
  private config: UnosendConfig;
  private baseUrl: string;

  constructor(config: UnosendConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || "https://api.unosend.co";
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<UnosendResponse<T>> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const json = await res.json();

      if (!res.ok) {
        return { success: false, error: json.message || json.error || `HTTP ${res.status}` };
      }

      return { success: true, data: json.data as T };
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
  }): Promise<UnosendResponse<{ id: string }>> {
    return this.request("POST", "/emails", {
      from: this.fromHeader(),
      to: [params.to],
      subject: params.subject,
      html: params.htmlBody,
      tracking: { open: true, click: true },
    });
  }

  // Sends in chunks of BATCH_CHUNK_SIZE via /emails/batch to avoid oversized payloads
  async sendBatch(
    recipients: BatchRecipient[]
  ): Promise<UnosendResponse<{ id: string }[]>> {
    const from = this.fromHeader();
    const ids: { id: string }[] = [];

    for (let i = 0; i < recipients.length; i += BATCH_CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_CHUNK_SIZE);
      const result = await this.request<{ data: { id: string }[] }>(
        "POST",
        "/emails/batch",
        {
          emails: chunk.map((r) => ({
            from,
            to: [r.to],
            subject: r.subject,
            html: r.htmlBody,
            tracking: { open: true, click: true },
          })),
        }
      );

      if (!result.success) return { success: false, error: result.error };
      ids.push(...(result.data?.data || []));
    }

    return { success: true, data: ids };
  }

  async createDomain(name: string): Promise<UnosendResponse<DomainData>> {
    return this.request("POST", "/domains", { name });
  }

  async getDomain(id: string): Promise<UnosendResponse<DomainData>> {
    return this.request("GET", `/domains/${id}`);
  }

  async verifyDomain(id: string): Promise<UnosendResponse<DomainData>> {
    return this.request("POST", `/domains/${id}/verify`);
  }

  // Lightweight auth check, used by the Settings "Test Connection" button
  async testConnection(): Promise<UnosendResponse<unknown>> {
    return this.request("GET", "/domains");
  }
}

// Build client from DB settings or env fallback
export async function getUnosendClient(
  settings: Record<string, string>
): Promise<UnosendClient | null> {
  const apiKey =
    settings["unosend_api_key"] || process.env.UNOSEND_API_KEY || "";
  const fromEmail =
    settings["unosend_from_email"] ||
    process.env.UNOSEND_FROM_EMAIL ||
    "newsletter@thegistdecatur.com";
  const fromName =
    settings["unosend_from_name"] ||
    process.env.UNOSEND_FROM_NAME ||
    "The Gist Decatur";

  if (!apiKey) return null;

  return new UnosendClient({ apiKey, fromEmail, fromName });
}
