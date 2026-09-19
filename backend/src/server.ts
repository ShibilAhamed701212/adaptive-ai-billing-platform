import { createApp } from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';

import { startCronJobs } from './jobs/scheduler';

async function bootstrap() {
  await connectDB();
  const app = createApp();

  // Start background jobs
  startCronJobs();

  const port = Number(ENV.PORT) || 10000;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 [Server] Adaptive Billing Platform API running on port ${port}`);
    console.log(`⚡ [Environment] Node Env: ${ENV.NODE_ENV}`);
  });

  const shutdown = () => {
    console.log('Shutting down server gracefully...');
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap();
