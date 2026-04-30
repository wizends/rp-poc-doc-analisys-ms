import { ApiProperty } from '@nestjs/swagger';

export class UploadFileResponseDto {
  @ApiProperty({
    description: 'Mensaje de confirmación',
    example: 'File is being processed',
  })
  message: string;

  @ApiProperty({
    description: 'ID único generado para el archivo',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  fileId: string;
}
