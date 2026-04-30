import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AiServicePort, FileProcessingStats } from '../../../../domain/ports/ai.service.port';
import { ClasifyErrorsResponseDto } from '../../in/web/dtos/clasify-errors-response.dto';
import { ClasifyErrorDto } from '../../in/web/dtos/clasify-errors-request.dto';

@Injectable()
export class GeminiAiAdapter implements AiServicePort {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    } else {
      console.warn('[GeminiAiAdapter] GEMINI_API_KEY no encontrada en las variables de entorno.');
    }
  }

  async generateProcessingSummary(stats: FileProcessingStats): Promise<string> {
    if (!this.model) return `Se procesaron ${stats.totalRecords} registros.`;

    const prompt = `Genera un resumen ejecutivo y profesional de este procesamiento de archivos:
    Total registros: ${stats.totalRecords}
    Errores por categoría: ${JSON.stringify(stats.errorsByCategory)}
    
    El resumen debe ser breve y enfocado a negocio.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('[GeminiAiAdapter] Error generating summary:', error);
      return `Procesamiento completado con ${stats.totalRecords} registros.`;
    }
  }

  async classifyErrors(errors: ClasifyErrorDto[]): Promise<ClasifyErrorsResponseDto[]> {
    if (!this.model) {
      console.warn('[GeminiAiAdapter] Gemini no disponible, usando clasificación básica.');
      return this.fallbackClassify(errors);
    }

    const prompt = `Compórtate como un Analista de errores senior, tu única tarea es clasificar errores técnicos en base de la naturaleza que provengan
Entrada: array de json con detalles del error
Ejemplo: [
  {
    "id": 1,
    "error": "Monto negativo no permitido",
    "amount": -5000,
    "customer_id": "123"
  }
]
Instrucciones: 
1. Analiza el campo error y relacionalo de manera lógica a los otros campos
2. Asigna cada error a una categoría: 
  VALIDATION_ERROR: mal formato o valores imposibles
  NOT_FOUND: campo vacío 
  BUSINESS_RULE: palabras o operaciones que violan las reglas de negocio 
3. Calcula la severidad del error LOW, MEDIUM, HIGH
4. Devuelve un json con el siguiente formato tipo:
[ 
   {
  "id": 1, 
  "error": "Monto negativo no permitido",
  "amount": -5000, 
  "customer_id": "123"  
  "category": "VALIDATION_ERROR", 
  "severity": "MEDIUM"
}
 ]

Datos de entrada:
${JSON.stringify(errors, null, 2)}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extraer solo la parte del JSON (el array [...])
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const cleanedJson = jsonMatch ? jsonMatch[0] : text;
      
      const json = JSON.parse(cleanedJson);
      console.log('[GeminiAiAdapter] clasificacion de errores', json);
      return json;
    } catch (error) {
      console.error('[GeminiAiAdapter] Error en clasificación Gemini:', error);
      return this.fallbackClassify(errors);
    }
  }

  private fallbackClassify(errors: ClasifyErrorDto[]): ClasifyErrorsResponseDto[] {
    return errors.map(e => ({
      id: e.id,
      error: e.error,
      amount: e.amount || 0,
      customer_id: e.customer_id || 'N/A',
      category: 'VALIDATION_ERROR',
      severity: 'MEDIUM'
    }));
  }
}
