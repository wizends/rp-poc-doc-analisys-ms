import { Injectable, Inject } from '@nestjs/common';
import { FILE_REPOSITORY_PORT } from '../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../domain/ports/file.repository.port';
import { QUEUE_SERVICE_PORT } from '../../domain/ports/queue.service.port';
import type { QueueServicePort } from '../../domain/ports/queue.service.port';
import { FileEntity } from '../../domain/entities/file.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadFileUseCase {
  constructor(
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
    @Inject(QUEUE_SERVICE_PORT)
    private readonly queueService: QueueServicePort,
  ) {}

  async execute(filename: string, fileUrl: string, totalRecords: number): Promise<string> {
    const fileId = randomUUID();
    const fileEntity = new FileEntity(
      fileId,
      filename,
      'PENDING',
      totalRecords,
      0,
      fileUrl
    );

    await this.fileRepository.saveFile(fileEntity);
    
    // Publish to the queue for background processing
    await this.queueService.enqueueFileProcessing(fileId);

    return fileId;
  }
}
