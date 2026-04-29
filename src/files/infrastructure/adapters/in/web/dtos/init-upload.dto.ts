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
}
