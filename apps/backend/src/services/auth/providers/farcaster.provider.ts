import {
  AuthProvider,
  AuthProviderAbstract,
} from '@gitroom/backend/services/auth/providers.interface';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

function neynarClient() {
  if (!process.env.NEYNAR_SECRET_KEY)
    throw new Error('farcaster_not_configured');
  return new NeynarAPIClient({ apiKey: process.env.NEYNAR_SECRET_KEY });
}

@AuthProvider({ provider: 'FARCASTER' })
export class FarcasterProvider extends AuthProviderAbstract {
  generateLink() {
    return '';
  }

  async getToken(code: string, _redirectUri?: string) {
    const data = JSON.parse(Buffer.from(code, 'base64').toString());
    const status = await neynarClient().lookupSigner({
      signerUuid: data.signer_uuid,
    });
    if (status.status === 'approved') {
      return data.signer_uuid;
    }

    return '';
  }

  async getUser(providerToken: string) {
    const status = await neynarClient().lookupSigner({
      signerUuid: providerToken,
    });
    if (status.status !== 'approved') {
      return {
        id: '',
        email: '',
      };
    }

    return {
      id: String('farcaster_' + status.fid),
      email: String('farcaster_' + status.fid),
    };
  }
}
