import type { ErrorRequestHandler } from 'express';

import { AppError } from '../errors/AppError';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const error = err instanceof AppError ? err : new AppError('Internal Server Error');

  if (process.env.NODE_ENV !== 'production' && !(err instanceof AppError)) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(error.statusCode).json({
    status: 'error',
    message: error.message,
  });
};
