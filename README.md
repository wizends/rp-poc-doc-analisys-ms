# Document Analysis Microservice

Este microservicio se encarga de procesar archivos Excel de gran volumen (100k+ registros) de manera eficiente, utilizando una arquitectura de colas de dos etapas para garantizar la equidad en el procesamiento y evitar el bloqueo del Event Loop de Node.js.

## 🚀 Requisitos Previos

- [Docker](https://www.docker.com/get-started) y Docker Compose.
- [Node.js](https://nodejs.org/) (opcional, para desarrollo local).

## 🛠️ Levantamiento del Proyecto con Docker

Para levantar toda la infraestructura (Base de Datos, Redis, Redis Insight y el Microservicio) ejecuta:

```bash
docker-compose up -d --build
```

Esto levantará los siguientes servicios:

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| **API (MS)** | `3000` | Endpoint principal del microservicio NestJS. |
| **MySQL** | `3306` | Base de datos persistente para archivos, compras y logs. |
| **Redis** | `6379` | Motor de colas (BullMQ) y almacenamiento temporal de lotes. |
| **Redis Insight** | `5540` | Interfaz web para monitorear las colas de Redis. |

### Verificación

- **API Health:** [http://localhost:3000/](http://localhost:3000/)
- **Monitoreo de Colas:** [http://localhost:5540/](http://localhost:5540/) (Deberás añadir la conexión a `redis:6379` la primera vez).

---

## 🏗️ Arquitectura de Procesamiento

El sistema utiliza un **Continuation Pattern** respaldado por Redis para manejar archivos masivos sin bloquear a otros usuarios:

1. **Etapa 1 (file-processing):** Lee el Excel, valida los tipos de datos en CPU y almacena los resultados en una lista de Redis (`validated-rows:{fileId}`).
2. **Etapa 2 (row-save):** Un worker consume lotes de 500 filas de Redis y las inserta en MySQL. Al terminar un lote, se re-encola a sí mismo si aún quedan filas en Redis.

Esto permite que si se suben dos archivos grandes simultáneamente, los workers se turnen entre lotes de ambos archivos (Round-Robin), evitando que uno monopolice el sistema.

## 💻 Desarrollo Local (Sin Docker para el MS)

Si prefieres ejecutar el código de NestJS localmente pero mantener la base de datos y redis en Docker:

1. Levanta solo la infraestructura:
   ```bash
   docker-compose up -d mysql redis redisinsight
   ```
2. Instala dependencias:
   ```bash
   npm install
   ```
3. Inicia en modo desarrollo:
   ```bash
   npm run start:dev
   ```

---

## 📄 Endpoints Principales

- `POST /v1/files/upload/init`: Inicia la sesión de carga.
- `POST /v1/files/upload/:id/chunk`: Sube un fragmento del archivo.
- `POST /v1/files/upload/:id/complete`: Ensambla el archivo e inicia el procesamiento.
- `GET /v1/files/:id/progress`: Streaming SSE para seguimiento en tiempo real.
- `GET /v1/files/:id/errors`: Obtiene los logs de validación.
