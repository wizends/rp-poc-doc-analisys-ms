import { Injectable, Inject } from '@nestjs/common';
import { FILE_REPOSITORY_PORT } from '../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../domain/ports/file.repository.port';
import { FileEntity } from '../../domain/entities/file.entity';

@Injectable()
export class ListFilesUseCase {
  constructor(
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
  ) {}

  async execute(): Promise<FileEntity[]> {
    return this.fileRepository.findAll();
  }
}
