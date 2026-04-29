export type FileStatus = 'UPLOADING' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type ErrorClassification = 'Error de validación' | 'Error de datos' | 'Posible fraude/anomalía' | 'Error técnico' | 'Sin clasificar';

export class ErrorLogEntity {
  constructor(
    public readonly id: string,
    public readonly fileId: string,
    public readonly rowNumber: number,
    public readonly message: string,
    public readonly rawData?: any,
    public isAiClassified: boolean = false,
    public aiClassification: ErrorClassification = 'Sin clasificar',
  ) { }

  classify(classification: ErrorClassification) {
    this.aiClassification = classification;
    this.isAiClassified = true;
  }
}

export class FileEntity {
  /** Mapa ordenado de chunks recibidos: chunkIndex -> base64 data */
  public chunks: Map<number, string> = new Map();
  /** Base64 ensamblado final (disponible tras llamar assembleChunks) */
  public fileBase64?: string;

  /** Total de registros en el archivo (calculado al procesar el Excel) */
  public totalRecords: number = 0;

  constructor(
    public readonly id: string,
    public readonly filename: string,
    public status: FileStatus,
    public totalChunks: number = 1,
    public processedRecords: number = 0,
    public readonly fileHash?: string,
    public readonly createdAt: Date = new Date(),
  ) { }

  /** Agrega un chunk y retorna la cantidad de chunks recibidos */
  addChunk(chunkIndex: number, data: string): number {
    if (chunkIndex < 0 || chunkIndex >= this.totalChunks) {
      throw new Error(`Chunk index ${chunkIndex} fuera de rango [0, ${this.totalChunks - 1}]`);
    }
    this.chunks.set(chunkIndex, data);
    return this.chunks.size;
  }

  /** Retorna true si todos los chunks han sido recibidos */
  get allChunksReceived(): boolean {
    return this.chunks.size === this.totalChunks;
  }

  /** Ensambla todos los chunks en un solo string base64 */
  assembleChunks(): string {
    if (!this.allChunksReceived) {
      throw new Error(`Faltan chunks: recibidos ${this.chunks.size}/${this.totalChunks}`);
    }
    // Ordenar por índice y concatenar
    const sorted: string[] = [];
    for (let i = 0; i < this.totalChunks; i++) {
      const chunk = this.chunks.get(i);
      if (!chunk) {
        throw new Error(`Chunk ${i} no encontrado`);
      }
      sorted.push(chunk);
    }
    this.fileBase64 = sorted.join('');
    // Liberar memoria de los chunks individuales
    this.chunks.clear();
    return this.fileBase64;
  }

  updateProgress(processed: number) {
    this.processedRecords = processed;
    if (this.processedRecords >= this.totalRecords) {
      this.status = 'COMPLETED';
    }
  }

  markAsFailed() {
    this.status = 'FAILED';
  }
}


