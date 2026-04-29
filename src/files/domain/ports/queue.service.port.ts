import { RowValidationResult } from '../validators/row.validator';

export const QUEUE_SERVICE_PORT = 'QUEUE_SERVICE_PORT';

export interface QueueServicePort {
  /** Encola el archivo para procesamiento inicial (lectura del Excel) */
  enqueueFileProcessing(fileId: string): Promise<void>;

  /** Encola una fila individual para validación campo por campo */
  enqueueRowValidation(fileId: string, row: Record<string, any>, rowNumber: number): Promise<void>;

  /** Encola un resultado de validación con errores en la cola de errores */
  enqueueValidationError(fileId: string, result: RowValidationResult): Promise<void>;
}
