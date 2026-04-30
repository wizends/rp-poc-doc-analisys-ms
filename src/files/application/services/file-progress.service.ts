import { Injectable, Inject, MessageEvent } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { FILE_REPOSITORY_PORT } from '../../domain/ports/file.repository.port';
import type { FileRepositoryPort } from '../../domain/ports/file.repository.port';

export interface FileProgressEvent {
  fileId: string;
  processedRecords: number;
  totalRecords: number;
  status: string;
  summary?: string;
}

@Injectable()
export class FileProgressService {
  private progressSubject = new Subject<FileProgressEvent>();

  constructor(
    @Inject(FILE_REPOSITORY_PORT)
    private readonly fileRepository: FileRepositoryPort,
  ) {}

  /**
   * Emite un evento de progreso para un archivo específico
   */
  emitProgress(event: FileProgressEvent) {
    this.progressSubject.next(event);
  }

  /**
   * Devuelve un Observable que emite los eventos de progreso para un fileId específico
   */
  getProgressObservable(fileId: string): Observable<MessageEvent> {
    const liveStream$ = this.progressSubject.asObservable().pipe(
      filter(event => event.fileId === fileId),
      map(event => ({ data: event } as MessageEvent))
    );

    return new Observable<MessageEvent>(subscriber => {
      let isCompleted = false;

      // 1. Consultar estado actual inmediatamente para evitar perder eventos si el procesamiento fue muy rápido
      this.fileRepository.findById(fileId).then(file => {
        if (!file) return;

        if (!isCompleted) {
          subscriber.next({
            data: {
              fileId: file.id,
              processedRecords: file.processedRecords,
              totalRecords: file.totalRecords,
              status: file.status,
              summary: file.summary,
            }
          });

          // Si ya terminó, cerrar el stream de inmediato
          if (file.status === 'COMPLETED' || file.status === 'FAILED') {
            isCompleted = true;
            subscriber.complete();
          }
        }
      }).catch(err => {
        console.error('Error fetching initial file status for SSE:', err);
      });

      // 2. Suscribirse a los eventos en vivo
      const sub = liveStream$.subscribe({
        next: (val) => {
          if (!isCompleted) subscriber.next(val);
        },
        error: (err) => {
          if (!isCompleted) subscriber.error(err);
        },
        complete: () => {
          if (!isCompleted) subscriber.complete();
        },
      });

      return () => {
        isCompleted = true;
        sub.unsubscribe();
      };
    });
  }
}
