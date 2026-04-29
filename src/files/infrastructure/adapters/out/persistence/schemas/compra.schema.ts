import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('compras')
export class CompraSchema {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column('varchar', { length: 36 })
  fileId: string;

  @Column('varchar', { length: 50 })
  id_transaccion: string;

  @Column('datetime')
  fecha_registro: Date;

  @Column('varchar', { length: 255 })
  concepto: string;

  @Column('decimal', { precision: 12, scale: 2 })
  monto: number;

  @Column('varchar', { length: 20 })
  estado: string;

  @Column('varchar', { length: 50 })
  metodo_pago: string;

  @Column('text', { nullable: true })
  observaciones: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
