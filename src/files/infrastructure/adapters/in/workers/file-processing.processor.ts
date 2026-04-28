import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('file-processing')
export class FileProcessingProcessor extends WorkerHost {
  async process(job: Job<any, any, string>): Promise<any> {
    const { fileId } = job.data;
    console.log(`[Worker] Iniciando procesamiento del trabajo ${job.id} para el archivo: ${fileId}`);

    // TODO: Llamar al caso de uso ProcessFileUseCase que descargaría el archivo,
    // leería el Excel en streams y validaría cada registro.

    // Simulación de carga de trabajo pesada -- Solo TEST 
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`[Worker] Procesamiento completado para el trabajo ${job.id}`);
  }
}
