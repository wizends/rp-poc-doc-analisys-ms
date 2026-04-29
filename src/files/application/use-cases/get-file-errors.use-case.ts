import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { FILE_REPOSITORY_PORT } from '../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../domain/ports/file.repository.port';
import { ErrorLogEntity } from '../../domain/entities/file.entity';

@Injectable()
export class GetFileErrorsUseCase {
  constructor(
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
  ) {}

  async execute(fileId: string): Promise<ErrorLogEntity[]> {
    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new NotFoundException(`File con id ${fileId} no encontrado`);
    }

    return this.fileRepository.findErrorsByFileId(fileId);
  }
}
