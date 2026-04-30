import { ApiProperty } from '@nestjs/swagger';

export class ClasifyErrorsResponseDto {
  @ApiProperty({
    description: 'Identificador único del registro de error',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Descripción detallada del error encontrado',
    example: 'Monto negativo no permitido',
  })
  error: string;

  @ApiProperty({
    description: 'Monto asociado a la transacción con error',
    example: -5000,
  })
  amount: number;

  @ApiProperty({
    description: 'Identificador del cliente asociado al registro',
    example: '123',
  })
  customer_id: string;

  @ApiProperty({
    description: 'Categoría de clasificación del error',
    example: 'VALIDATION_ERROR',
  })
  category: string;

  @ApiProperty({
    description: 'Nivel de severidad del error',
    example: 'MEDIUM',
  })
  severity: string;
}
