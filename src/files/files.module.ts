import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FILE_REPOSITORY_PORT } from './domain/ports/file.repository.port';
import { AI_SERVICE_PORT } from './domain/ports/ai.service.port';
import { QUEUE_SERVICE_PORT } from './domain/ports/queue.service.port';
import { InMemoryFileRepository } from './infrastructure/adapters/out/persistence/in-memory-file.repository';
import { MockAiAdapter } from './infrastructure/adapters/out/ai/mock-ai.adapter';
import { BullMqAdapter } from './infrastructure/adapters/out/queue/bullmq.adapter';
import { UploadFileUseCase } from './application/use-cases/upload-file.use-case';
import { ProcessAiSummaryUseCase } from './application/use-cases/process-ai-summary.use-case';
import { ClassifyErrorsUseCase } from './application/use-cases/classify-errors.use-case';
import { FileController } from './infrastructure/adapters/in/web/file.controller';
import { FileProcessingProcessor } from './infrastructure/adapters/in/workers/file-processing.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'file-processing',
    }),
  ],
  controllers: [FileController],
  providers: [
    // Adapters
    {
      provide: FILE_REPOSITORY_PORT,
      useClass: InMemoryFileRepository,
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
    // Use Cases
    UploadFileUseCase,
    ProcessAiSummaryUseCase,
    ClassifyErrorsUseCase,
  ],
  exports: [
    UploadFileUseCase,
    ProcessAiSummaryUseCase,
    ClassifyErrorsUseCase,
  ]
})
export class FilesModule {}
