import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('files')
export class FileSchema {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 255 })
  filename: string;

  @Column('varchar', { length: 20 })
  status: string;

  @Column('int', { default: 0 })
  totalRecords: number;

  @Column('int', { default: 1 })
  totalChunks: number;

  @Column('int', { default: 0 })
  processedRecords: number;

  @Column('longtext', { nullable: true })
  fileBase64: string | null;

  @Column('varchar', { length: 255, nullable: true, unique: true })
  fileHash: string | null;

  @Column('longtext', { nullable: true })
  summary: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
