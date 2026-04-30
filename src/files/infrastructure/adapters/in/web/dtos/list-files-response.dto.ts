import { ApiProperty } from '@nestjs/swagger';
import type { FileStatus } from '../../../../../domain/entities/file.entity';

export class FileListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  filename: string;

  @ApiProperty({ enum: ['UPLOADING', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] })
  status: FileStatus;

  @ApiProperty()
  processedRecords: number;

  @ApiProperty()
  totalRecords: number;

  @ApiProperty()
  createdAt: Date;
}

export class ListFilesResponseDto {
  @ApiProperty({ type: [FileListItemDto] })
  files: FileListItemDto[];
}
