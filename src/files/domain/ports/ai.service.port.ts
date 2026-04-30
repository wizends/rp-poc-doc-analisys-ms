import { ClasifyErrorDto } from 'src/files/infrastructure/adapters/in/web/dtos/clasify-errors-request.dto';
import { ClasifyErrorsResponseDto } from '../../infrastructure/adapters/in/web/dtos/clasify-errors-response.dto';

export const AI_SERVICE_PORT = 'AI_SERVICE_PORT';

export interface FileProcessingStats {
  totalRecords: number;
  errorsByCategory: Record<string, number>;
}

export interface AiServicePort {
  generateProcessingSummary(stats: FileProcessingStats): Promise<string>;
  classifyErrors(errors: ClasifyErrorDto[]): Promise<ClasifyErrorsResponseDto[]>;

}
