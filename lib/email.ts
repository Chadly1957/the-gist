import nodemailer from "nodemailer";

interface EmailPayload {
  to: string;
  subject: string;
  htmlBody: string;
}

interface SendResult {
  success: boolean;
  data?: Array<{ id?: string }>;
  error?: string;
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
        emails.map(({ to, subject, htmlBody }) =>
          t
            .sendMail({ from: this.from, to, subject, html: htmlBody })
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
): SmtpEmailClient | null {
  const host = settings["smtp_host"] || process.env.SMTP_HOST || "";
  const port = parseInt(settings["smtp_port"] || process.env.SMTP_PORT || "587");
  const user = settings["smtp_user"] || process.env.SMTP_USER || "";
  const pass = settings["smtp_pass"] || process.env.SMTP_PASS || "";
  const fromEmail =
    settings["smtp_from"] ||
    process.env.SMTP_FROM ||
    "newsletter@thegistdecatur.com";
  const fromName =
    settings["smtp_from_name"] ||
    process.env.SMTP_FROM_NAME ||
    "The Gist Decatur";

  if (!host || !user || !pass) return null;

  return new SmtpEmailClient({ host, port, user, pass, fromEmail, fromName });
}
