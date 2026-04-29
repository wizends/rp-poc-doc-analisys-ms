import { ApiProperty } from '@nestjs/swagger';

export class ErrorItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  rowNumber: number;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  rawData?: any;

  @ApiProperty({ required: false })
  isAiClassified?: boolean;

  @ApiProperty({ required: false })
  aiClassification?: string;
}

export class GetFileErrorsResponseDto {
  @ApiProperty({ type: [ErrorItemDto] })
  errors: ErrorItemDto[];
}
