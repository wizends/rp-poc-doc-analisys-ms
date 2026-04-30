import { ApiProperty } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty({
    description: 'Nombre del archivo Excel',
    example: 'pagos_enero_2024.xlsx',
  })
  filename: string;

  @ApiProperty({
    description: 'Contenido del archivo codificado en Base64',
    example: 'UEsDBBQAAAAIAA...',
  })
  fileBase64: string;
}
