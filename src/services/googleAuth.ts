import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';

const client = new OAuth2Client(
  env.googleClientId,
  env.googleClientSecret,
  env.googleRedirectUri
);

export const googleAuthService = {
  getAuthorizationUrl: () => {
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      include_granted_scopes: true,
    });
  },

  getTokens: async (code: string) => {
    const { tokens } = await client.getToken(code);
    return tokens;
  },

  getUserInfo: async (idToken: string) => {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
    return ticket.getPayload();
  },
};
