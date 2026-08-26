import { Injectable } from "@nestjs/common";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "../../config/env";
import { log } from "../../common/logger";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  /** deep link the email's button points at */
  actionUrl?: string;
}

/**
 * Email dispatch behind a driver. Development writes JSON files into
 * ./var/outbox so flows are inspectable without an ESP; the smtp-provider
 * driver is the production integration point (requires a BAA — spec §19).
 */
@Injectable()
export class EmailService {
  private readonly env = loadEnv();

  async send(mail: Mail): Promise<void> {
    if (this.env.EMAIL_DRIVER === "outbox") {
      const dir = join(process.cwd(), "var", "outbox");
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `${Date.now()}-${mail.subject.replace(/\W+/g, "-").slice(0, 40)}.json`);
      writeFileSync(file, JSON.stringify({ from: this.env.EMAIL_FROM, ...mail }, null, 2));
      log.info("email_outbox", { to: mail.to, subject: mail.subject, file });
      return;
    }
    throw new Error("smtp-provider driver not configured");
  }
}
