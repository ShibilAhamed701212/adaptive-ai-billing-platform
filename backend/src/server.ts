import { createApp } from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';

import { startCronJobs } from './jobs/scheduler';

async function bootstrap() {
  await connectDB();
  const app = createApp();

  // Start background jobs
  startCronJobs();

  const server = app.listen(ENV.PORT, () => {
    console.log(`🚀 [Server] Adaptive Billing Platform API running on http://localhost:${ENV.PORT}`);
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
