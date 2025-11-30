import type { NextFunction, Request, Response } from 'express';
import type { AnyZodObject } from 'zod';

import { AppError } from '../errors/AppError';

export const validateRequest = (schema: AnyZodObject) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parseResult = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!parseResult.success) {
      const message = parseResult.error.issues
        .map((issue) => issue.message)
        .join('; ');
      return next(new AppError(message, 400));
    }

    req.body = parseResult.data.body;
    req.params = parseResult.data.params as unknown as typeof req.params;
    req.query = parseResult.data.query as unknown as typeof req.query;

    return next();
  };
};
