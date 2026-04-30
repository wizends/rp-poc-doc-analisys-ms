import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { FILE_REPOSITORY_PORT } from '../../../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../../../domain/ports/file.repository.port';
import { QUEUE_SERVICE_PORT } from '../../../../domain/ports/queue.service.port';
import type { QueueServicePort } from '../../../../domain/ports/queue.service.port';
import { ErrorLogEntity } from '../../../../domain/entities/file.entity';
import { CompraEntity } from '../../../../domain/entities/compra.entity';
import { FileProgressService } from '../../../../application/services/file-progress.service';
import { ProcessAiSummaryUseCase } from '../../../../application/use-cases/process-ai-summary.use-case';

/**
 * Etapa 2: Persistencia en BD con Continuation Pattern.
 *
 * Cada job procesa 1 lote de 500 filas (desde Redis LPOP) y al terminar:
 *   - Si quedan más lotes → encola otro job de continuación
 *   - Si no quedan → el archivo ya terminó
 *
 * CLAVE: Cada archivo solo tiene 1 job activo en esta cola a la vez.
 * Con concurrency N, N archivos se procesan en paralelo sin inanición.
 *
 *   Archivo A: [lote 0] → worker 1 → [lote 1] → worker 1 → ...
 *   Archivo B: [lote 0] → worker 2 → [lote 1] → worker 2 → ...
 *   Archivo C: [lote 0] → worker 3 → ...
 *
 * Los jobs se turnan en la cola FIFO: A₀, B₀, C₀, A₁, B₁, C₁, A₂, B₂, C₂...
 */
@Processor('row-save', { concurrency: 10 })
export class RowSaveProcessor extends WorkerHost {
  constructor(
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
    @Inject(QUEUE_SERVICE_PORT)
    private readonly queueService: QueueServicePort,
    private readonly fileProgressService: FileProgressService,
    private readonly processAiSummaryUseCase: ProcessAiSummaryUseCase,
  ) {
    super();
  }

  async process(job: Job<{ fileId: string }, any, string>): Promise<any> {
    const { fileId } = job.data;

    // Obtener el siguiente lote de filas validadas desde Redis (LPOP atómico)
    const batch = await this.queueService.getNextRowBatch(fileId);
    if (!batch || batch.length === 0) return;

    // Persistir cada fila del lote
    for (const { row, rowNumber, isValid, errors } of batch) {
      try {
        if (!isValid) {
          for (const error of errors) {
            await this.fileRepository.saveErrorLog(
              new ErrorLogEntity(
                randomUUID(), fileId, rowNumber, error.message,
                { column: error.column, value: error.value, errorType: error.errorType, rowData: row },
              )
            );
          }
          await this.queueService.enqueueValidationError(fileId, {
            rowNumber, isValid: false, errors, rowData: row,
          });
        } else {
          let fechaRegistro = row['fecha_registro'];
          if (typeof fechaRegistro === 'number') {
            fechaRegistro = new Date((fechaRegistro - (25567 + 2)) * 86400 * 1000);
          } else {
            fechaRegistro = new Date(fechaRegistro);
          }

          const compra = new CompraEntity(
            randomUUID(), fileId,
            String(row['id_transaccion']),
            fechaRegistro,
            String(row['concepto']),
            Number(row['monto']),
            String(row['estado']),
            String(row['metodo_pago']),
            row['observaciones'] ? String(row['observaciones']) : undefined,
          );

          await this.fileRepository.upsertCompra(compra);
        }
      } catch (err) {
        console.error(`[RowSave] Error fila ${rowNumber} del archivo ${fileId}:`, err.message);
      } finally {
        const progressResult = await this.fileRepository.incrementProgress(fileId);
        if (progressResult) {
          const { file: updatedFile, justCompleted } = progressResult;

          this.fileProgressService.emitProgress({
            fileId,
            processedRecords: updatedFile.processedRecords,
            totalRecords: updatedFile.totalRecords,
            status: updatedFile.status,
          });

          if (justCompleted) {
            console.log(`[RowSave] Archivo ${fileId} completado. Generando resumen IA...`);
            const summary = await this.processAiSummaryUseCase.execute(fileId);
            this.fileProgressService.emitProgress({
              fileId,
              processedRecords: updatedFile.processedRecords,
              totalRecords: updatedFile.totalRecords,
              status: updatedFile.status,
              summary,
            });
          }
        }
      }
    }

    // Continuation: si quedan más lotes en Redis, encolar el siguiente job
    await this.queueService.continueRowSave(fileId);
  }
}
