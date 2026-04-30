import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ClasifyErrorDto {
  @ApiProperty({
    description: 'Identificador único del registro con error',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'Mensaje descriptivo del error',
    example: 'Monto negativo no permitido',
  })
  @IsString()
  @IsNotEmpty()
  error: string;

  @ApiProperty({
    description: 'Monto de la transacción que generó el error',
    example: -5000,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiProperty({
    description: 'ID del cliente asociado a la transacción',
    example: '123',
    required: false,
  })
  @IsString()
  @IsOptional()
  customer_id?: string;
}
