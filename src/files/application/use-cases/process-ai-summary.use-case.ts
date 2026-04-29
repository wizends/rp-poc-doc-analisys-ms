import { Injectable, Inject } from '@nestjs/common';
import { AI_SERVICE_PORT } from '../../domain/ports/ai.service.port';
import type { AiServicePort, FileProcessingStats } from '../../domain/ports/ai.service.port';
import { FILE_REPOSITORY_PORT } from '../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../domain/ports/file.repository.port';

@Injectable()
export class ProcessAiSummaryUseCase {
  constructor(
    @Inject(AI_SERVICE_PORT)
    private readonly aiService: AiServicePort,
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
  ) {}

  async execute(fileId: string): Promise<string> {
    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    if (file.summary) {
      return file.summary;
    }

    const errors = await this.fileRepository.findErrorsByFileId(fileId);
    
    // Agrupar errores por clasificación
    const errorsByCategory: Record<string, number> = {};
    errors.forEach(err => {
      const cat = err.aiClassification;
      errorsByCategory[cat] = (errorsByCategory[cat] || 0) + 1;
    });

    const stats: FileProcessingStats = {
      totalRecords: file.totalRecords,
      errorsByCategory
    };

    let summaryStr: string;
    try {
      // Intentamos obtener el resumen con IA
      summaryStr = await this.aiService.generateProcessingSummary(stats);
    } catch (error) {
      // Fallback si la IA falla
      summaryStr = `Proceso finalizado. Se procesaron ${stats.totalRecords} registros con ${errors.length} errores detectados.`;
    }

    file.summary = summaryStr;
    await this.fileRepository.updateFile(file);

    return summaryStr;
  }
}
