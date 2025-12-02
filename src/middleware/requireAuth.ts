import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

interface JwtPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  console.log('[AUTH] requireAuth middleware - checking cookies:', Object.keys(req.cookies));
  const token = req.cookies[env.jwtCookieName];
  console.log('[AUTH] Token present:', !!token, 'Cookie name:', env.jwtCookieName);

  if (!token) {
    console.log('[AUTH] No token found in cookies');
    return next(new AppError('Not authenticated', 401));
  }

  try {
    console.log('[AUTH] Verifying token...');
    const decoded = jwt.verify(token, env.jwtSecret);
    console.log('[AUTH] Token decoded:', decoded);

    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('userId' in decoded) ||
      !('email' in decoded)
    ) {
      console.error('[AUTH] Invalid token structure');
      return next(new AppError('Invalid token', 401));
    }

    const payload = decoded as JwtPayload;
    console.log('[AUTH] Token valid, user:', { id: payload.userId, email: payload.email });

    req.user = {
      id: payload.userId,
      email: payload.email,
    };
    next();
  } catch (error) {
    console.error('[AUTH] Token verification failed:', error);
    next(new AppError('Invalid token', 401));
  }
};
