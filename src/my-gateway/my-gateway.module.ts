// notification.module.ts
import { Module } from '@nestjs/common';
import { MyGatewayGateway } from './my-gateway.gateway';

@Module({
  providers: [MyGatewayGateway],
  exports: [MyGatewayGateway], // Export เพื่อให้ Module อื่นเรียกใช้ได้
})
export class NotificationModule {}
