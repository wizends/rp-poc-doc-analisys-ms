import { Injectable, Inject } from '@nestjs/common';
import { AI_SERVICE_PORT } from '../../domain/ports/ai.service.port';
import type { AiServicePort } from '../../domain/ports/ai.service.port';
import { FILE_REPOSITORY_PORT } from '../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../domain/ports/file.repository.port';
import { ClasifyErrorDto } from '../../infrastructure/adapters/in/web/dtos/clasify-errors-request.dto';


import { ClasifyErrorsResponseDto } from '../../infrastructure/adapters/in/web/dtos/clasify-errors-response.dto';


@Injectable()
export class ClassifyErrorsUseCase {
  constructor(
    @Inject(AI_SERVICE_PORT)
    private readonly aiService: AiServicePort,
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort
  ) { }

  async execute(input: string | ClasifyErrorDto[]): Promise<ClasifyErrorsResponseDto[]> {
    try {
      let errorsToClassify: ClasifyErrorDto[] = [];

      if (typeof input === 'string') {
        // Fetch errors from repository
        const errorLogs = await this.fileRepository.findErrorsByFileId(input);
        
        // FILTRAR: solo los que no han sido clasificados aún
        const pendingLogs = errorLogs.filter(err => !err.isAiClassified);
        
        if (pendingLogs.length === 0) {
          console.log(`[ClassifyErrorsUseCase] No hay nuevos errores para clasificar en el archivo ${input}`);
          return errorLogs.map(err => ({
            id: Number(err.id),
            error: err.message,
            amount: err.rawData?.monto || 0,
            customer_id: err.rawData?.clienteId || 'N/A',
            category: err.aiClassification,
            severity: err.severity
          }));
        }

        errorsToClassify = pendingLogs.map(err => ({
          id: Number(err.id),
          error: err.message,
          amount: err.rawData?.monto || 0,
          customer_id: err.rawData?.clienteId || 'N/A'
        }));

        const classifications = await this.aiService.classifyErrors(errorsToClassify);

        // Guardar resultados en la base de datos
        for (let i = 0; i < pendingLogs.length; i++) {
          const log = pendingLogs[i];
          const classification = classifications[i];
          if (classification) {
            log.classify(classification.category, classification.severity);
            await this.fileRepository.saveErrorLog(log);
          }
        }

        return classifications;
      } else {
        errorsToClassify = input;
        return await this.aiService.classifyErrors(errorsToClassify);
      }
    } catch (error) {
      console.error(error);
      return [];
    }
  }
}
