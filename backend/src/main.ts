import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { RedisIoAdapter } from './redis-io.adapter.js';

async function bootstrap() {
  // In production (the Dockerfile sets NODE_ENV) the API runs as several pods,
  // and in-memory rooms would silently drop events for sockets on other pods.
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    throw new Error('REDIS_URL must be set in production');
  }
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  // Without REDIS_URL (local dev only, one process) socket.io keeps rooms in memory.
  if (process.env.REDIS_URL) {
    const adapter = new RedisIoAdapter(app);
    await adapter.connectToRedis(process.env.REDIS_URL);
    app.useWebSocketAdapter(adapter);
  }
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
