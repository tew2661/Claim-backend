import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';

ConfigModule.forRoot();

const configService = new ConfigService();
const port = parseInt(configService.get<string>('DB_PORT') || '3306', 10);
export const dataSource = new DataSource({
    type: 'mssql',
    migrationsTableName: "migrations",
    host: configService.get<string>('DB_HOST'),
    port,
    username: configService.get<string>('DB_USER'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_NAME'),
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
    entities: [__dirname + '/**/entities/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: configService.get<string>('DB_SYNC') == 'true',
    logging: configService.get<string>('DB_LOGGING') == 'true',
});
