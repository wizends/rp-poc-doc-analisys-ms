/**
 * Validadores de campo para registros de transacciones de pago.
 * Cada validador retorna null si el campo es válido, o un mensaje de error descriptivo.
 */

export interface FieldValidationError {
  column: string;
  value: any;
  message: string;
  errorType: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function isEmpty(value: any): boolean {
  return value === null || value === undefined || value === '';
}

const VALID_ESTADOS = ['APROBADO', 'PENDIENTE', 'RECHAZADO', 'EN PROCESO', 'CANCELADO'];
const VALID_METODOS_PAGO = ['TRANSFERENCIA', 'TARJETA', 'EFECTIVO', 'CHEQUE', 'PSE', 'NEQUI', 'DAVIPLATA'];

// ─── Validadores por campo ────────────────────────────────────────────

export function validateIdTransaccion(value: any): FieldValidationError | null {
  if (isEmpty(value)) {
    return { column: 'id_transaccion', value, message: 'El ID de transacción es obligatorio', errorType: 'NULL_FIELD' };
  }
  const str = String(value).trim();
  if (str.length === 0) {
    return { column: 'id_transaccion', value, message: 'El ID de transacción no puede estar vacío', errorType: 'NULL_FIELD' };
  }
  if (str.length > 50) {
    return { column: 'id_transaccion', value: str, message: `El ID de transacción excede 50 caracteres (tiene ${str.length})`, errorType: 'INVALID_FORMAT' };
  }
  return null;
}

export function validateFechaRegistro(value: any): FieldValidationError | null {
  if (isEmpty(value)) {
    return { column: 'fecha_registro', value, message: 'La fecha de registro es obligatoria', errorType: 'NULL_FIELD' };
  }

  // XLSX puede devolver un número serial de Excel para fechas
  if (typeof value === 'number') {
    // Los seriales de Excel válidos son > 0 y razonables (< 100000 ~= año 2173)
    if (value <= 0 || value > 100000) {
      return { column: 'fecha_registro', value, message: `Valor numérico de fecha fuera de rango: ${value}`, errorType: 'INVALID_FORMAT' };
    }
    return null; // Serial válido
  }

  const str = String(value).trim();
  // Intentar parsear como fecha
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) {
    return { column: 'fecha_registro', value: str, message: `Formato de fecha inválido: "${str}". Se esperan formatos como YYYY-MM-DD o DD/MM/YYYY`, errorType: 'INVALID_FORMAT' };
  }

  // Verificar que no sea una fecha futura
  if (parsed > new Date()) {
    return { column: 'fecha_registro', value: str, message: `La fecha de registro no puede ser futura: "${str}"`, errorType: 'INVALID_VALUE' };
  }

  return null;
}

export function validateConcepto(value: any): FieldValidationError | null {
  if (isEmpty(value)) {
    return { column: 'concepto', value, message: 'El concepto es obligatorio', errorType: 'NULL_FIELD' };
  }
  if (typeof value !== 'string') {
    return { column: 'concepto', value, message: `El concepto debe ser texto, se encontró ${typeof value}`, errorType: 'INVALID_TYPE' };
  }
  const str = value.trim();
  if (str.length === 0) {
    return { column: 'concepto', value, message: 'El concepto no puede estar vacío', errorType: 'NULL_FIELD' };
  }
  if (str.length > 255) {
    return { column: 'concepto', value: str.substring(0, 50) + '...', message: `El concepto excede 255 caracteres (tiene ${str.length})`, errorType: 'INVALID_FORMAT' };
  }
  return null;
}

export function validateMonto(value: any): FieldValidationError | null {
  if (isEmpty(value)) {
    return { column: 'monto', value, message: 'El monto es obligatorio', errorType: 'NULL_FIELD' };
  }

  const num = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(num)) {
    return { column: 'monto', value, message: `El monto debe ser numérico, se encontró: "${value}"`, errorType: 'INVALID_TYPE' };
  }
  if (num < 0) {
    return { column: 'monto', value: num, message: `Monto negativo detectado: ${num}. Los montos deben ser >= 0`, errorType: 'INVALID_VALUE' };
  }
  if (num > 999999999.99) {
    return { column: 'monto', value: num, message: `Monto excesivamente alto: ${num}. Posible error de captura`, errorType: 'INVALID_VALUE' };
  }

  return null;
}

export function validateEstado(value: any): FieldValidationError | null {
  if (isEmpty(value)) {
    return { column: 'estado', value, message: 'El estado es obligatorio', errorType: 'NULL_FIELD' };
  }
  if (typeof value !== 'string') {
    return { column: 'estado', value, message: `El estado debe ser texto, se encontró ${typeof value}`, errorType: 'INVALID_TYPE' };
  }
  const str = value.trim().toUpperCase();
  if (!VALID_ESTADOS.includes(str)) {
    return {
      column: 'estado',
      value: str,
      message: `Estado inválido: "${str}". Valores permitidos: ${VALID_ESTADOS.join(', ')}`,
      errorType: 'INVALID_VALUE',
    };
  }
  return null;
}

export function validateMetodoPago(value: any): FieldValidationError | null {
  if (isEmpty(value)) {
    return { column: 'metodo_pago', value, message: 'El método de pago es obligatorio', errorType: 'NULL_FIELD' };
  }
  if (typeof value !== 'string') {
    return { column: 'metodo_pago', value, message: `El método de pago debe ser texto, se encontró ${typeof value}`, errorType: 'INVALID_TYPE' };
  }
  const str = value.trim().toUpperCase();
  if (!VALID_METODOS_PAGO.includes(str)) {
    return {
      column: 'metodo_pago',
      value: str,
      message: `Método de pago inválido: "${str}". Valores permitidos: ${VALID_METODOS_PAGO.join(', ')}`,
      errorType: 'INVALID_VALUE',
    };
  }
  return null;
}

export function validateObservaciones(value: any): FieldValidationError | null {
  // Observaciones es opcional, puede ser null
  if (isEmpty(value)) {
    return null;
  }
  if (typeof value !== 'string') {
    return { column: 'observaciones', value, message: `Las observaciones deben ser texto, se encontró ${typeof value}`, errorType: 'INVALID_TYPE' };
  }
  if (value.length > 1000) {
    return { column: 'observaciones', value: value.substring(0, 50) + '...', message: `Las observaciones exceden 1000 caracteres (tiene ${value.length})`, errorType: 'INVALID_FORMAT' };
  }
  return null;
}

// ─── Validador completo de fila ───────────────────────────────────────

export interface RowValidationResult {
  rowNumber: number;
  isValid: boolean;
  errors: FieldValidationError[];
  rowData: Record<string, any>;
}

/**
 * Valida una fila completa campo por campo.
 * Retorna todos los errores encontrados para la fila.
 */
export function validateRow(row: Record<string, any>, rowNumber: number): RowValidationResult {
  const errors: FieldValidationError[] = [];

  const validators: Array<(value: any) => FieldValidationError | null> = [
    () => validateIdTransaccion(row['id_transaccion']),
    () => validateFechaRegistro(row['fecha_registro']),
    () => validateConcepto(row['concepto']),
    () => validateMonto(row['monto']),
    () => validateEstado(row['estado']),
    () => validateMetodoPago(row['metodo_pago']),
    () => validateObservaciones(row['observaciones']),
  ];

  for (const validator of validators) {
    const error = validator(row);
    if (error) {
      errors.push(error);
    }
  }

  return {
    rowNumber,
    isValid: errors.length === 0,
    errors,
    rowData: row,
  };
}
