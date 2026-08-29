import { OauthProvider } from '@gitroom/backend/services/auth/providers/oauth.provider';

describe('Codestra Keycloak OIDC hardening', () => {
  beforeEach(() => {
    process.env.POSTIZ_OAUTH_AUTH_URL =
      'https://auth.codestra.co/realms/codestra/protocol/openid-connect/auth';
    process.env.POSTIZ_OAUTH_TOKEN_URL =
      'https://auth.codestra.co/realms/codestra/protocol/openid-connect/token';
    process.env.POSTIZ_OAUTH_USERINFO_URL =
      'https://auth.codestra.co/realms/codestra/protocol/openid-connect/userinfo';
    process.env.POSTIZ_OAUTH_CLIENT_ID = 'codestra-social-web';
    process.env.POSTIZ_OAUTH_CLIENT_SECRET = 'test-only';
    process.env.FRONTEND_URL = 'https://social.codestra.co';
  });

  it('requires state and an S256 PKCE challenge', () => {
    const provider = new OauthProvider();
    const link = new URL(
      provider.generateLink({
        state: 'state-value',
        codeChallenge: 'challenge-value',
      })
    );

    expect(link.searchParams.get('state')).toBe('state-value');
    expect(link.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(link.searchParams.get('code_challenge_method')).toBe('S256');
    expect(link.searchParams.get('redirect_uri')).toBe(
      'https://social.codestra.co/settings'
    );
  });

  it('fails closed when state or PKCE is absent', () => {
    expect(() => new OauthProvider().generateLink()).toThrow(
      'OIDC state and PKCE challenge are required'
    );
  });
});
