# 📱 Enova Concord v1.0 (AlwaysData Edition)

**Sistema de Gestión de Clientes, Soportes e-commerce y Métricas de Rendimiento.**

![Versión](https://img.shields.io/badge/Versión-1.0.0-blue?style=for-the-badge)
![Codename](https://img.shields.io/badge/Codename-AlwaysData-orange?style=for-the-badge)
![Estado](https://img.shields.io/badge/Estado-Producción-success?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-React%20|%20Node.js%20|%20PostgreSQL-blueviolet?style=for-the-badge)

Enova Concord centraliza el monitoreo técnico, el control de planes de servicio y la resolución de incidencias de tiendas e-commerce. Esta versión introduce un diseño multi-tenant con estilo e-ink, tableros Kanban y automatización de tickets vía correo electrónico.

---

## 🚀 Novedades de la Versión 1.0 (AlwaysData)

### 📊 Interfaz Analítica "e-Ink"
* **Métricas SVG Dinámicas**: Panel de rendimiento avanzado que dibuja gráficas vectoriales de uso de RAM, tiempos de carga (Load) e interactividad (DOM) soportando hasta 7 tiendas en simultáneo.
* **Cuadrícula Inteligente 3x3**: Maestro de clientes optimizado a 9 tarjetas por página con paginación integrada y badges de tecnologías por color.

### 📧 Automatización IMAP
* **Tickets Auto-generados**: El `EmailService` escucha en tiempo real la bandeja de entrada corporativa y convierte los correos electrónicos nuevos o respuestas en hilos de soporte técnico dentro de la base de datos.
* **Procesamiento de Archivos**: Integración de Multer para la subida asíncrona de logotipos y adjuntos sin recargar el cliente web.

### 🛡️ Cortafuegos Multi-Tenant
* **Parseo de Correos Híbrido**: El sistema JWT analiza listas de correos separadas por comas para asegurar que cada cliente acceda de forma estricta y exclusiva a los datos de su propia organización.
* **Protección Activa**: Mitigación de saturaciones mediante `express-rate-limit` adaptado para trabajar bajo proxys inversos.

---

## 🧠 Características Principales

### 1. Tablero Kanban de Soporte
* **Gestión Visual**: Arrastrar y soltar (Drag & Drop) para mover incidencias entre `OPEN`, `IN_PROGRESS`, `RESOLVED` y `CLOSED`.
* **Vista de Calendario**: Interfaz alternativa para auditar la carga operativa basada en la fecha de creación de los tickets.

### 2. Gestión de Clientes y Planes
* **Estandarización**: Control estricto a nivel de base de datos de los planes admitidos (`GO`, `GROWTH`, `ESCALE`, `WARRANTY`, `LEAD`, etc.).
* **Contadores Automáticos**: Triggers lógicos que actualizan el historial de tickets reportados por cada tienda sin afectar el rendimiento.

### 3. Seguridad Empresarial
* **Hardening Integrado**: Uso de `helmet` para políticas de seguridad cruzada (CORS) y protección de cabeceras.
* **Auto-reparación**: Lógica de fallback bcrypt que detecta hashes de contraseñas corruptos y los restaura silenciosamente durante el inicio de sesión.

---

## 🛠️ Stack Tecnológico

* **Backend**: Node.js, Express.js, Knex.js (Query Builder).
* **Base de Datos**: PostgreSQL 17.10.
* **Frontend**: React 19, Vite, React Router DOM, Axios.
* **Servicios Extra**: `imapflow` (Lectura de correos), `multer` (Archivos), `jsonwebtoken` (Auth).

---

## ⚙️ Instalación Rápida

1.  **Clonar el repositorio e instalar dependencias:**
```bash
    # Backend
    cd ecrm-backend
    npm install
    
    # Frontend
    cd ../ecrm-frontend
    npm install
    ```

2.  **Configurar `.env` (Backend):**
```env
    PORT=3000
    DB_HOST=tu-servidor-postgresql.net
    DB_USER=tu_usuario
    DB_PASSWORD=tu_password
    DB_NAME=tu_base_datos
    JWT_SECRET=tu_clave_secreta
    ```

3.  **Configurar `.env` (Frontend):**
```env
    VITE_API_URL=http://localhost:3000/api
    ```

4.  **Iniciar Entornos:**
    * Ejecutar base de datos PostgreSQL.
    * Backend: `npm start` (o `node src/index.js`)
    * Frontend: `npm run dev`

---

## 📂 Estructura del Proyecto

```text
ecrm-root/
├── ecrm-backend/
│   ├── src/
│   │   ├── config/          # Conexión DB Knex
│   │   ├── db/migrations/   # Esquemas PostgreSQL
│   │   ├── repositories/    # Lógica de datos (Stores, Tickets, Metrics)
│   │   ├── routes/          # Controladores API
│   │   ├── services/        # Lógica de correos IMAP
│   │   └── index.js         # Entry point, Rate Limiter y Auth
├── ecrm-frontend/
│   ├── public/              # Assets estáticos
│   ├── src/
│   │   ├── api/             # Configuración de Axios con JWT
│   │   ├── components/      # Protected Routes
│   │   └── views/admin/     # Pantallas React (Dashboard, Kanban, Métricas)
│   └── vite.config.js
