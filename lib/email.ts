import nodemailer from "nodemailer";

interface EmailPayload {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  headers?: Record<string, string>;
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

  private async post(payload: { from: string; to: string[]; subject: string; html: string }) {
    return fetch("https://api.unosend.co/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await this.post({
        from: this.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.htmlBody,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return { success: false, error: text };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async sendBatch(emails: EmailPayload[]): Promise<SendResult> {
    // Unosend has no batch endpoint — send concurrently in chunks of 10
    const results: Array<{ id?: string }> = [];
    for (let i = 0; i < emails.length; i += 10) {
      const chunk = emails.slice(i, i + 10);
      const chunkResults = await Promise.all(
        chunk.map(async (e) => {
          const r = await this.sendEmail(e);
          return { id: r.success ? "sent" : undefined };
        })
      );
      results.push(...chunkResults);
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
): UnosendClient | SmtpEmailClient | null {
  // Unosend takes priority if an API key is configured
  const unosendKey = settings["unosend_api_key"] || process.env.UNOSEND_API_KEY || "";
  if (unosendKey) {
    return new UnosendClient({
      apiKey: unosendKey,
      fromEmail: settings["unosend_from_email"] || process.env.UNOSEND_FROM_EMAIL || "newsletter@thegistdecatur.com",
      fromName: settings["unosend_from_name"] || process.env.UNOSEND_FROM_NAME || "The Gist Decatur",
    });
  }

  // Fall back to SMTP
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
