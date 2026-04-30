import { RowValidationResult } from '../validators/row.validator';

export const QUEUE_SERVICE_PORT = 'QUEUE_SERVICE_PORT';

/** Fila ya validada, lista para persistirse */
export interface ValidatedRow {
  row: Record<string, any>;
  rowNumber: number;
  isValid: boolean;
  errors: RowValidationResult['errors'];
}

export interface QueueServicePort {
  /** Encola el archivo para procesamiento (lectura + validación CPU) */
  enqueueFileProcessing(fileId: string, totalRecords: number): Promise<void>;

  /** Almacena filas validadas en Redis y encola el PRIMER job de row-save */
  storeAndStartRowSave(fileId: string, validatedRows: ValidatedRow[], batchSize: number): Promise<void>;

  /** Obtiene el siguiente lote de filas validadas desde Redis (LPOP) */
  getNextRowBatch(fileId: string): Promise<ValidatedRow[] | null>;

  /** Encola un job de continuación para seguir procesando el mismo archivo */
  continueRowSave(fileId: string): Promise<void>;

  /** Encola un resultado de validación con errores en la cola de errores */
  enqueueValidationError(fileId: string, result: RowValidationResult): Promise<void>;
}
