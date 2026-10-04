import { createApp } from './app';
import { connectDB } from './config/db';
import { ENV, validateRuntimeEnvironment } from './config/env';
import { startCronJobs } from './jobs/scheduler';

async function bootstrap() {
  try {
    validateRuntimeEnvironment();
  } catch (err: any) {
    console.error(`❌ [Config] ${err.message}`);
    process.exit(1);
  }

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
    console.error(`❌ [Database] Startup failed: ${err.message}`);
    // Without a database the API cannot serve anyone; exit so the platform restarts or rolls back.
    process.exit(1);
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
