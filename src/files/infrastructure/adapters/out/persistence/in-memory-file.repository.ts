import { Injectable } from '@nestjs/common';
import { FileRepositoryPort } from '../../../../domain/ports/file.repository.port';
import { FileEntity, ErrorLogEntity } from '../../../../domain/entities/file.entity';
import { CompraEntity } from '../../../../domain/entities/compra.entity';

@Injectable()
export class InMemoryFileRepository implements FileRepositoryPort {
  private files: Map<string, FileEntity> = new Map();
  private errors: Map<string, ErrorLogEntity[]> = new Map();
  private compras: Map<string, CompraEntity[]> = new Map();


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

  async findByHash(hash: string): Promise<FileEntity | null> {
    for (const file of this.files.values()) {
      if (file.fileHash === hash) {
        return file;
      }
    }
    return null;
  }

  async saveCompra(compra: CompraEntity): Promise<void> {
    const fileCompras = this.compras.get(compra.fileId) || [];
    fileCompras.push(compra);
    this.compras.set(compra.fileId, fileCompras);
  }

  async upsertCompra(compra: CompraEntity): Promise<void> {
    const fileCompras = this.compras.get(compra.fileId) || [];
    const index = fileCompras.findIndex(c => c.idTransaccion === compra.idTransaccion);
    if (index >= 0) {
      fileCompras[index] = compra;
    } else {
      fileCompras.push(compra);
    }
    this.compras.set(compra.fileId, fileCompras);
  }

  async incrementProgress(id: string): Promise<{ file: FileEntity; justCompleted: boolean } | null> {
    const file = this.files.get(id);
    if (!file) return null;

    file.processedRecords += 1;
    let justCompleted = false;

    if (file.processedRecords >= file.totalRecords && file.status !== 'COMPLETED') {
      file.status = 'COMPLETED';
      justCompleted = true;
    }

    return { file, justCompleted };
  }
  async findAll(): Promise<FileEntity[]> {
    return Array.from(this.files.values());
  }
}
