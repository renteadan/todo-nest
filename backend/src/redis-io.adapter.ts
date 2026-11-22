import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { type ServerOptions } from 'socket.io';

/**
 * socket.io over Redis pub/sub, so an event emitted on one API pod reaches
 * the sockets connected to the others.
 */
export class RedisIoAdapter extends IoAdapter {
  private clients: { quit(): Promise<unknown> }[] = [];
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  async connectToRedis(url: string): Promise<void> {
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();
    // Without a listener an 'error' event crashes the process; the clients
    // reconnect by themselves, so a Redis restart only delays events.
    const logError = (error: Error) =>
      this.logger.error(`Redis: ${error.message}`);
    pubClient.on('error', logError);
    subClient.on('error', logError);
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.clients = [pubClient, subClient];
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }

  async dispose(): Promise<void> {
    await super.dispose();
    await Promise.all(this.clients.map((client) => client.quit()));
  }
}
