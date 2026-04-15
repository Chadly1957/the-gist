// Unosend API client
// Docs reference: https://unosend.com/api
// Configure API key and list ID in Admin > Settings

interface UnosendConfig {
  apiKey: string;
  listId: string;
  fromEmail: string;
  fromName: string;
  baseUrl?: string;
}

interface AddSubscriberParams {
  email: string;
  firstName?: string;
}

interface SendCampaignParams {
  subject: string;
  htmlBody: string;
  listId?: string; // override default list
}

interface UnosendResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class UnosendClient {
  private config: UnosendConfig;
  private baseUrl: string;

  constructor(config: UnosendConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || "https://api.unosend.com/v1";
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

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.message || `HTTP ${res.status}` };
      }

      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  async addSubscriber(
    params: AddSubscriberParams
  ): Promise<UnosendResponse> {
    return this.request("POST", `/lists/${this.config.listId}/subscribers`, {
      email: params.email,
      first_name: params.firstName || "",
      status: "subscribed",
    });
  }

  async removeSubscriber(email: string): Promise<UnosendResponse> {
    return this.request(
      "DELETE",
      `/lists/${this.config.listId}/subscribers/${encodeURIComponent(email)}`
    );
  }

  async getListStats(): Promise<
    UnosendResponse<{ total: number; active: number }>
  > {
    return this.request("GET", `/lists/${this.config.listId}/stats`);
  }

  async sendCampaign(
    params: SendCampaignParams
  ): Promise<UnosendResponse<{ campaignId: string }>> {
    return this.request("POST", "/campaigns", {
      subject: params.subject,
      html: params.htmlBody,
      list_id: params.listId || this.config.listId,
      from_email: this.config.fromEmail,
      from_name: this.config.fromName,
      send_immediately: true,
    });
  }
}

// Build client from DB settings or env fallback
export async function getUnosendClient(
  settings: Record<string, string>
): Promise<UnosendClient | null> {
  const apiKey =
    settings["unosend_api_key"] || process.env.UNOSEND_API_KEY || "";
  const listId =
    settings["unosend_list_id"] || process.env.UNOSEND_LIST_ID || "";
  const fromEmail =
    settings["unosend_from_email"] ||
    process.env.UNOSEND_FROM_EMAIL ||
    "newsletter@thegistdecatur.com";
  const fromName =
    settings["unosend_from_name"] ||
    process.env.UNOSEND_FROM_NAME ||
    "The Gist Decatur";

  if (!apiKey || !listId) return null;

  return new UnosendClient({ apiKey, listId, fromEmail, fromName });
}
