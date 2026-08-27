import { Resend } from 'resend';
import { EmailInterface } from '@gitroom/nestjs-libraries/emails/email.interface';

export class ResendProvider implements EmailInterface {
  name = 'resend';
  validateEnvKeys = ['RESEND_API_KEY'];
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    emailFromName: string,
    emailFromAddress: string,
    replyTo?: string
  ) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('email_provider_not_configured');
    }
    try {
      const sends = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: `${emailFromName} <${emailFromAddress}>`,
        to,
        subject,
        html,
        ...(replyTo && { reply_to: replyTo }),
      });

      return sends;
    } catch {
      throw new Error('email_delivery_failed');
    }
  }
}
