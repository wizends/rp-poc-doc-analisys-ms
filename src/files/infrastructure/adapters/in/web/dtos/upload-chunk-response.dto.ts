import { ApiProperty } from '@nestjs/swagger';

export class UploadChunkResponseDto {
  @ApiProperty({
    description: 'Mensaje de confirmación',
    example: 'Chunk 0 received',
  })
  message: string;

  @ApiProperty({
    description: 'Cantidad de chunks recibidos hasta ahora',
    example: 1,
  })
  receivedChunks: number;

  @ApiProperty({
    description: 'Cantidad total de chunks esperados',
    example: 10,
  })
  totalChunks: number;
}
