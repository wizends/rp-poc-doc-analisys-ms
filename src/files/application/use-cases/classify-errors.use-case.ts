import { Injectable, Inject } from '@nestjs/common';
import { AI_SERVICE_PORT } from '../../domain/ports/ai.service.port';
import type { AiServicePort } from '../../domain/ports/ai.service.port';
import { FILE_REPOSITORY_PORT } from '../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../domain/ports/file.repository.port';

@Injectable()
export class ClassifyErrorsUseCase {
  constructor(
    @Inject(AI_SERVICE_PORT)
    private readonly aiService: AiServicePort,
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
  ) {}

  async execute(fileId: string): Promise<void> {
    const errors = await this.fileRepository.findErrorsByFileId(fileId);
    const unclassifiedErrors = errors.filter(e => !e.isAiClassified);

    if (unclassifiedErrors.length === 0) return;

    // Tomamos los errores crudos para mandar a la IA
    const errorsPayload = unclassifiedErrors.map(e => ({
      id: e.id,
      error: e.message,
      ...e.rawData
    }));

    try {
      const classifications = await this.aiService.classifyErrors(errorsPayload);
      
      // Mapeamos y actualizamos
      for (const classification of classifications) {
        const errorLog = unclassifiedErrors.find(e => e.id === classification.id);
        if (errorLog) {
          // Validar que sea un enum válido
          const validCategories = ['Error de validación', 'Error de datos', 'Posible fraude/anomalía', 'Error técnico'];
          if (validCategories.includes(classification.categoria)) {
             errorLog.classify(classification.categoria as any);
          } else {
             errorLog.classify('Sin clasificar');
          }
          await this.fileRepository.saveErrorLog(errorLog);
        }
      }
    } catch (err) {
      console.error('Error clasificando con IA', err);
      // Fallback: dejarlos sin clasificar o marcarlos como error técnico, pero no bloqueamos el sistema.
    }
  }
}
