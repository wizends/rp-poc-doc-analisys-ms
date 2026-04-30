import { RowValidationResult } from '../validators/row.validator';

export const QUEUE_SERVICE_PORT = 'QUEUE_SERVICE_PORT';

export interface QueueServicePort {
  /** Encola el archivo para procesamiento (lectura + validación + guardado) */
  enqueueFileProcessing(fileId: string, totalRecords: number): Promise<void>;

  /** Encola un resultado de validación con errores en la cola de errores */
  enqueueValidationError(fileId: string, result: RowValidationResult): Promise<void>;
}
