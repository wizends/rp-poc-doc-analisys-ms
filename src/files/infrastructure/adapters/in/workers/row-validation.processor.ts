import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { FILE_REPOSITORY_PORT } from '../../../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../../../domain/ports/file.repository.port';
import { QUEUE_SERVICE_PORT } from '../../../../domain/ports/queue.service.port';
import type { QueueServicePort } from '../../../../domain/ports/queue.service.port';
import { validateRow } from '../../../../domain/validators/row.validator';
import { ErrorLogEntity } from '../../../../domain/entities/file.entity';
import { CompraEntity } from '../../../../domain/entities/compra.entity';

@Processor('row-validation')
export class RowValidationProcessor extends WorkerHost {
  constructor(
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
    @Inject(QUEUE_SERVICE_PORT)
    private readonly queueService: QueueServicePort,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { fileId, row, rowNumber } = job.data;

    // Validar la fila campo por campo
    const result = validateRow(row, rowNumber);

    if (!result.isValid) {
      // Enviar a la cola de errores
      await this.queueService.enqueueValidationError(fileId, result);

      // Guardar cada error en la BD
      for (const error of result.errors) {
        await this.fileRepository.saveErrorLog(
          new ErrorLogEntity(
            randomUUID(),
            fileId,
            rowNumber,
            error.message,
            {
              column: error.column,
              value: error.value,
              errorType: error.errorType,
              rowData: row,
            },
          ),
        );
      }
    } else {
      let fechaRegistro = row['fecha_registro'];
      if (typeof fechaRegistro === 'number') {
        fechaRegistro = new Date((fechaRegistro - (25567 + 2)) * 86400 * 1000);
      } else {
        fechaRegistro = new Date(fechaRegistro);
      }

      const compra = new CompraEntity(
        randomUUID(),
        fileId,
        String(row['id_transaccion']),
        fechaRegistro,
        String(row['concepto']),
        Number(row['monto']),
        String(row['estado']),
        String(row['metodo_pago']),
        row['observaciones'] ? String(row['observaciones']) : undefined
      );

      await this.fileRepository.saveCompra(compra);
    }

    // Actualizar progreso del archivo
    const file = await this.fileRepository.findById(fileId);
    if (file) {
      file.processedRecords += 1;
      await this.fileRepository.updateFile(file);
    }

    return { isValid: result.isValid, errorsCount: result.errors.length };
  }
}
