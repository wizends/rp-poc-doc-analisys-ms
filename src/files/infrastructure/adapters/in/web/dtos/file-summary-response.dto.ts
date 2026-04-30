import { ApiProperty } from '@nestjs/swagger';

export class FileSummaryResponseDto {
  @ApiProperty({
    description: 'Resumen generado por IA o fallback determinista',
    example: 'Se detectaron 3 errores: 1 de validación, 2 por anomalías. Total procesado: 100000.',
  })
  summary: string;
}
