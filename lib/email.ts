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
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(opts: {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromEmail: string;
    fromName: string;
  }) {
    this.transporter = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.port === 465,
      auth: { user: opts.user, pass: opts.pass },
      pool: true,
      maxConnections: 5,
    });
    this.from = opts.fromName
      ? `${opts.fromName} <${opts.fromEmail}>`
      : opts.fromEmail;
  }

  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.htmlBody,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    } finally {
      this.transporter.close();
    }
  }

  // Sends all emails in parallel; nodemailer pool caps concurrency at maxConnections
  async sendBatch(emails: EmailPayload[]): Promise<SendResult> {
    try {
      const results = await Promise.all(
        emails.map(({ to, subject, htmlBody }) =>
          this.transporter
            .sendMail({ from: this.from, to, subject, html: htmlBody })
            .then((info) => ({ id: info.messageId as string | undefined }))
            .catch(() => ({ id: undefined as string | undefined }))
        )
      );
      return { success: true, data: results };
    } catch (err) {
      return { success: false, error: String(err) };
    } finally {
      this.transporter.close();
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.transporter.verify();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    } finally {
      this.transporter.close();
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
