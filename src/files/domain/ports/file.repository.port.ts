import { FileEntity, ErrorLogEntity } from '../entities/file.entity';
import { CompraEntity } from '../entities/compra.entity';

export const FILE_REPOSITORY_PORT = 'FILE_REPOSITORY_PORT';

export interface FileRepositoryPort {
  saveFile(file: FileEntity): Promise<void>;
  findById(id: string): Promise<FileEntity | null>;
  updateFile(file: FileEntity): Promise<void>;
  saveErrorLog(errorLog: ErrorLogEntity): Promise<void>;
  findErrorsByFileId(fileId: string): Promise<ErrorLogEntity[]>;
  findByHash(hash: string): Promise<FileEntity | null>;
  saveCompra(compra: CompraEntity): Promise<void>;
}
