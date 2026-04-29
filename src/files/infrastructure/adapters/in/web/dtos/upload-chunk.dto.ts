import { ApiProperty } from '@nestjs/swagger';

export class UploadChunkDto {
  @ApiProperty({
    description: 'Índice del chunk (0-based)',
    example: 0,
  })
  chunkIndex: number;

  @ApiProperty({
    description: 'Contenido del chunk codificado en Base64',
    example: 'UEsDBBQAAAAIAA...',
  })
  data: string;
}
