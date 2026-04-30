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

/**
 * Etapa 1: Lectura + Validación (CPU-only, sin I/O de BD).
 *
 * 1. Parsea el Excel desde base64.
 * 2. Valida estructura (columnas) y cada fila.
 * 3. Almacena las filas validadas en Redis (lista temporal).
 * 4. Encola UN SOLO job en row-save para iniciar la persistencia.
 *
 * Este job termina en segundos porque no hace ninguna escritura a BD.
 */
export abstract class FileProcessingProcessor extends WorkerHost {
  constructor(
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
    @Inject(QUEUE_SERVICE_PORT)
    private readonly queueService: QueueServicePort,
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

    (workbook as any) = null; // liberar memoria

    if (rows.length === 0) {
      await this.fileRepository.saveErrorLog(new ErrorLogEntity(
        randomUUID(), fileId, 0, 'La hoja de cálculo no contiene datos',
        { sheetName, errorType: 'EMPTY_SHEET' },
      ));
      file.markAsFailed();
      await this.fileRepository.updateFile(file);
      return;
    }

    // ─── 2. Verificar columnas ──────────────────────────────────────────────
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

    // ─── 3. Validar todas las filas (CPU-only) ──────────────────────────────
    file.totalRecords = rows.length;
    file.processedRecords = 0;
    await this.fileRepository.updateFile(file);

    console.log(`[FileProcessor] Validando ${rows.length} filas del archivo ${file.filename}...`);

    const validatedRows = rows.map((row, index) => {
      const rowNumber = index + 2; // fila 1 = header
      const result = validateRow(row, rowNumber);
      return { row, rowNumber, isValid: result.isValid, errors: result.errors };
    });

    // ─── 4. Almacenar en Redis y encolar primer job de row-save ─────────────
    const batchSize = 500;
    await this.queueService.storeAndStartRowSave(fileId, validatedRows, batchSize);

    console.log(`[FileProcessor] Archivo ${fileId} validado y encolado para persistencia.`);
  }
}

@Processor('file-processing-fast', { concurrency: 2 })
export class FileProcessingFastProcessor extends FileProcessingProcessor { }

@Processor('file-processing-slow', { concurrency: 10 })
export class FileProcessingSlowProcessor extends FileProcessingProcessor { }
