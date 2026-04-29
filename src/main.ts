import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Aumentar límite del body para recibir archivos en base64
  app.use(json({ limit: '200mb' }));

  const config = new DocumentBuilder()
    .setTitle('Análisis de Documentos API')
    .setDescription('API para la carga y procesamiento de archivos Excel')
    .setVersion('1.0')
    .addTag('files')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
