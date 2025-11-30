import type { NextFunction, Request, Response } from 'express';

export const catchAsync = <T extends Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) => {
  return async (req: T, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};
