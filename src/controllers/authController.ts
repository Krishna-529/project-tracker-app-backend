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

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: env.cookieSecure,
    domain: env.cookieDomain,
    sameSite: 'lax' as const,
  };

  console.log('[AUTH] Setting cookie:', {
    cookieName: env.jwtCookieName,
    options: cookieOptions,
    tokenLength: token.length
  });

  res.cookie(env.jwtCookieName, token, cookieOptions);

  user.googleId = undefined as any; // Remove sensitive data from output

  res.status(statusCode).json({
    status: 'success',
    data: {
      user,
    },
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

    // Now sync the user to Daily Quest database
    console.log('[AUTH] Syncing user to Daily Quest database...');
    try {
      const [existingDailyQuestUser] = await dailyQuestDb
        .select()
        .from(dailyQuestUsers)
        .where(eq(dailyQuestUsers.googleId, googleUser.sub));

      if (existingDailyQuestUser) {
        console.log('[AUTH] User exists in Daily Quest, updating...');
        await dailyQuestDb
          .update(dailyQuestUsers)
          .set({
            name: googleUser.name,
            avatarUrl: googleUser.picture,
            updatedAt: new Date(),
          })
          .where(eq(dailyQuestUsers.id, existingDailyQuestUser.id));
        console.log('[AUTH] Daily Quest user updated:', { id: existingDailyQuestUser.id });
      } else {
        console.log('[AUTH] Creating new user in Daily Quest with same UUID from Project Tracker...');
        await dailyQuestDb
          .insert(dailyQuestUsers)
          .values({
            id: user.id, // Use the SAME UUID from Project Tracker
            googleId: googleUser.sub,
            email: googleUser.email,
            name: googleUser.name,
            avatarUrl: googleUser.picture,
          });
        console.log('[AUTH] Daily Quest user created with ID:', user.id);
      }
      console.log('[AUTH] ✅ User successfully synced across both databases');
    } catch (dailyQuestError) {
      console.error('[AUTH] ⚠️ Failed to sync user to Daily Quest:', dailyQuestError);
      console.error('[AUTH] This will not prevent login, but "Send to Daily Quest" may fail');
      // Don't fail the login if Daily Quest sync fails
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
  res.cookie(env.jwtCookieName, 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: env.cookieSecure,
    domain: env.cookieDomain,
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
