import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueServicePort } from '../../../../domain/ports/queue.service.port';
import { RowValidationResult } from '../../../../domain/validators/row.validator';

@Injectable()
export class BullMqAdapter implements QueueServicePort {
  constructor(
    @InjectQueue('file-processing') private readonly fileQueue: Queue,
    @InjectQueue('row-validation') private readonly rowQueue: Queue,
    @InjectQueue('validation-errors') private readonly errorQueue: Queue,
  ) {}

  async enqueueFileProcessing(fileId: string): Promise<void> {
    await this.fileQueue.add('process-file', { fileId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
    console.log(`[BullMqAdapter] Archivo encolado para procesamiento: ${fileId}`);
  }

  async enqueueRowValidation(fileId: string, row: Record<string, any>, rowNumber: number): Promise<void> {
    await this.rowQueue.add('validate-row', { fileId, row, rowNumber }, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 500 },
    });
  }

  async enqueueValidationError(fileId: string, result: RowValidationResult): Promise<void> {
    await this.errorQueue.add('validation-error', { fileId, ...result }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
    console.log(`[BullMqAdapter] Fila ${result.rowNumber} con ${result.errors.length} error(es) enviada a cola de errores`);
  }
}
