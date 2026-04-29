import { Injectable, Inject } from '@nestjs/common';
import { FILE_REPOSITORY_PORT } from '../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../domain/ports/file.repository.port';
import { QUEUE_SERVICE_PORT } from '../../domain/ports/queue.service.port';
import type { QueueServicePort } from '../../domain/ports/queue.service.port';

export interface CompleteUploadResult {
  fileId: string;
  totalBytes: number;
}

@Injectable()
export class CompleteUploadUseCase {
  constructor(
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
    @Inject(QUEUE_SERVICE_PORT)
    private readonly queueService: QueueServicePort,
  ) {}

  async execute(fileId: string): Promise<CompleteUploadResult> {
    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new Error(`Archivo no encontrado: ${fileId}`);
    }

    if (file.status !== 'UPLOADING') {
      throw new Error(`El archivo ${fileId} no está en estado de carga (estado actual: ${file.status})`);
    }

    if (!file.allChunksReceived) {
      throw new Error(
        `Faltan chunks: recibidos ${file.chunks.size}/${file.totalChunks}`
      );
    }

    // Ensamblar todos los chunks en un solo base64
    const fullBase64 = file.assembleChunks();
    const totalBytes = Buffer.from(fullBase64, 'base64').length;

    file.status = 'PENDING';
    await this.fileRepository.updateFile(file);

    console.log(`[CompleteUpload] Archivo ${fileId} ensamblado (${totalBytes} bytes). Encolando procesamiento...`);

    // Encolar para procesamiento
    await this.queueService.enqueueFileProcessing(fileId);

    return { fileId, totalBytes };
  }
}
