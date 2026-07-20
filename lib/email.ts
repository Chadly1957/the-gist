import nodemailer from "nodemailer";

interface EmailPayload {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  headers?: Record<string, string>;
}

export class ResendClient {
  private apiKey: string;
  private from: string;

  constructor(opts: { apiKey: string; fromEmail: string; fromName: string }) {
    this.apiKey = opts.apiKey;
    this.from = opts.fromName ? `${opts.fromName} <${opts.fromEmail}>` : opts.fromEmail;
  }

  private authHeaders() {
    return { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
  }

  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify({
          from: this.from,
          to: [payload.to],
          subject: payload.subject,
          html: payload.htmlBody,
          ...(payload.textBody ? { text: payload.textBody } : {}),
          ...(payload.headers ? { headers: payload.headers } : {}),
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        const msg = `Resend HTTP ${res.status}: ${text}`;
        console.error("[resend] send failed:", msg);
        return { success: false, error: msg };
      }
      return { success: true };
    } catch (err) {
      const msg = String(err);
      console.error("[resend] send error:", msg);
      return { success: false, error: msg };
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendBatch(emails: EmailPayload[]): Promise<SendResult> {
    const results: Array<{ id?: string }> = [];
    let failures = 0;

    // Resend batch endpoint accepts up to 100 per request
    for (let i = 0; i < emails.length; i += 100) {
      const chunk = emails.slice(i, i + 100);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: this.authHeaders(),
          body: JSON.stringify(
            chunk.map((e) => ({
              from: this.from,
              to: [e.to],
              subject: e.subject,
              html: e.htmlBody,
              ...(e.textBody ? { text: e.textBody } : {}),
              ...(e.headers ? { headers: e.headers } : {}),
            }))
          ),
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText);
          console.error(`[resend] batch failed HTTP ${res.status}:`, text);
          failures += chunk.length;
          results.push(...chunk.map(() => ({ id: undefined })));
        } else {
          const data = await res.json();
          const ids: Array<{ id?: string }> = (data.data || []).map((d: { id?: string }) => ({ id: d.id }));
          results.push(...ids);
        }
      } catch (err) {
        console.error("[resend] batch error:", String(err));
        failures += chunk.length;
        results.push(...chunk.map(() => ({ id: undefined })));
      } finally {
        clearTimeout(timeout);
      }
      // Small pause between chunks
      if (i + 100 < emails.length) {
        await new Promise((res) => setTimeout(res, 200));
      }
    }

    if (failures > 0) {
      console.error(`[resend] sendBatch: ${failures}/${emails.length} sends failed`);
    }
    return { success: true, data: results };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) return { success: false, error: "No API key set." };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch("https://api.resend.com/domains", {
        headers: this.authHeaders(),
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.status === 401) return { success: false, error: "Invalid API key." };
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    } finally {
      clearTimeout(timeout);
    }
  }
}



interface SendResult {
  success: boolean;
  data?: Array<{ id?: string }>;
  error?: string;
}

export class UnosendClient {
  private apiKey: string;
  private from: string;

  constructor(opts: { apiKey: string; fromEmail: string; fromName: string }) {
    this.apiKey = opts.apiKey;
    this.from = opts.fromName
      ? `${opts.fromName} <${opts.fromEmail}>`
      : opts.fromEmail;
  }

  private async post(payload: { from: string; to: string[]; subject: string; html: string; text?: string; headers?: Record<string, string> }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      return await fetch("https://api.unosend.co/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await this.post({
        from: this.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.htmlBody,
        ...(payload.textBody ? { text: payload.textBody } : {}),
        ...(payload.headers ? { headers: payload.headers } : {}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        const msg = `Unosend HTTP ${res.status}: ${text}`;
        console.error("[unosend] send failed:", msg);
        return { success: false, error: msg };
      }
      return { success: true };
    } catch (err) {
      const msg = String(err);
      console.error("[unosend] send error:", msg);
      return { success: false, error: msg };
    }
  }

  async sendBatch(emails: EmailPayload[]): Promise<SendResult> {
    const results: Array<{ id?: string }> = [];
    let failures = 0;

    for (let i = 0; i < emails.length; i += 5) {
      const chunk = emails.slice(i, i + 5);
      const chunkResults = await Promise.all(
        chunk.map(async (e) => {
          const r = await this.sendEmail(e);
          if (!r.success) failures++;
          return { id: r.success ? "sent" : undefined };
        })
      );
      results.push(...chunkResults);
      // Pace sends to stay under Unosend rate limits
      if (i + 5 < emails.length) {
        await new Promise((res) => setTimeout(res, 200));
      }
    }

    if (failures > 0) {
      console.error(`[unosend] sendBatch: ${failures}/${emails.length} sends failed`);
    }
    return { success: true, data: results };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) return { success: false, error: "No API key set." };
    if (!this.apiKey.startsWith("un_")) {
      return { success: false, error: "Unosend API keys start with 'un_'." };
    }
    return { success: true };
  }
}

export class SmtpEmailClient {
  private transportOpts: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  };
  private from: string;

  constructor(opts: {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromEmail: string;
    fromName: string;
  }) {
    this.transportOpts = {
      host: opts.host,
      port: opts.port,
      secure: opts.port === 465,
      auth: { user: opts.user, pass: opts.pass },
    };
    this.from = opts.fromName
      ? `${opts.fromName} <${opts.fromEmail}>`
      : opts.fromEmail;
  }

  private createTransport(pool = false) {
    return nodemailer.createTransport({
      ...this.transportOpts,
      ...(pool ? { pool: true, maxConnections: 5 } : {}),
    });
  }

  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    const t = this.createTransport();
    try {
      await t.sendMail({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.htmlBody,
        text: payload.textBody,
        headers: payload.headers,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    } finally {
      t.close();
    }
  }

  async sendBatch(emails: EmailPayload[]): Promise<SendResult> {
    const t = this.createTransport(true);
    try {
      const results = await Promise.all(
        emails.map(({ to, subject, htmlBody, textBody, headers }) =>
          t
            .sendMail({ from: this.from, to, subject, html: htmlBody, text: textBody, headers })
            .then((info) => ({ id: info.messageId as string | undefined }))
            .catch(() => ({ id: undefined as string | undefined }))
        )
      );
      return { success: true, data: results };
    } catch (err) {
      return { success: false, error: String(err) };
    } finally {
      t.close();
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    // Non-pooled transporter — verify() hangs on pool transporters in serverless
    const t = this.createTransport(false);
    try {
      await t.verify();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    } finally {
      t.close();
    }
  }
}

export function getEmailClient(
  settings: Record<string, string>
): ResendClient | UnosendClient | SmtpEmailClient | null {
  const provider = settings["email_provider"] || process.env.EMAIL_PROVIDER || "";

  if (provider === "resend" || (!provider && (settings["resend_api_key"] || process.env.RESEND_API_KEY))) {
    const apiKey = settings["resend_api_key"] || process.env.RESEND_API_KEY || "";
    if (apiKey) {
      return new ResendClient({
        apiKey,
        fromEmail: settings["resend_from_email"] || process.env.RESEND_FROM_EMAIL || "newsletter@thegistdecatur.com",
        fromName: settings["resend_from_name"] || process.env.RESEND_FROM_NAME || "The Gist Decatur",
      });
    }
  }

  if (provider === "unosend" || (!provider && (settings["unosend_api_key"] || process.env.UNOSEND_API_KEY))) {
    const apiKey = settings["unosend_api_key"] || process.env.UNOSEND_API_KEY || "";
    if (apiKey) {
      return new UnosendClient({
        apiKey,
        fromEmail: settings["unosend_from_email"] || process.env.UNOSEND_FROM_EMAIL || "newsletter@thegistdecatur.com",
        fromName: settings["unosend_from_name"] || process.env.UNOSEND_FROM_NAME || "The Gist Decatur",
      });
    }
  }

  // SMTP fallback
  const host = settings["smtp_host"] || process.env.SMTP_HOST || "";
  const port = parseInt(settings["smtp_port"] || process.env.SMTP_PORT || "587");
  const user = settings["smtp_user"] || process.env.SMTP_USER || "";
  const pass = settings["smtp_pass"] || process.env.SMTP_PASS || "";
  const fromEmail = settings["smtp_from"] || process.env.SMTP_FROM || "newsletter@thegistdecatur.com";
  const fromName = settings["smtp_from_name"] || process.env.SMTP_FROM_NAME || "The Gist Decatur";

  if (!host || !user || !pass) return null;
  return new SmtpEmailClient({ host, port, user, pass, fromEmail, fromName });
}

// Strips HTML to produce a plain-text fallback. Gives Gmail's classifier
// a multipart/alternative signal that reduces Promotions tab placement.
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
