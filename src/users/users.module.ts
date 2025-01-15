import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersEntity } from './entities/users.entity';
import { AuthModule } from 'src/auth/auth.module';
import { NotificationModule } from 'src/my-gateway/my-gateway.module';

@Module({
  imports:[
    TypeOrmModule.forFeature([
      UsersEntity , 
    ]),
    forwardRef(() => AuthModule),
    NotificationModule
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
