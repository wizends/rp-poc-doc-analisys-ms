export const QUEUE_SERVICE_PORT = 'QUEUE_SERVICE_PORT';

export interface QueueServicePort {
  enqueueFileProcessing(fileId: string): Promise<void>;
}
