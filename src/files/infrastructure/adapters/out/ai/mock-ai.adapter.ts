import { Injectable } from '@nestjs/common';
import { AiServicePort, FileProcessingStats } from '../../../../domain/ports/ai.service.port';
import { ErrorClassification } from '../../../../domain/entities/file.entity';

@Injectable()
export class MockAiAdapter implements AiServicePort {
  async generateProcessingSummary(stats: FileProcessingStats): Promise<string> {
    console.log('[MockAiAdapter] Calling AI for summary...', stats);
    const errorsList = Object.entries(stats.errorsByCategory)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');

    return `Se detectaron ${Object.values(stats.errorsByCategory).reduce((a: number, b: number) => a + b, 0)} errores: ${errorsList}. Total procesado: ${stats.totalRecords}.`;
  }

  async classifyErrors(errors: any[]): Promise<{ id: string; categoria: ErrorClassification; }[]> {
    console.log('[MockAiAdapter] Calling AI to classify errors...', errors.length);
    return errors.map(e => {
      let categoria: ErrorClassification = 'Error de validación';
      if (e.error?.toLowerCase().includes('monto negativo')) {
        categoria = 'Error de validación';
      } else if (e.error?.toLowerCase().includes('cuenta no existe')) {
        categoria = 'Error de datos';
      } else if (e.error?.toLowerCase().includes('fuera de rango')) {
        categoria = 'Posible fraude/anomalía';
      }

      return {
        id: e.id,
        categoria
      };
    });
  }
}
