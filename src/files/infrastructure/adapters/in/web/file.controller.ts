import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus, NotFoundException, BadRequestException, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { InitUploadDto } from './dtos/init-upload.dto';
import { InitUploadResponseDto } from './dtos/init-upload-response.dto';
import { UploadChunkDto } from './dtos/upload-chunk.dto';
import { UploadChunkResponseDto } from './dtos/upload-chunk-response.dto';
import { CompleteUploadResponseDto } from './dtos/complete-upload-response.dto';
import { FileSummaryResponseDto } from './dtos/file-summary-response.dto';
import { TriggerClassificationResponseDto } from './dtos/trigger-classification-response.dto';
import { InitUploadUseCase } from '../../../../application/use-cases/init-upload.use-case';
import { UploadChunkUseCase } from '../../../../application/use-cases/upload-chunk.use-case';
import { CompleteUploadUseCase } from '../../../../application/use-cases/complete-upload.use-case';
import { ProcessAiSummaryUseCase } from '../../../../application/use-cases/process-ai-summary.use-case';
import { ClassifyErrorsUseCase } from '../../../../application/use-cases/classify-errors.use-case';
import { GetFileErrorsUseCase } from '../../../../application/use-cases/get-file-errors.use-case';
import { GetFileErrorsResponseDto } from './dtos/get-file-errors-response.dto';
import { FileProgressService } from '../../../../application/services/file-progress.service';

@ApiTags('files')
@Controller('v1/files')
export class FileController {
  constructor(
    private readonly initUploadUseCase: InitUploadUseCase,
    private readonly uploadChunkUseCase: UploadChunkUseCase,
    private readonly completeUploadUseCase: CompleteUploadUseCase,
    private readonly processAiSummaryUseCase: ProcessAiSummaryUseCase,
    private readonly classifyErrorsUseCase: ClassifyErrorsUseCase,
    private readonly getFileErrorsUseCase: GetFileErrorsUseCase,
    private readonly fileProgressService: FileProgressService,
  ) { }

  @Post('upload/init')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Inicializar carga de archivo por chunks' })
  @ApiBody({ type: InitUploadDto })
  @ApiResponse({ status: 201, description: 'Sesión de upload creada', type: InitUploadResponseDto })
  async initUpload(@Body() body: InitUploadDto): Promise<InitUploadResponseDto> {
    const fileId = await this.initUploadUseCase.execute(body.filename, body.totalChunks, body.fileHash);
    return {
      fileId,
      message: 'Upload initialized. Send chunks.',
      totalChunks: body.totalChunks,
    };
  }

  @Post('upload/:id/chunk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subir un chunk del archivo en Base64' })
  @ApiBody({ type: UploadChunkDto })
  @ApiResponse({ status: 200, description: 'Chunk recibido correctamente', type: UploadChunkResponseDto })
  @ApiResponse({ status: 400, description: 'Error en el chunk' })
  @ApiResponse({ status: 404, description: 'Archivo no encontrado' })
  async uploadChunk(
    @Param('id') id: string,
    @Body() body: UploadChunkDto,
  ): Promise<UploadChunkResponseDto> {
    try {
      const result = await this.uploadChunkUseCase.execute(id, body.chunkIndex, body.data);
      return {
        message: `Chunk ${body.chunkIndex} received`,
        receivedChunks: result.receivedChunks,
        totalChunks: result.totalChunks,
      };
    } catch (e) {
      if (e.message?.includes('no encontrado')) {
        throw new NotFoundException(e.message);
      }
      throw new BadRequestException(e.message);
    }
  }

  @Post('upload/:id/complete')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Finalizar carga y ensamblar el archivo para procesamiento' })
  @ApiResponse({ status: 202, description: 'Archivo ensamblado y encolado', type: CompleteUploadResponseDto })
  @ApiResponse({ status: 400, description: 'Faltan chunks o estado inválido' })
  @ApiResponse({ status: 404, description: 'Archivo no encontrado' })
  async completeUpload(@Param('id') id: string): Promise<CompleteUploadResponseDto> {
    try {
      const result = await this.completeUploadUseCase.execute(id);
      return {
        message: 'File assembled and queued for processing',
        fileId: result.fileId,
        totalBytes: result.totalBytes,
      };
    } catch (e) {
      if (e.message?.includes('no encontrado')) {
        throw new NotFoundException(e.message);
      }
      throw new BadRequestException(e.message);
    }
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Obtener el resumen de procesamiento de un archivo' })
  @ApiResponse({ status: 200, description: 'Resumen generado exitosamente', type: FileSummaryResponseDto })
  @ApiResponse({ status: 404, description: 'Archivo no encontrado' })
  async getSummary(@Param('id') id: string): Promise<FileSummaryResponseDto> {
    try {
      const summary = await this.processAiSummaryUseCase.execute(id);
      return { summary };
    } catch (e) {
      throw new NotFoundException('File not found or error generating summary');
    }
  }

  @Post(':id/classify-errors')
  @ApiOperation({ summary: 'Disparar la clasificación de errores por IA' })
  @ApiResponse({ status: 201, description: 'Clasificación completada', type: TriggerClassificationResponseDto })
  async triggerErrorClassification(@Param('id') id: string): Promise<TriggerClassificationResponseDto> {
    await this.classifyErrorsUseCase.execute(id);
    return { message: 'Classification triggered' };
  }

  @Get(':id/errors')
  @ApiOperation({ summary: 'Obtener todos los errores de validación de un archivo' })
  @ApiResponse({ status: 200, description: 'Errores obtenidos exitosamente', type: GetFileErrorsResponseDto })
  @ApiResponse({ status: 404, description: 'Archivo no encontrado' })
  async getErrors(@Param('id') id: string): Promise<GetFileErrorsResponseDto> {
    const errors = await this.getFileErrorsUseCase.execute(id);
    return { errors };
  }

  @Sse(':id/progress')
  @ApiOperation({ summary: 'Conectarse para recibir el progreso de procesamiento vía Server-Sent Events (SSE)' })
  progressStream(@Param('id') id: string): Observable<MessageEvent> {
    return this.fileProgressService.getProgressObservable(id);
  }
}
