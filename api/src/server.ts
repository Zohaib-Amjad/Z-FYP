import { createApp } from './app';
import { env } from './config/env';
import { disconnectPrisma } from './config/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(
    `Prestige Test Drive API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`,
  );
});

const shutdown = (signal: string): void => {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    disconnectPrisma()
      .catch(error => console.error('Error while disconnecting from the database', error))
      .finally(() => process.exit(0));
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
