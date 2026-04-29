import { Injectable, Inject } from '@nestjs/common';
import { FILE_REPOSITORY_PORT } from '../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../domain/ports/file.repository.port';
import { FileEntity } from '../../domain/entities/file.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class InitUploadUseCase {
  constructor(
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
  ) { }

  async execute(filename: string, totalChunks: number): Promise<string> {
    const fileId = randomUUID();
    const fileEntity = new FileEntity(
      fileId,
      filename,
      'UPLOADING',
      totalChunks,
    );

    await this.fileRepository.saveFile(fileEntity);
    console.log(`[InitUpload] Sesión de upload iniciada: ${fileId} (${totalChunks} chunks esperados)`);

    return fileId;
  }
}
