import { Module, forwardRef } from '@nestjs/common';
import { SupplierController } from './supplier.controller';
import { SupplierService } from './supplier.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'auth/auth.module';
import { UsersEntity } from 'src/users/entities/users.entity';
import { SupplierEntity } from './entities/supplier.entity';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [SupplierController],
  providers: [SupplierService],
  imports: [
    TypeOrmModule.forFeature([
      SupplierEntity , 
    ]),
    forwardRef(() => AuthModule),
    UsersModule
  ]
})
export class SupplierModule {}
