import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const origin: any = process.env.NEST_ENABLECORS ? process.env.NEST_ENABLECORS.split(',') : [true]
  app.useGlobalPipes(new ValidationPipe({
    transform: true, // เปิดการแปลงประเภทข้อมูล
    whitelist: false, // ลบค่าที่ไม่ได้ระบุใน DTO
    forbidNonWhitelisted: true, // ป้องกันค่าที่ไม่ได้ระบุใน DTO
  }));
  app.setGlobalPrefix(process.env.NEST_GLOBALPREFIX);
  app.enableCors({
    origin: origin,
    credentials: true,
  });

  app.use(cookieParser());
  await app.listen(process.env.NEST_PORT ?? 3000);
}
bootstrap();
