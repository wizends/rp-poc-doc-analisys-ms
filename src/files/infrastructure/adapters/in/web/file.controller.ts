import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { UploadFileDto } from './dtos/upload-file.dto';
import { UploadFileResponseDto } from './dtos/upload-file-response.dto';
import { FileSummaryResponseDto } from './dtos/file-summary-response.dto';
import { TriggerClassificationResponseDto } from './dtos/trigger-classification-response.dto';
import { UploadFileUseCase } from '../../../../application/use-cases/upload-file.use-case';
import { ProcessAiSummaryUseCase } from '../../../../application/use-cases/process-ai-summary.use-case';
import { ClassifyErrorsUseCase } from '../../../../application/use-cases/classify-errors.use-case';

@ApiTags('files')
@Controller('v1/files')
export class FileController {
  constructor(
    private readonly uploadFileUseCase: UploadFileUseCase,
    private readonly processAiSummaryUseCase: ProcessAiSummaryUseCase,
    private readonly classifyErrorsUseCase: ClassifyErrorsUseCase,
  ) {}

  @Post('upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Subir archivo para procesamiento masivo' })
  @ApiBody({ type: UploadFileDto })
  @ApiResponse({ status: 202, description: 'Archivo encolado correctamente', type: UploadFileResponseDto })
  async uploadFile(@Body() body: UploadFileDto): Promise<UploadFileResponseDto> {
    // Simulamos la recepción del archivo y su URL en S3
    const fileUrl = `https://s3.amazonaws.com/bucket/${body.filename}`;
    const fileId = await this.uploadFileUseCase.execute(body.filename, fileUrl, body.totalRecords);
    
    return {
      message: 'File is being processed',
      fileId,
    };
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
}
