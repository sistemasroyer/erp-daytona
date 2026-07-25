import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import * as morgan from 'morgan';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3000;
  const nodeEnv = configService.get<string>('nodeEnv');
  const frontendUrl = configService.get<string>('frontendUrl');
  const corsOrigins = configService.get<string[]>('corsOrigins') || [frontendUrl];

  // Seguridad HTTP
  app.use(helmet.default({
    contentSecurityPolicy: nodeEnv === 'production',
    crossOriginEmbedderPolicy: false,
  }));

  // Compresión GZIP
  app.use(compression());

  // Cookies
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Token'],
  });

  // Logs HTTP
  if (nodeEnv !== 'production') {
    app.use(morgan('dev'));
  } else {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    app.use(morgan('combined'));
  }

  // Prefijo global de API
  app.setGlobalPrefix('api/v1');

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
    }),
  );

  // Swagger (solo en desarrollo)
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ERP Daytona API')
      .setDescription('API REST del ERP Comercial Daytona para Perú')
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .addServer(`http://localhost:${port}`, 'Desarrollo')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });

    logger.log(`Swagger disponible en: http://localhost:${port}/api/docs`);
  }

  // Crear directorios de almacenamiento
  const storageDirs = ['storage', 'storage/xmls', 'storage/pdfs', 'storage/certs', 'logs', 'logs/pm2'];
  for (const dir of storageDirs) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  }

  await app.listen(port);

  logger.log(`ERP Daytona corriendo en: http://localhost:${port}`);
  logger.log(`API Base URL: http://localhost:${port}/api/v1`);
  logger.log(`Entorno: ${nodeEnv}`);
}

bootstrap().catch((err) => {
  console.error('Error iniciando la aplicación:', err);
  process.exit(1);
});
