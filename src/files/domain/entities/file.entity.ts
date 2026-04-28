export type FileStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export class FileEntity {
  constructor(
    public readonly id: string,
    public readonly filename: string,
    public status: FileStatus,
    public totalRecords: number,
    public processedRecords: number = 0,
    public fileUrl?: string,
    public readonly createdAt: Date = new Date(),
  ) {}

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
  ) {}

  classify(classification: ErrorClassification) {
    this.aiClassification = classification;
    this.isAiClassified = true;
  }
}
