import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { QueueServicePort, ValidatedRow } from '../../../../domain/ports/queue.service.port';
import { RowValidationResult } from '../../../../domain/validators/row.validator';

@Injectable()
export class BullMqAdapter implements QueueServicePort {
  constructor(
    @InjectQueue('file-processing-fast') private readonly fileFastQueue: Queue,
    @InjectQueue('file-processing-slow') private readonly fileSlowQueue: Queue,
    @InjectQueue('row-save') private readonly rowSaveQueue: Queue,
    @InjectQueue('validation-errors') private readonly errorQueue: Queue,
  ) { }

  async enqueueFileProcessing(fileId: string, totalRecords: number): Promise<void> {
    const queue = totalRecords <= 5000 ? this.fileFastQueue : this.fileSlowQueue;
    await queue.add('process-file', { fileId }, {
      jobId: `proc-${fileId}`, // Idempotencia: un solo job de procesamiento por archivo
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
    });
    console.log(`[BullMqAdapter] Archivo encolado para procesamiento: ${fileId}`);
  }

  /**
   * Almacena las filas validadas en una Redis List (clave `validated-rows:{fileId}`)
   * divididas en lotes de `batchSize`, y encola UN SOLO job de row-save.
   *
   * Usar una Redis List + LPOP garantiza que cada archivo solo tiene
   * 1 job activo en la cola row-save → distribución justa entre archivos.
   */
  async storeAndStartRowSave(fileId: string, validatedRows: ValidatedRow[], batchSize: number): Promise<void> {
    const client = await this.rowSaveQueue.client;
    const key = `validated-rows:${fileId}`;

    // Dividir en lotes de batchSize y almacenar cada lote como JSON en la lista
    const pipeline = client.pipeline();
    for (let i = 0; i < validatedRows.length; i += batchSize) {
      const batch = validatedRows.slice(i, i + batchSize);
      pipeline.rpush(key, JSON.stringify(batch));
    }
    // TTL de 24h para auto-limpieza en caso de fallo
    pipeline.expire(key, 86400);
    await pipeline.exec();

    console.log(
      `[BullMqAdapter] ${validatedRows.length} filas almacenadas en Redis (${Math.ceil(validatedRows.length / batchSize)} lotes) para ${fileId}`,
    );

    // Encolar el PRIMER job de guardado
    await this.rowSaveQueue.add('save-rows', { fileId }, {
      jobId: `save-start-${fileId}`, 
      attempts: 3,
      backoff: { type: 'fixed', delay: 500 },
      removeOnComplete: true,
    });
  }

  async getNextRowBatch(fileId: string): Promise<ValidatedRow[] | null> {
    const client = await this.rowSaveQueue.client;
    const batchJson = await client.lpop(`validated-rows:${fileId}`);
    return batchJson ? JSON.parse(batchJson) : null;
  }

  async continueRowSave(fileId: string): Promise<void> {
    const client = await this.rowSaveQueue.client;
    const remaining = await client.llen(`validated-rows:${fileId}`);

    if (remaining > 0) {
      await this.rowSaveQueue.add('save-rows', { fileId }, {
        attempts: 3,
        backoff: { type: 'fixed', delay: 500 },
        removeOnComplete: true,
      });
    }
  }

  async enqueueValidationError(fileId: string, result: RowValidationResult): Promise<void> {
    await this.errorQueue.add('validation-error', { fileId, ...result }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
    });
  }
}
