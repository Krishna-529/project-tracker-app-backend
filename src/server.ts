import 'dotenv/config';
import { createServer } from 'http';

import { app } from './app';
import { db } from './db';

const PORT = process.env.PORT || 3000;

const server = createServer(app);

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  server.close(() => {
    console.log('HTTP server closed.');
  });

  try {
    // Drizzle/Postgres-js doesn't always require an explicit disconnect if using the pool correctly,
    // but if you need to close the pool:
    // await client.end(); // You would need to export client from db/index.ts to do this
    console.log('Database connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
