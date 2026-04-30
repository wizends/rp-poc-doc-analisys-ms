import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { FILE_REPOSITORY_PORT } from '../../../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../../../domain/ports/file.repository.port';

/**
 * Worker que procesa la cola de errores de validación.
 * Aquí se pueden agregar acciones adicionales como:
 * - Notificaciones al usuario
 * - Envío a un dead-letter queue
 * - Generación de reportes de errores
 * - Clasificación IA de errores
 */
@Processor('validation-errors')
export class ValidationErrorProcessor extends WorkerHost {
  constructor(
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { fileId, rowNumber, errors, rowData } = job.data;

    console.log(
      `[ValidationErrors] Procesando fila errónea #${rowNumber} del archivo ${fileId}: ` +
      `${errors.length} error(es) detectado(s)`
    );

    // Log detallado de cada error
    for (const error of errors) {
      console.log(
        `  → [${error.errorType}] Columna "${error.column}": ${error.message}`
      );
    }

    // Aquí se pueden agregar acciones adicionales como:
    // - Enviar notificación al usuario
    // - Acumular para reporte batch
    // - Clasificar con IA

    return {
      fileId,
      rowNumber,
      errorsProcessed: errors.length,
    };
  }
}
