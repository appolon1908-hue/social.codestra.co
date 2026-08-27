import { EmailInterface } from './email.interface';

export class EmptyProvider implements EmailInterface {
  name = 'no provider';
  validateEnvKeys: string[] = [];
  async sendEmail(_to: string, _subject: string, _html: string) {
    throw new Error('email_provider_not_configured');
  }
}
