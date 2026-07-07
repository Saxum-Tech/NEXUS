/**
 * lib/email/send-invite-email.ts
 * ─────────────────────────────────────────────────────────────
 * Single function the rest of the app calls to deliver a setup
 * link. The default implementation just logs to the server
 * console — this is intentional so the template runs end-to-end
 * with zero external accounts required, and an admin can still
 * copy the link out of server logs in early development.
 *
 * To go to production, replace the body of sendInviteEmail()
 * with a call to a real provider. Two ready-to-uncomment
 * examples are below (Resend and AWS SES) — pick one, delete
 * the other, and set the matching env vars from .env.example.
 * ─────────────────────────────────────────────────────────────
 */

import 'server-only';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

export interface SendInviteEmailInput {
  toEmail: string;
  recipientDisplayName: string;
  appName: string;
  setupUrl: string;
  expiresAt: string;
  isReset: boolean; // true = "reset your password", false = "you've been invited"
}

export async function sendInviteEmail(input: SendInviteEmailInput): Promise<void> {
  const subject = input.isReset
    ? `Reset your ${input.appName} password`
    : `You've been invited to ${input.appName}`;

  // ── Default: log-only (no external provider configured) ───
  logger.info('[email:dev] invite/reset email not sent — no provider configured', {
    to: input.toEmail,
    subject,
    setupUrl: input.setupUrl,
    expiresAt: input.expiresAt,
  });

  // ── Option A: Resend ───────────────────────────────────────
  // npm install resend
  //
  // import { Resend } from 'resend';
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: process.env.EMAIL_FROM_ADDRESS!,
  //   to: input.toEmail,
  //   subject,
  //   html: renderInviteEmailHtml(input),
  // });

  // ── Option B: AWS SES ───────────────────────────────────────
  // npm install @aws-sdk/client-ses
  //
  // import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
  // const ses = new SESClient({ region: process.env.AWS_REGION });
  // await ses.send(new SendEmailCommand({
  //   Source: process.env.EMAIL_FROM_ADDRESS!,
  //   Destination: { ToAddresses: [input.toEmail] },
  //   Message: {
  //     Subject: { Data: subject },
  //     Body: { Html: { Data: renderInviteEmailHtml(input) } },
  //   },
  // }));
}

/** Minimal HTML body. Swap for a proper template/React Email component as needed. */
function renderInviteEmailHtml(input: SendInviteEmailInput): string {
  const heading = input.isReset ? 'Reset your password' : `Welcome to ${input.appName}`;
  const cta = input.isReset ? 'Reset password' : 'Set up your account';

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>${heading}</h2>
      <p>Hi ${input.recipientDisplayName},</p>
      <p>${
        input.isReset
          ? 'A password reset was requested for your account.'
          : `An administrator has created an account for you on ${input.appName}.`
      }</p>
      <p><a href="${input.setupUrl}" style="display:inline-block;padding:10px 20px;background:#6c4de6;color:#fff;border-radius:6px;text-decoration:none;">${cta}</a></p>
      <p style="color:#888;font-size:13px;">This link expires at ${input.expiresAt}. If you didn't expect this email, you can safely ignore it.</p>
    </div>
  `;
}
