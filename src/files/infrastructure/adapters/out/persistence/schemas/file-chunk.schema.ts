import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { FileSchema } from './file.schema';

@Entity('file_chunks')
export class FileChunkSchema {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 36 })
  fileId: string;

  @Column('int')
  chunkIndex: number;

  @Column('longtext')
  data: string;

  @ManyToOne(() => FileSchema, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileId' })
  file: FileSchema;
}
