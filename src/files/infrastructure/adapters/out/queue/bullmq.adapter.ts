import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueServicePort } from '../../../../domain/ports/queue.service.port';

@Injectable()
export class BullMqAdapter implements QueueServicePort {
  constructor(@InjectQueue('file-processing') private readonly queue: Queue) {}

  async enqueueFileProcessing(fileId: string): Promise<void> {
    await this.queue.add('process-file', { fileId }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
    console.log(`[BullMqAdapter] Tarea encolada en BullMQ para fileId: ${fileId}`);
  }
}
