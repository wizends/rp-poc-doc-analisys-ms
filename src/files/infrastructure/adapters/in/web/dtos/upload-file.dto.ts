import { ApiProperty } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty({
    description: 'Nombre del archivo Excel',
    example: 'pagos_enero_2024.xlsx',
  })
  filename: string;

  @ApiProperty({
    description: 'Cantidad total de registros esperados en el archivo',
    example: 100000,
  })
  totalRecords: number;
}
