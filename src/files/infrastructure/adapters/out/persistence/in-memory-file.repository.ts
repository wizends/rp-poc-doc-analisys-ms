import { Injectable } from '@nestjs/common';
import { FileRepositoryPort } from '../../../../domain/ports/file.repository.port';
import { FileEntity, ErrorLogEntity } from '../../../../domain/entities/file.entity';

@Injectable()
export class InMemoryFileRepository implements FileRepositoryPort {
  private files: Map<string, FileEntity> = new Map();
  private errors: Map<string, ErrorLogEntity[]> = new Map();

  async saveFile(file: FileEntity): Promise<void> {
    this.files.set(file.id, file);
    this.errors.set(file.id, []);
  }

  async findById(id: string): Promise<FileEntity | null> {
    return this.files.get(id) || null;
  }

  async updateFile(file: FileEntity): Promise<void> {
    this.files.set(file.id, file);
  }

  async saveErrorLog(errorLog: ErrorLogEntity): Promise<void> {
    const fileErrors = this.errors.get(errorLog.fileId) || [];
    // Replace if it already exists, or push
    const index = fileErrors.findIndex(e => e.id === errorLog.id);
    if (index >= 0) {
      fileErrors[index] = errorLog;
    } else {
      fileErrors.push(errorLog);
    }
    this.errors.set(errorLog.fileId, fileErrors);
  }

  async findErrorsByFileId(fileId: string): Promise<ErrorLogEntity[]> {
    return this.errors.get(fileId) || [];
  }
}
