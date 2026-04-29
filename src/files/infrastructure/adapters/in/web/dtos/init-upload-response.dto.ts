import { ApiProperty } from '@nestjs/swagger';

export class InitUploadResponseDto {
  @ApiProperty({
    description: 'ID único generado para el archivo',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  fileId: string;

  @ApiProperty({
    description: 'Mensaje de confirmación',
    example: 'Upload initialized. Send chunks.',
  })
  message: string;

  @ApiProperty({
    description: 'Cantidad total de chunks esperados',
    example: 10,
  })
  totalChunks: number;
}
