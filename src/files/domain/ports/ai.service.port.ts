import { ErrorLogEntity, ErrorClassification } from '../entities/file.entity';

export const AI_SERVICE_PORT = 'AI_SERVICE_PORT';

export interface FileProcessingStats {
  totalRecords: number;
  errorsByCategory: Record<string, number>;
}

export interface AiServicePort {
  generateProcessingSummary(stats: FileProcessingStats): Promise<string>;
  classifyErrors(errors: any[]): Promise<{ id: string, categoria: ErrorClassification }[]>;
}
