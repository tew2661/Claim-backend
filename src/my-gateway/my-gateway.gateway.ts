import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const origin: any = process.env.NEST_ENABLECORS ? process.env.NEST_ENABLECORS.split(',') : [true]
const host: string = process.env.REDIS_HOST ? process.env.REDIS_HOST : ''
const port: string = process.env.REDIS_PORT ? process.env.REDIS_PORT : ''
const pass: string = process.env.REDIS_PASSWORD ? process.env.REDIS_PASSWORD : ''
const username: string = process.env.REDIS_USER ? process.env.REDIS_USER : ''
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
