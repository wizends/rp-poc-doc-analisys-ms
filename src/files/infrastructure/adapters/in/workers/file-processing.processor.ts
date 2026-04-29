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

/**
 * Worker principal: lee el Excel y encola cada fila en la cola de validación.
 * No valida campos directamente; delega a row-validation queue.
 */
@Processor('file-processing')
export class FileProcessingProcessor extends WorkerHost {
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
    console.log(`[Worker] Iniciando procesamiento del trabajo ${job.id} para el archivo: ${fileId}`);

    // Recuperar el archivo del repositorio con su contenido en base64
    const file = await this.fileRepository.findById(fileId);
    if (!file || !file.fileBase64) {
      console.error(`[Worker] No se encontró el archivo o el contenido base64 para fileId: ${fileId}`);
      throw new Error(`Archivo no encontrado o sin contenido base64: ${fileId}`);
    }

    // Cambiar estado a PROCESSING
    file.status = 'PROCESSING';
    await this.fileRepository.updateFile(file);

    // Decodificar el contenido base64 a un Buffer
    const fileBuffer = Buffer.from(file.fileBase64, 'base64');
    console.log(`[Worker] Archivo decodificado: ${file.filename} (${fileBuffer.length} bytes)`);

    // ─── 1. Verificar si el archivo está corrupto ───────────────────────
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (error) {
      console.error(`[Worker] Archivo corrupto: ${file.filename}`, error.message);
      await this.fileRepository.saveErrorLog(
        new ErrorLogEntity(
          randomUUID(),
          fileId,
          0,
          `Archivo corrupto o formato inválido: ${error.message}`,
          { originalFilename: file.filename, errorType: 'CORRUPT_FILE' },
        ),
      );
      file.markAsFailed();
      await this.fileRepository.updateFile(file);
      return;
    }

    // Verificar que tenga al menos una hoja
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      await this.fileRepository.saveErrorLog(
        new ErrorLogEntity(
          randomUUID(),
          fileId,
          0,
          'El archivo no contiene ninguna hoja de cálculo',
          { originalFilename: file.filename, errorType: 'EMPTY_WORKBOOK' },
        ),
      );
      file.markAsFailed();
      await this.fileRepository.updateFile(file);
      return;
    }

    // ─── 2. Leer la primera hoja ────────────────────────────────────────
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
      raw: true,
    });

    if (rows.length === 0) {
      await this.fileRepository.saveErrorLog(
        new ErrorLogEntity(
          randomUUID(),
          fileId,
          0,
          'La hoja de cálculo no contiene datos',
          { sheetName, errorType: 'EMPTY_SHEET' },
        ),
      );
      file.markAsFailed();
      await this.fileRepository.updateFile(file);
      return;
    }

    // ─── 3. Verificar columnas esperadas ────────────────────────────────
    const expectedColumns = [
      'id_transaccion', 'fecha_registro', 'concepto',
      'monto', 'estado', 'metodo_pago', 'observaciones',
    ];
    const actualColumns = Object.keys(rows[0]);
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));

    if (missingColumns.length > 0) {
      await this.fileRepository.saveErrorLog(
        new ErrorLogEntity(
          randomUUID(),
          fileId,
          1,
          `Columnas faltantes en el archivo: ${missingColumns.join(', ')}. ` +
          `Columnas encontradas: ${actualColumns.join(', ')}`,
          { missingColumns, actualColumns, errorType: 'MISSING_COLUMNS' },
        ),
      );
      file.markAsFailed();
      await this.fileRepository.updateFile(file);
      return;
    }

    // ─── 4. Encolar cada fila en la cola de validación ──────────────────
    file.totalRecords = rows.length;
    file.processedRecords = 0;
    await this.fileRepository.updateFile(file);

    console.log(
      `[Worker] Encolando ${rows.length} filas para validación individual ` +
      `(archivo: ${file.filename}, hoja: "${sheetName}")`,
    );

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // Fila 1 = header, fila 2 = primer registro
      await this.queueService.enqueueRowValidation(fileId, rows[i], rowNumber);
    }

    console.log(`[Worker] ${rows.length} filas encoladas para validación del archivo ${fileId}`);
  }
}
