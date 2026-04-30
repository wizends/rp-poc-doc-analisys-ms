import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

// Ports & Adapters
import { FILE_REPOSITORY_PORT } from './domain/ports/file.repository.port';
import { AI_SERVICE_PORT } from './domain/ports/ai.service.port';
import { QUEUE_SERVICE_PORT } from './domain/ports/queue.service.port';
import { MysqlFileRepository } from './infrastructure/adapters/out/persistence/mysql-file.repository';
import { MockAiAdapter } from './infrastructure/adapters/out/ai/mock-ai.adapter';
import { BullMqAdapter } from './infrastructure/adapters/out/queue/bullmq.adapter';

// Schemas
import { FileSchema } from './infrastructure/adapters/out/persistence/schemas/file.schema';
import { ErrorLogSchema } from './infrastructure/adapters/out/persistence/schemas/error-log.schema';
import { FileChunkSchema } from './infrastructure/adapters/out/persistence/schemas/file-chunk.schema';
import { CompraSchema } from './infrastructure/adapters/out/persistence/schemas/compra.schema';

// Use Cases & Services
import { InitUploadUseCase } from './application/use-cases/init-upload.use-case';
import { UploadChunkUseCase } from './application/use-cases/upload-chunk.use-case';
import { CompleteUploadUseCase } from './application/use-cases/complete-upload.use-case';
import { ProcessAiSummaryUseCase } from './application/use-cases/process-ai-summary.use-case';
import { ClassifyErrorsUseCase } from './application/use-cases/classify-errors.use-case';
import { GetFileErrorsUseCase } from './application/use-cases/get-file-errors.use-case';
import { ListFilesUseCase } from './application/use-cases/list-files.use-case';
import { FileProgressService } from './application/services/file-progress.service';

// Controllers & Workers
import { FileController } from './infrastructure/adapters/in/web/file.controller';
import { FileProcessingFastProcessor, FileProcessingSlowProcessor } from './infrastructure/adapters/in/workers/file-processing.processor';
import { ValidationErrorProcessor } from './infrastructure/adapters/in/workers/validation-error.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileSchema, ErrorLogSchema, FileChunkSchema, CompraSchema]),
    BullModule.registerQueue(
      // Colas de procesamiento de archivos (cada archivo = 1 worker dedicado)
      { name: 'file-processing-fast' },
      { name: 'file-processing-slow' },
      // Cola de errores para clasificación IA
      { name: 'validation-errors' },
    ),
  ],
  controllers: [FileController],
  providers: [
    { provide: FILE_REPOSITORY_PORT, useClass: MysqlFileRepository },
    { provide: AI_SERVICE_PORT, useClass: MockAiAdapter },
    { provide: QUEUE_SERVICE_PORT, useClass: BullMqAdapter },

    // Workers: cada archivo obtiene su propio worker dedicado
    FileProcessingFastProcessor,
    FileProcessingSlowProcessor,
    ValidationErrorProcessor,

    // Use Cases
    InitUploadUseCase,
    UploadChunkUseCase,
    CompleteUploadUseCase,
    ProcessAiSummaryUseCase,
    ClassifyErrorsUseCase,
    GetFileErrorsUseCase,
    ListFilesUseCase,
    FileProgressService,
  ],
  exports: [
    InitUploadUseCase,
    UploadChunkUseCase,
    CompleteUploadUseCase,
    ProcessAiSummaryUseCase,
    ClassifyErrorsUseCase,
    GetFileErrorsUseCase,
    ListFilesUseCase,
  ],
})
export class FilesModule { }