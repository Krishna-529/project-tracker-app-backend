import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { dailyQuestDb } from '../db/dailyQuest';
import { users as dailyQuestUsers } from '../db/dailyQuestSchema';
import { googleAuthService } from '../services/googleAuth';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

const signToken = (userId: string, email: string) => {
  return jwt.sign({ userId, email }, env.jwtSecret, {
    expiresIn: '7d',
  });
};

const createSendToken = (user: typeof users.$inferSelect, statusCode: number, res: Response) => {
  console.log('[AUTH] Creating token for user:', { id: user.id, email: user.email });
  const token = signToken(user.id, user.email);

  const isProd = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: isProd,                    // must be true for cross-site cookies
    sameSite: 'none' as const,         // REQUIRED for Netlify → Render cookies
    domain: env.cookieDomain || undefined
  };

  console.log('[AUTH] Setting cookie:', {
    cookieName: env.jwtCookieName,
    options: cookieOptions,
    tokenLength: token.length
  });

  res.cookie(env.jwtCookieName, token, cookieOptions);

  user.googleId = undefined as any;

  res.status(statusCode).json({
    status: 'success',
    data: { user },
  });
};


export const getGoogleUrl = (req: Request, res: Response) => {
  console.log('[AUTH] Getting Google OAuth URL');
  const url = googleAuthService.getAuthorizationUrl();
  console.log('[AUTH] Generated OAuth URL:', url);
  res.json({ url });
};

export const googleCallback = async (req: Request, res: Response, next: NextFunction) => {
  console.log('[AUTH] Google callback received');
  const { code } = req.query;
  console.log('[AUTH] Authorization code present:', !!code);

  if (!code || typeof code !== 'string') {
    console.error('[AUTH] No authorization code in request');
    return next(new AppError('Authorization code missing', 400));
  }

  try {
    console.log('[AUTH] Exchanging code for tokens...');
    const tokens = await googleAuthService.getTokens(code);
    console.log('[AUTH] Tokens received:', { hasIdToken: !!tokens.id_token, hasAccessToken: !!tokens.access_token });
    
    if (!tokens.id_token) {
      console.error('[AUTH] No ID token in response');
      return next(new AppError('Google did not return an ID token', 400));
    }

    console.log('[AUTH] Getting user info from Google...');
    const googleUser = await googleAuthService.getUserInfo(tokens.id_token);
    console.log('[AUTH] Google user info:', { email: googleUser?.email, sub: googleUser?.sub, name: googleUser?.name });

    if (!googleUser || !googleUser.email || !googleUser.sub) {
      console.error('[AUTH] Invalid user info from Google');
      return next(new AppError('Failed to get user info from Google', 400));
    }

    // Check if user exists in Project Tracker database
    console.log('[AUTH] Checking if user exists in Project Tracker database...');
    let [user] = await db.select().from(users).where(eq(users.googleId, googleUser.sub));

    if (!user) {
      console.log('[AUTH] User not found in Project Tracker, creating new user...');
      [user] = await db
        .insert(users)
        .values({
          googleId: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
          avatarUrl: googleUser.picture,
        })
        .returning();
      console.log('[AUTH] New user created in Project Tracker:', { id: user.id, email: user.email });
    } else {
      console.log('[AUTH] User found in Project Tracker, updating info...');
      [user] = await db
          .update(users)
          .set({
              name: googleUser.name,
              avatarUrl: googleUser.picture,
              updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
          .returning();
      console.log('[AUTH] User updated in Project Tracker:', { id: user.id, email: user.email });
    }

   // Now check the user in Daily Quest (Supabase auth schema is read-only)
    console.log('[AUTH] Checking user presence in Daily Quest auth schema...');

    if (process.env.SKIP_DAILY_QUEST === 'true') {
      console.log('[AUTH] SKIP_DAILY_QUEST=true -> skipping Daily Quest lookup (temporary)');
    } else {
      try {
        // This may fail or timeout if the remote DB is unreachable; catch so login still succeeds
        const [existingDailyQuestUser] = await dailyQuestDb
          .select()
          .from(dailyQuestUsers)
          .where(eq(dailyQuestUsers.id, user.id));

        if (existingDailyQuestUser) {
          console.log('[AUTH] User exists in Daily Quest auth.users:', { id: existingDailyQuestUser.id });
        } else {
          console.log('[AUTH] User not found in Daily Quest auth.users by UUID. This table is read-only; skipping sync.');
        }
      } catch (dailyQuestError) {
        console.error('[AUTH] ⚠️ Failed to query Daily Quest auth.users (non-fatal):', dailyQuestError && (dailyQuestError.message ?? dailyQuestError));
        // NOTE: we intentionally do not throw here — we want the OAuth flow to continue even if DailyQuest is down
      }
    }


    console.log('[AUTH] Sending token response...');
    createSendToken(user, 200, res);
  } catch (error) {
    console.error('[AUTH] Google Auth Error:', error);
    console.error('[AUTH] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    next(new AppError('Failed to authenticate with Google', 500));
  }
};

export const logout = (req: Request, res: Response) => {
  console.log('[AUTH] Logout called');

  const isProd = process.env.NODE_ENV === 'production';

  res.cookie(env.jwtCookieName, 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: isProd,
    sameSite: 'none' as const,
    domain: env.cookieDomain || undefined
  });

  console.log('[AUTH] Cookie cleared');
  res.status(200).json({ status: 'success' });
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  console.log('[AUTH] getMe called, user from request:', req.user);
  
  if (!req.user) {
    console.log('[AUTH] No user in request, not authenticated');
    return next(new AppError('Not authenticated', 401));
  }

  console.log('[AUTH] Fetching user from database:', req.user.id);
  const [user] = await db.select().from(users).where(eq(users.id, req.user.id));

  if (!user) {
    console.error('[AUTH] User not found in database:', req.user.id);
    return next(new AppError('User not found', 404));
  }

  console.log('[AUTH] User found, sending response:', { id: user.id, email: user.email });
  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
};
