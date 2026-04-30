import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

// Ports & Adapters
import { FILE_REPOSITORY_PORT } from './domain/ports/file.repository.port';
import { AI_SERVICE_PORT } from './domain/ports/ai.service.port';
import { QUEUE_SERVICE_PORT } from './domain/ports/queue.service.port';
import { MysqlFileRepository } from './infrastructure/adapters/out/persistence/mysql-file.repository';
import { GeminiAiAdapter } from './infrastructure/adapters/out/ai/gemini-ai.adapter';
import { BullMqAdapter } from './infrastructure/adapters/out/queue/bullmq.adapter';
import { GeminiClassificationProcessor } from './infrastructure/adapters/in/workers/gemini-classification.processor';

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
import { RowSaveProcessor } from './infrastructure/adapters/in/workers/row-save.processor';
import { ValidationErrorProcessor } from './infrastructure/adapters/in/workers/validation-error.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileSchema, ErrorLogSchema, FileChunkSchema, CompraSchema]),
    BullModule.registerQueue(
      // Etapa 1: Lectura + validación CPU (jobs rápidos, ~5s)
      { name: 'file-processing-fast' },
      { name: 'file-processing-slow' },
      // Etapa 2: Persistencia en BD (500 filas/job, ~2s por job, continuation pattern)
      { name: 'row-save' },
      // Errores
      { name: 'validation-errors' },
      // AI Classification
      { name: 'gemini-classification' },
    ),
  ],
  controllers: [FileController],
  providers: [
    { provide: FILE_REPOSITORY_PORT, useClass: MysqlFileRepository },
    { provide: AI_SERVICE_PORT, useClass: GeminiAiAdapter },
    { provide: QUEUE_SERVICE_PORT, useClass: BullMqAdapter },

    // Etapa 1: Parse + Validación
    FileProcessingFastProcessor,
    FileProcessingSlowProcessor,

    // Etapa 2: Persistencia en BD
    RowSaveProcessor,

    // Errores
    ValidationErrorProcessor,
    GeminiClassificationProcessor,

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