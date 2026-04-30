import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';
import { FILE_REPOSITORY_PORT } from '../../../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../../../domain/ports/file.repository.port';
import { QUEUE_SERVICE_PORT } from '../../../../domain/ports/queue.service.port';
import type { QueueServicePort } from '../../../../domain/ports/queue.service.port';
import { ErrorLogEntity } from '../../../../domain/entities/file.entity';
import { validateRow } from '../../../../domain/validators/row.validator';
import { CompraEntity } from '../../../../domain/entities/compra.entity';
import { FileProgressService } from '../../../../application/services/file-progress.service';
import { ProcessAiSummaryUseCase } from '../../../../application/use-cases/process-ai-summary.use-case';

/**
 * Worker monolítico: parsea el Excel, valida y guarda en BD.
 *
 * ¿Por qué NO usar una cola intermedia (row-save)?
 *   Una cola FIFO compartida entre múltiples archivos causa inanición:
 *   el archivo que encola primero monopoliza toda la cola.
 *
 * ¿Por qué esto SÍ funciona para múltiples archivos?
 *   Cada archivo obtiene su propio worker dedicado (gracias a concurrency).
 *   Worker A procesa Archivo A, Worker B procesa Archivo B, en paralelo real.
 *   No comparten una cola FIFO → cero inanición.
 *
 * ¿Por qué no expira el lock?
 *   - lockDuration: 10 minutos (vs 30s por defecto)
 *   - BullMQ renueva automáticamente cada lockDuration/2
 *   - setImmediate() después de cada micro-lote libera el Event Loop
 *     para que el timer de renovación pueda ejecutarse
 */
export abstract class FileProcessingProcessor extends WorkerHost {
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

  async process(job: Job<any, any, string>): Promise<any> {
    const { fileId } = job.data;
    console.log(`[FileProcessor] Iniciando procesamiento del archivo: ${fileId}`);

    const file = await this.fileRepository.findById(fileId);
    if (!file || !file.fileBase64) {
      throw new Error(`Archivo no encontrado o sin contenido base64: ${fileId}`);
    }

    file.status = 'PROCESSING';
    await this.fileRepository.updateFile(file);

    // ─── 1. Parsear el Excel ────────────────────────────────────────────────
    const fileBuffer = Buffer.from(file.fileBase64, 'base64');
    console.log(`[FileProcessor] Archivo decodificado: ${file.filename} (${fileBuffer.length} bytes)`);

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (error) {
      await this.fileRepository.saveErrorLog(new ErrorLogEntity(
        randomUUID(), fileId, 0,
        `Archivo corrupto o formato inválido: ${error.message}`,
        { errorType: 'CORRUPT_FILE' },
      ));
      file.markAsFailed();
      await this.fileRepository.updateFile(file);
      return;
    }

    if (!workbook.SheetNames?.length) {
      await this.fileRepository.saveErrorLog(new ErrorLogEntity(
        randomUUID(), fileId, 0,
        'El archivo no contiene ninguna hoja de cálculo',
        { errorType: 'EMPTY_WORKBOOK' },
      ));
      file.markAsFailed();
      await this.fileRepository.updateFile(file);
      return;
    }

    const sheetName = workbook.SheetNames[0];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: null,
      raw: true,
    });

    // Liberar workbook de memoria inmediatamente
    (workbook as any) = null;

    if (rows.length === 0) {
      await this.fileRepository.saveErrorLog(new ErrorLogEntity(
        randomUUID(), fileId, 0, 'La hoja de cálculo no contiene datos',
        { sheetName, errorType: 'EMPTY_SHEET' },
      ));
      file.markAsFailed();
      await this.fileRepository.updateFile(file);
      return;
    }

    // ─── 2. Verificar columnas esperadas ────────────────────────────────────
    const expectedColumns = [
      'id_transaccion', 'fecha_registro', 'concepto',
      'monto', 'estado', 'metodo_pago', 'observaciones',
    ];
    const actualColumns = Object.keys(rows[0]);
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));

    if (missingColumns.length > 0) {
      await this.fileRepository.saveErrorLog(new ErrorLogEntity(
        randomUUID(), fileId, 1,
        `Columnas faltantes: ${missingColumns.join(', ')}. Encontradas: ${actualColumns.join(', ')}`,
        { missingColumns, actualColumns, errorType: 'MISSING_COLUMNS' },
      ));
      file.markAsFailed();
      await this.fileRepository.updateFile(file);
      return;
    }

    // ─── 3. Procesar todas las filas ────────────────────────────────────────
    file.totalRecords = rows.length;
    file.processedRecords = 0;
    await this.fileRepository.updateFile(file);

    // Liberar fileBase64 de memoria (ya no lo necesitamos)
    file.fileBase64 = '';

    console.log(`[FileProcessor] Procesando ${rows.length} filas (archivo: ${file.filename})`);

    const microBatchSize = 50;

    for (let i = 0; i < rows.length; i += microBatchSize) {
      const chunk = rows.slice(i, i + microBatchSize);

      await Promise.all(chunk.map(async (row, index) => {
        const rowNumber = i + index + 2;
        const result = validateRow(row, rowNumber);

        try {
          if (!result.isValid) {
            for (const error of result.errors) {
              await this.fileRepository.saveErrorLog(
                new ErrorLogEntity(
                  randomUUID(), fileId, rowNumber, error.message,
                  { column: error.column, value: error.value, errorType: error.errorType, rowData: row },
                )
              );
            }
            await this.queueService.enqueueValidationError(fileId, {
              rowNumber, isValid: false, errors: result.errors, rowData: row,
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

            await this.fileRepository.saveCompra(compra);
          }
        } catch (err) {
          console.error(`[FileProcessor] Error fila ${rowNumber}:`, err.message);
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
              console.log(`[FileProcessor] Archivo ${fileId} completado. Generando resumen IA...`);
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
      }));

      // CRÍTICO: Ceder el Event Loop para que BullMQ renueve locks y HTTP responda
      await new Promise(resolve => setImmediate(resolve));
    }

    console.log(`[FileProcessor] Archivo ${fileId} totalmente procesado.`);
  }
}
@Processor('file-processing-fast', {
  concurrency: 2,
  lockDuration: 600000,
})
export class FileProcessingFastProcessor extends FileProcessingProcessor { }

@Processor('file-processing-slow', {
  concurrency: 10,
  lockDuration: 600000,
})
export class FileProcessingSlowProcessor extends FileProcessingProcessor { }
