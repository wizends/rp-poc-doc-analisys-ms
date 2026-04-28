import { ApiProperty } from '@nestjs/swagger';

export class TriggerClassificationResponseDto {
  @ApiProperty({
    description: 'Mensaje de confirmación del inicio de la clasificación',
    example: 'Classification triggered',
  })
  message: string;
}
