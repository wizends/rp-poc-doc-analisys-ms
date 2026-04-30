import { ApiProperty } from '@nestjs/swagger';

export class CompleteUploadResponseDto {
  @ApiProperty({
    description: 'Mensaje de confirmación',
    example: 'File assembled and queued for processing',
  })
  message: string;

  @ApiProperty({
    description: 'ID del archivo',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  fileId: string;

  @ApiProperty({
    description: 'Tamaño total del archivo ensamblado en bytes',
    example: 1048576,
  })
  totalBytes: number;
}
