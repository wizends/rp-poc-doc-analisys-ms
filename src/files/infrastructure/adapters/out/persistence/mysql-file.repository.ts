import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { FileRepositoryPort } from '../../../../domain/ports/file.repository.port';
import { FileEntity, ErrorLogEntity, FileStatus } from '../../../../domain/entities/file.entity';
import { CompraEntity } from '../../../../domain/entities/compra.entity';
import { FileSchema } from './schemas/file.schema';
import { ErrorLogSchema } from './schemas/error-log.schema';
import { FileChunkSchema } from './schemas/file-chunk.schema';
import { CompraSchema } from './schemas/compra.schema';

@Injectable()
export class MysqlFileRepository implements FileRepositoryPort {
  constructor(
    @InjectRepository(FileSchema)
    private readonly fileRepo: Repository<FileSchema>,
    @InjectRepository(ErrorLogSchema)
    private readonly errorRepo: Repository<ErrorLogSchema>,
    @InjectRepository(FileChunkSchema)
    private readonly chunkRepo: Repository<FileChunkSchema>,
    @InjectRepository(CompraSchema)
    private readonly compraRepo: Repository<CompraSchema>,
  ) { }

  // ─── Mappers: Schema <-> Domain ────────────────────────────────────

  private toDomain(schema: FileSchema, chunks?: FileChunkSchema[]): FileEntity {
    const entity = new FileEntity(
      schema.id,
      schema.filename,
      schema.status as FileStatus,
      schema.totalChunks,
      schema.processedRecords,
      schema.fileHash ?? undefined,
      schema.summary ?? undefined,
      schema.createdAt,
    );
    entity.totalRecords = schema.totalRecords;
    entity.fileBase64 = schema.fileBase64 ?? undefined;

    // Reconstruir el Map de chunks desde la BD
    if (chunks && chunks.length > 0) {
      for (const chunk of chunks) {
        entity.chunks.set(chunk.chunkIndex, chunk.data);
      }
    }

    return entity;
  }

  private toSchema(entity: FileEntity): Partial<FileSchema> {
    return {
      id: entity.id,
      filename: entity.filename,
      status: entity.status,
      totalRecords: entity.totalRecords,
      totalChunks: entity.totalChunks,
      processedRecords: entity.processedRecords,
      fileBase64: entity.fileBase64 ?? null,
      fileHash: entity.fileHash ?? null,
      summary: entity.summary ?? null,
    };
  }

  private errorToDomain(schema: ErrorLogSchema): ErrorLogEntity {
    return new ErrorLogEntity(
      schema.id,
      schema.fileId,
      schema.rowNumber,
      schema.message,
      schema.rawData,
      schema.isAiClassified,
      schema.aiClassification,
      schema.severity,
    );
  }

  private errorToSchema(entity: ErrorLogEntity): Partial<ErrorLogSchema> {
    return {
      id: entity.id,
      fileId: entity.fileId,
      rowNumber: entity.rowNumber,
      message: entity.message,
      rawData: entity.rawData,
      isAiClassified: entity.isAiClassified,
      aiClassification: entity.aiClassification,
      severity: entity.severity,
    };
  }

  private compraToSchema(entity: CompraEntity): Partial<CompraSchema> {
    return {
      id: entity.id,
      fileId: entity.fileId,
      id_transaccion: entity.idTransaccion,
      fecha_registro: entity.fechaRegistro,
      concepto: entity.concepto,
      monto: entity.monto,
      estado: entity.estado,
      metodo_pago: entity.metodoPago,
      observaciones: entity.observaciones ?? null,
    };
  }

  // ─── FileRepositoryPort implementation ─────────────────────────────

  async saveFile(file: FileEntity): Promise<void> {
    const schema = this.toSchema(file);
    await this.fileRepo.save(schema);
  }

  async findById(id: string): Promise<FileEntity | null> {
    const schema = await this.fileRepo.findOne({ where: { id } });
    if (!schema) return null;

    // Cargar chunks si el archivo está en estado UPLOADING
    let chunks: FileChunkSchema[] = [];
    if (schema.status === 'UPLOADING') {
      chunks = await this.chunkRepo.find({
        where: { fileId: id },
        order: { chunkIndex: 'ASC' },
      });
    }

    return this.toDomain(schema, chunks);
  }

  async findAll(): Promise<FileEntity[]> {
    const schemas = await this.fileRepo.find({
      order: { createdAt: 'DESC' },
    });
    return schemas.map(s => this.toDomain(s));
  }

  async updateFile(file: FileEntity): Promise<void> {
    const schema = this.toSchema(file);
    await this.fileRepo.save(schema);

    // Persistir chunks nuevos (si el entity tiene chunks en su Map)
    if (file.chunks.size > 0) {
      for (const [chunkIndex, data] of file.chunks.entries()) {
        // Upsert: verificar si ya existe este chunk
        const existing = await this.chunkRepo.findOne({
          where: { fileId: file.id, chunkIndex },
        });
        if (!existing) {
          await this.chunkRepo.save({
            id: randomUUID(),
            fileId: file.id,
            chunkIndex,
            data,
          });
        }
      }
    }

    // Si el archivo ya no está en UPLOADING, limpiar los chunks de la BD
    if (file.status !== 'UPLOADING') {
      await this.chunkRepo.delete({ fileId: file.id });
    }
  }

  async saveErrorLog(errorLog: ErrorLogEntity): Promise<void> {
    const schema = this.errorToSchema(errorLog);
    await this.errorRepo.save(schema);
  }

  async findErrorsByFileId(fileId: string): Promise<ErrorLogEntity[]> {
    const schemas = await this.errorRepo.find({ where: { fileId } });
    return schemas.map(s => this.errorToDomain(s));
  }

  async findByHash(hash: string): Promise<FileEntity | null> {
    const schema = await this.fileRepo.findOne({ where: { fileHash: hash } });
    if (!schema) return null;
    return this.toDomain(schema);
  }

  async saveCompra(compra: CompraEntity): Promise<void> {
    const schema = this.compraToSchema(compra);
    await this.compraRepo.save(schema);
  }

  async upsertCompra(compra: CompraEntity): Promise<void> {
    const existing = await this.compraRepo.findOne({
      where: { id_transaccion: compra.idTransaccion }
    });

    if (existing) {
      console.log(`[Repository] Transacción duplicada detectada: ${compra.idTransaccion}. Saltando...`);
      return;
    }

    const schema = this.compraToSchema(compra);
    await this.compraRepo.save(schema);
  }

  async incrementProgress(id: string): Promise<{ file: FileEntity; justCompleted: boolean } | null> {
    // Atomic increment
    await this.fileRepo.increment({ id }, 'processedRecords', 1);
    const schema = await this.fileRepo.findOne({ where: { id } });
    if (!schema) return null;

    let justCompleted = false;
    // Comprobar si ha llegado al total
    if (schema.processedRecords >= schema.totalRecords && schema.status !== 'COMPLETED') {
      // Intentar una actualización atómica del estado con compare-and-swap
      const updateResult = await this.fileRepo.update(
        { id: schema.id, status: 'PROCESSING' }, // O cualquier estado diferente a COMPLETED
        { status: 'COMPLETED' }
      );
      // Si affected > 0, significa que este proceso fue el que logró cambiar a COMPLETED
      if (updateResult.affected && updateResult.affected > 0) {
        justCompleted = true;
        schema.status = 'COMPLETED';
      }
    }

    return { file: this.toDomain(schema), justCompleted };
  }
}
