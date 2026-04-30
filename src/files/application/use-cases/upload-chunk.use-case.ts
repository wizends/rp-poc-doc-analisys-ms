import { Injectable, Inject } from '@nestjs/common';
import { FILE_REPOSITORY_PORT } from '../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../domain/ports/file.repository.port';

export interface UploadChunkResult {
  receivedChunks: number;
  totalChunks: number;
}

@Injectable()
export class UploadChunkUseCase {
  constructor(
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
  ) {}

  async execute(fileId: string, chunkIndex: number, data: string): Promise<UploadChunkResult> {
    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new Error(`Archivo no encontrado: ${fileId}`);
    }

    if (file.status !== 'UPLOADING') {
      throw new Error(`El archivo ${fileId} no está en estado de carga (estado actual: ${file.status})`);
    }

    const receivedChunks = file.addChunk(chunkIndex, data);
    await this.fileRepository.updateFile(file);

    console.log(`[UploadChunk] Chunk ${chunkIndex} recibido para ${fileId} (${receivedChunks}/${file.totalChunks})`);

    return {
      receivedChunks,
      totalChunks: file.totalChunks,
    };
  }
}
