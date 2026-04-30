import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { FileSchema } from './file.schema';

@Entity('error_logs')
export class ErrorLogSchema {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 36 })
  fileId: string;

  @Column('int')
  rowNumber: number;

  @Column('text')
  message: string;

  @Column('json', { nullable: true })
  rawData: any;

  @Column('boolean', { default: false })
  isAiClassified: boolean;

  @Column('varchar', { length: 50, default: 'Sin clasificar' })
  aiClassification: string;

  @ManyToOne(() => FileSchema, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileId' })
  file: FileSchema;
}
