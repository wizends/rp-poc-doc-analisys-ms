import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FILE_REPOSITORY_PORT } from './domain/ports/file.repository.port';
import { AI_SERVICE_PORT } from './domain/ports/ai.service.port';
import { QUEUE_SERVICE_PORT } from './domain/ports/queue.service.port';
import { FileSchema } from './infrastructure/adapters/out/persistence/schemas/file.schema';
import { ErrorLogSchema } from './infrastructure/adapters/out/persistence/schemas/error-log.schema';
import { FileChunkSchema } from './infrastructure/adapters/out/persistence/schemas/file-chunk.schema';
import { MysqlFileRepository } from './infrastructure/adapters/out/persistence/mysql-file.repository';
import { MockAiAdapter } from './infrastructure/adapters/out/ai/mock-ai.adapter';
import { BullMqAdapter } from './infrastructure/adapters/out/queue/bullmq.adapter';
import { InitUploadUseCase } from './application/use-cases/init-upload.use-case';
import { UploadChunkUseCase } from './application/use-cases/upload-chunk.use-case';
import { CompleteUploadUseCase } from './application/use-cases/complete-upload.use-case';
import { ProcessAiSummaryUseCase } from './application/use-cases/process-ai-summary.use-case';
import { ClassifyErrorsUseCase } from './application/use-cases/classify-errors.use-case';
import { FileController } from './infrastructure/adapters/in/web/file.controller';
import { FileProcessingProcessor } from './infrastructure/adapters/in/workers/file-processing.processor';
import { RowValidationProcessor } from './infrastructure/adapters/in/workers/row-validation.processor';
import { ValidationErrorProcessor } from './infrastructure/adapters/in/workers/validation-error.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileSchema, ErrorLogSchema, FileChunkSchema]),
    BullModule.registerQueue(
      { name: 'file-processing' },
      { name: 'row-validation' },
      { name: 'validation-errors' },
    ),
  ],
  controllers: [FileController],
  providers: [
    // Adapters
    {
      provide: FILE_REPOSITORY_PORT,
      useClass: MysqlFileRepository,
    },
    {
      provide: AI_SERVICE_PORT,
      useClass: MockAiAdapter,
    },
    {
      provide: QUEUE_SERVICE_PORT,
      useClass: BullMqAdapter,
    },
    // Workers
    FileProcessingProcessor,
    RowValidationProcessor,
    ValidationErrorProcessor,
    // Use Cases
    InitUploadUseCase,
    UploadChunkUseCase,
    CompleteUploadUseCase,
    ProcessAiSummaryUseCase,
    ClassifyErrorsUseCase,
  ],
  exports: [
    InitUploadUseCase,
    UploadChunkUseCase,
    CompleteUploadUseCase,
    ProcessAiSummaryUseCase,
    ClassifyErrorsUseCase,
  ]
})
export class FilesModule {}
