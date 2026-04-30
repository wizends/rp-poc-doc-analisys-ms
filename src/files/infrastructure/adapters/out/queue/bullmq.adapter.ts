import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { QueueServicePort } from '../../../../domain/ports/queue.service.port';
import { RowValidationResult } from '../../../../domain/validators/row.validator';

@Injectable()
export class BullMqAdapter implements QueueServicePort {
  constructor(
    @InjectQueue('file-processing-fast') private readonly fileFastQueue: Queue,
    @InjectQueue('file-processing-slow') private readonly fileSlowQueue: Queue,
    @InjectQueue('validation-errors') private readonly errorQueue: Queue,
  ) { }

  async enqueueFileProcessing(fileId: string, totalRecords: number): Promise<void> {
    const queue = totalRecords <= 5000 ? this.fileFastQueue : this.fileSlowQueue;
    await queue.add('process-file', { fileId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
    });
    console.log(`[BullMqAdapter] Archivo encolado para procesamiento: ${fileId}`);
  }

  async enqueueValidationError(fileId: string, result: RowValidationResult): Promise<void> {
    await this.errorQueue.add('validation-error', { fileId, ...result }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
    });
  }
}
