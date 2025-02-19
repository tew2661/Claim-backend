import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';
import { configPath } from './path-files-config';
import { join } from 'node:path';
import { JwtAuthMiddlewareImageUser } from './middlewares/jwt-auth.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const origin: any = process.env.NEST_ENABLECORS ? process.env.NEST_ENABLECORS.split(',') : [true]
  // app.useGlobalPipes(new ValidationPipe({
  //   transform: true, // เปิดการแปลงประเภทข้อมูล
  //   whitelist: true, // ลบค่าที่ไม่ได้ระบุใน DTO
  // }));
  app.useGlobalPipes(new ValidationPipe({
    transform: true, // เปิดการแปลงข้อมูลใน DTO
  }));
  app.setGlobalPrefix(process.env.NEST_GLOBALPREFIX);
  app.enableCors({
    origin: origin,
    credentials: true,
  });

  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  app.use(`/api/v1/${configPath.pathStaticFiles}`, new JwtAuthMiddlewareImageUser().use);
  app.useStaticAssets(join(__dirname, '..', ...configPath.pathStaticFiles.split('/')), {
    prefix: `/api/v1/${configPath.pathStaticFiles}/`, // URL path ที่สามารถเข้าถึงได้
  });

  // app.use(cookieParser());
  await app.listen(process.env.NEST_PORT ?? 3000);
}
bootstrap();
