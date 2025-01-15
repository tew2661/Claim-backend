import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const origin: any = process.env.NEST_ENABLECORS ? process.env.NEST_ENABLECORS.split(',') : [true]

@WebSocketGateway({ 
  cors: {
    origin: origin ,
  },
  transports: ['websocket'],
  methods: ['GET', 'POST'],
  credentials: true,
})
export class MyGatewayGateway { 
  @WebSocketServer()
  server: Server;

  async afterInit(server: Server) {
    const host: string = process.env.NEST_REDIS_HOST ? process.env.NEST_REDIS_HOST : ''
    const port: string = process.env.NEST_REDIS_PORT ? process.env.NEST_REDIS_PORT : ''
    const pass: string = process.env.NEST_REDIS_PASSWORD ? process.env.NEST_REDIS_PASSWORD : ''
    const username: string = process.env.NEST_REDIS_USER ? process.env.NEST_REDIS_USER : ''

    const pubClient = createClient({ 
      url: `redis://${host}:${port}` ,
      password: pass, // ใส่ Password
    });
    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    server.adapter(createAdapter(pubClient, subClient));
  }

  sendMessage(event: string, message: any) {
    this.server.emit(event, message);
  }
}
