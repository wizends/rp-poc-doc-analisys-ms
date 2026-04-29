import { ApiProperty } from '@nestjs/swagger';

export class InitUploadDto {
  @ApiProperty({
    description: 'Nombre del archivo Excel',
    example: 'pagos_enero_2024.xlsx',
  })
  filename: string;

  @ApiProperty({
    description: 'Cantidad total de chunks en los que se dividirá el archivo',
    example: 10,
  })
  totalChunks: number;

  @ApiProperty({
    description: 'Hash único del archivo (ej. SHA-256 o MD5) para evitar subidas duplicadas',
    example: 'a2b3c4d5e6f7...',
    required: false,
  })
  fileHash?: string;
}
