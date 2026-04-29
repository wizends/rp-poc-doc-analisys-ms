export class CompraEntity {
  constructor(
    public readonly id: string,
    public readonly fileId: string,
    public idTransaccion: string,
    public fechaRegistro: Date,
    public concepto: string,
    public monto: number,
    public estado: string,
    public metodoPago: string,
    public observaciones?: string,
  ) {}
}
