import { FileEntity, ErrorLogEntity } from '../entities/file.entity';

export const FILE_REPOSITORY_PORT = 'FILE_REPOSITORY_PORT';

export interface FileRepositoryPort {
  saveFile(file: FileEntity): Promise<void>;
  findById(id: string): Promise<FileEntity | null>;
  updateFile(file: FileEntity): Promise<void>;
  saveErrorLog(errorLog: ErrorLogEntity): Promise<void>;
  findErrorsByFileId(fileId: string): Promise<ErrorLogEntity[]>;
}
