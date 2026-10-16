import { createTransport } from 'nodemailer';
import type { Logger } from '../logger';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends email. Tests use a fake; dev uses a local mail catcher (Mailpit). */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** SMTP, e.g. smtp://localhost:1025 for Mailpit in dev. */
export function createSmtpSender(smtpUrl: string, from: string): EmailSender {
  const transport = createTransport(smtpUrl);
  return {
    async send(message) {
      await transport.sendMail({ from, ...message });
    },
  };
}

/** Used when no SMTP server is configured: logs that an email would have gone, without the address. */
export function createLoggingSender(logger: Logger): EmailSender {
  return {
    async send(message) {
      logger.info(`email not sent (no SMTP_URL): "${message.subject}"`);
    },
  };
}
