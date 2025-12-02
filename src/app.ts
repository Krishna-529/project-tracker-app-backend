import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { AppError } from './errors/AppError';
import { errorHandler } from './middleware/errorHandler';
import { nodeRoutes } from './routes/nodeRoutes';
import { authRoutes } from './routes/authRoutes';
import { integrationRoutes } from './routes/integrationRoutes';

const app = express();


app.disable('x-powered-by');
app.set('etag', false);

app.use(helmet());
app.use(compression());

const allowedOrigins = (process.env.CORS_ORIGIN ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/nodes', nodeRoutes);
app.use('/api/v1/integrations', integrationRoutes);

app.use((req, _res, next) => {

  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

app.use(errorHandler);

export { app };
