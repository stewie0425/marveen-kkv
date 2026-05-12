// Outbound email via SMTP. Used by Marveen for alerts/notifications;
// inbox reads are owned by Tracy's MCPs.
//
// Defaults to Gmail (smtp.gmail.com:587 STARTTLS) using a 16-char Google
// App Password. The transport is reused across calls so we don't pay the
// TLS handshake on every send.

import { createTransport, type Transporter } from 'nodemailer'
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } from './config.js'
import { logger } from './logger.js'

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (!SMTP_USER || !SMTP_PASSWORD) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be set in .env')
  }
  if (transporter) return transporter
  transporter = createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    // STARTTLS upgrade for port 587; implicit TLS only for 465.
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  })
  return transporter
}

export interface SendEmailResult {
  accepted: string[]
  rejected: string[]
  message_id: string
}

export async function sendEmail(
  to: string,
  subject: string,
  bodyText: string,
  bodyHtml?: string,
): Promise<SendEmailResult> {
  const info = await getTransporter().sendMail({
    from: SMTP_USER,
    to,
    subject,
    text: bodyText,
    ...(bodyHtml ? { html: bodyHtml } : {}),
  })
  // Don't log subject/body — they may contain sensitive memo content.
  logger.info({ to, accepted: info.accepted, messageId: info.messageId }, 'Email sent via SMTP')
  const flatten = (xs: Array<string | { address: string }> | undefined): string[] =>
    (xs ?? []).map((x) => (typeof x === 'string' ? x : x.address))
  return {
    accepted: flatten(info.accepted),
    rejected: flatten(info.rejected),
    message_id: info.messageId,
  }
}
