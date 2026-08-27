import { Injectable } from "@nestjs/common";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { loadEnv } from "../../config/env";
import { log } from "../../common/logger";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  /** Link the email's button points at. Never contains credentials beyond the one-time token. */
  actionUrl?: string;
  actionLabel?: string;
}

/**
 * Email dispatch behind a driver. Development writes JSON files into
 * ./var/outbox so flows are inspectable without an ESP; `smtp` is the
 * production integration (requires a BAA with the provider — spec §19).
 *
 * The transport is created lazily and reused, so a misconfigured host fails on
 * the first send with a clear message rather than at module construction.
 */
@Injectable()
export class EmailService {
  private readonly env = loadEnv();
  private transport: Transporter | null = null;

  private get from(): string {
    return this.env.EMAIL_FROM_NAME
      ? `"${this.env.EMAIL_FROM_NAME}" <${this.env.EMAIL_FROM}>`
      : this.env.EMAIL_FROM;
  }

  private transporter(): Transporter {
    if (this.transport) return this.transport;
    if (!this.env.SMTP_HOST) {
      throw new Error("EMAIL_DRIVER=smtp requires SMTP_HOST (see .env.example)");
    }
    this.transport = nodemailer.createTransport({
      host: this.env.SMTP_HOST,
      port: this.env.SMTP_PORT,
      // secure=true is implicit TLS (465); otherwise STARTTLS, required unless
      // explicitly relaxed for a local test server.
      secure: this.env.SMTP_SECURE,
      requireTLS: this.env.SMTP_SECURE ? false : this.env.SMTP_REQUIRE_TLS,
      auth: this.env.SMTP_USER
        ? { user: this.env.SMTP_USER, pass: this.env.SMTP_PASSWORD }
        : undefined,
      tls: this.env.SMTP_ALLOW_INSECURE ? { rejectUnauthorized: false } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    return this.transport;
  }

  /** Verifies the SMTP connection and credentials without sending. Used by the readiness probe. */
  async verifyTransport(): Promise<void> {
    if (this.env.EMAIL_DRIVER === "outbox") return;
    await this.transporter().verify();
  }

  async send(mail: Mail): Promise<void> {
    const body = renderText(mail);

    if (this.env.EMAIL_DRIVER === "outbox") {
      const dir = join(process.cwd(), "var", "outbox");
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `${Date.now()}-${mail.subject.replace(/\W+/g, "-").slice(0, 40)}.json`);
      writeFileSync(file, JSON.stringify({ from: this.from, ...mail }, null, 2));
      // The action URL carries a one-time token, so it is never logged.
      log.info("email_outbox", { to: mail.to, subject: mail.subject, file });
      return;
    }

    try {
      const info = await this.transporter().sendMail({
        from: this.from,
        to: mail.to,
        replyTo: this.env.EMAIL_REPLY_TO || undefined,
        subject: mail.subject,
        text: body,
        html: renderHtml(mail),
      });
      log.info("email_sent", { to: mail.to, subject: mail.subject, messageId: info.messageId });
    } catch (err) {
      // Surface the failure to the caller, but keep the recipient and the
      // provider's message out of any downstream client response.
      log.error("email_send_failed", { subject: mail.subject, reason: (err as Error).message });
      throw err;
    }
  }
}

function renderText(mail: Mail): string {
  if (!mail.actionUrl) return mail.text;
  return `${mail.text}\n\n${mail.actionUrl}\n\nIf you did not request this, you can ignore this email.`;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function renderHtml(mail: Mail): string {
  const label = escapeHtml(mail.actionLabel ?? "Continue");
  const button = mail.actionUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(mail.actionUrl)}"
         style="background:#1D5FD0;color:#ffffff;text-decoration:none;padding:12px 22px;
                border-radius:24px;font-weight:600;display:inline-block">${label}</a></p>
       <p style="color:#6A7789;font-size:12px;line-height:1.5">
         If the button doesn't work, paste this into your browser:<br>
         <span style="word-break:break-all">${escapeHtml(mail.actionUrl)}</span>
       </p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F4F6F8;padding:28px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;padding:32px;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#131A24">
    <p style="font-size:17px;font-weight:700;margin:0 0 18px">MedPilot</p>
    <p style="font-size:15px;line-height:1.6;margin:0">${escapeHtml(mail.text)}</p>
    ${button}
    <p style="color:#6A7789;font-size:12px;line-height:1.5;margin:26px 0 0;
              border-top:1px solid #DDE3EA;padding-top:16px">
      If you did not request this, you can safely ignore this email. Never share
      this link — it signs in to your account.
    </p>
  </div></body></html>`;
}
