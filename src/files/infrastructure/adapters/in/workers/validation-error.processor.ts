import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { FILE_REPOSITORY_PORT } from '../../../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../../../domain/ports/file.repository.port';
import { ClassifyErrorsUseCase } from '../../../../application/use-cases/classify-errors.use-case';
import { ClasifyErrorDto } from '../web/dtos/clasify-errors-request.dto';

@Processor('validation-errors')
export class ValidationErrorProcessor extends WorkerHost {
  constructor(
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
    private readonly classifyErrorsUseCase: ClassifyErrorsUseCase,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { fileId, rowNumber, errors, rowData } = job.data;

    console.log(
      `[ValidationErrors] Clasificando con IA fila errónea #${rowNumber} del archivo ${fileId}`
    );

    try {
      // 1. Recuperar logs guardados para esta fila
      const savedLogs = await this.fileRepository.findErrorsByFileId(fileId);
      const rowLogs = savedLogs.filter(log => log.rowNumber === rowNumber);

      // 2. Filtrar logs que aún no han sido clasificados
      const pendingLogs = rowLogs.filter(log => !log.isAiClassified);

      if (pendingLogs.length === 0 && rowLogs.length > 0) {
        console.log(`[ValidationErrors] Fila #${rowNumber} ya fue clasificada por IA. Saltando.`);
        return { fileId, rowNumber, status: 'ALREADY_CLASSIFIED' };
      }

      // 3. Preparar DTOs para la IA (solo de los logs pendientes)
      const errorDtos: ClasifyErrorDto[] = pendingLogs.map((log, index) => ({
        id: index,
        error: log.message,
        amount: rowData?.monto || 0,
        customer_id: rowData?.customer_id || rowData?.id_cliente || 'N/A'
      }));

      // 4. Clasificar con IA
      const classifications = await this.classifyErrorsUseCase.execute(errorDtos);

      // 5. Actualizar logs en la base de datos
      for (let i = 0; i < pendingLogs.length; i++) {
        const log = pendingLogs[i];
        const classification = classifications[i];
        
        if (classification) {
          log.classify(classification.category, classification.severity);
          await this.fileRepository.saveErrorLog(log);
        }
      }

      return {
        fileId,
        rowNumber,
        classified: classifications.length
      };
    } catch (error) {
      console.error(`[ValidationErrors] Fallo en la clasificación IA:`, error.message);
      throw error;
    }
  }
}
