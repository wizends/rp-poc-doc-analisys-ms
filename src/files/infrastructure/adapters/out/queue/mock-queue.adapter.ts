import { Injectable } from '@nestjs/common';
import { QueueServicePort } from '../../../../domain/ports/queue.service.port';

@Injectable()
export class MockQueueAdapter implements QueueServicePort {
  async enqueueFileProcessing(fileId: string): Promise<void> {
    console.log(`[MockQueueAdapter] File processing enqueued for fileId: ${fileId}`);
    // Aquí iría la lógica de RabbitMQ o BullMQ real
  }
}
