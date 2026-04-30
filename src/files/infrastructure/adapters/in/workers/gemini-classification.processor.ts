import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ClassifyErrorsUseCase } from '../../../../application/use-cases/classify-errors.use-case';

/**
 * Processor que maneja la clasificación de errores utilizando la API de Gemini.
 * Este worker es activado a través de la cola 'gemini-classification'.
 */
@Processor('gemini-classification')
export class GeminiClassificationProcessor extends WorkerHost {
  constructor(
    private readonly classifyErrorsUseCase: ClassifyErrorsUseCase,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { errors, fileId } = job.data;

    console.log(`[GeminiProcessor] Iniciando clasificación IA para ${errors?.length || 0} errores.`);

    if (!errors || errors.length === 0) {
      return [];
    }

    try {
      const results = await this.classifyErrorsUseCase.execute(errors);

      console.log(`[GeminiProcessor] Clasificación completada exitosamente.`);

      // El resultado puede ser consumido por el proceso que encoló el trabajo
      return results;
    } catch (error) {
      console.error('[GeminiProcessor] Error durante la clasificación con Gemini:', error);
      throw error;
    }
  }
}
