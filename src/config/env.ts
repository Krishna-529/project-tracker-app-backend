import 'dotenv/config';

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} environment variable is not set`);
  }
  return value;
};

export const env = {
  googleClientId: getRequiredEnv('GOOGLE_CLIENT_ID'),
  googleClientSecret: getRequiredEnv('GOOGLE_CLIENT_SECRET'),
  googleRedirectUri: getRequiredEnv('GOOGLE_REDIRECT_URI'),
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  jwtCookieName: process.env.JWT_COOKIE_NAME ?? 'project_tracker_token',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173',
  cookieDomain: process.env.COOKIE_DOMAIN,
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  dailyQuestDatabaseUrl: getRequiredEnv('DAILY_QUEST_DATABASE_URL'),
  nodeEnv: process.env.NODE_ENV || 'development'
};
