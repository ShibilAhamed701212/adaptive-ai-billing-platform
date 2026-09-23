import { createApp } from './app';
import { connectDB } from './config/db';
import { ENV, validateRuntimeEnvironment } from './config/env';
import { startCronJobs } from './jobs/scheduler';

async function bootstrap() {
  validateRuntimeEnvironment();

  const app = createApp();
  const port = Number(ENV.PORT) || 10000;

  // Listen immediately so Render health check probes pass without delay
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 [Server] Adaptive Billing Platform API running on port ${port}`);
    console.log(`⚡ [Environment] Node Env: ${ENV.NODE_ENV}`);
  });

  // Connect database & start background jobs
  try {
    await connectDB();
  } catch (err: any) {
    console.warn(`⚠️ [Database] Connection warning during startup: ${err.message}`);
  }

  startCronJobs();

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
