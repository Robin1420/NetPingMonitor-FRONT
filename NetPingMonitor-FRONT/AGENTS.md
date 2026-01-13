# AGENTS.md

Instrucciones locales para asistentes en este repo. Ajusta tu trabajo a estas reglas.

## Alcance

* Este archivo define normas de trabajo, estilo y validacion para tareas en este repo.
* El proyecto se llama **NetPingMonitor-FRONT**.
* Es un **frontend React + Vite** para un entorno **NOC/ISP** orientado a monitoreo por **ICMP ping**.
* La UI consume la **API del backend**; no implementar logica de backend en el front.
* Si hay conflicto con instrucciones globales del sistema, seguir las globales.

---

## Flujo de trabajo

* Leer el contexto del proyecto antes de cambiar codigo.
* Revisar estructura en `src/` y estilos existentes antes de proponer cambios.
* Confirmar la URL base de la API antes de consumir endpoints.
* Preguntar si una tarea es ambigua o falta informacion critica (roles, permisos, flujos).
* Preferir cambios pequenos, incrementales y claramente justificables.
* No agregar dependencias nuevas sin pedir permiso primero.

---

## Edicion y estilo

* Mantener el estilo existente del proyecto cuando exista.
* Usar **React funcional** con hooks; evitar clases.
* Evitar `any` en tipado (si se usa TS) y evitar `dangerouslySetInnerHTML`.
* Manejar estados **loading / error / empty** en pantallas de datos.
* Mantener la copia de la UI en **espanol**.
* Organizar la UI por **paginas** y **componentes** (`src/pages` y `src/components`).
* Color principal: `#ff4404` y derivados de apoyo; usar variables CSS (`--accent`, `--accent-strong`).
* Comentarios solo si la logica es compleja, con formato:
  `Para que sirve: ...; Como funciona: ...; De quien depende: ...`.

---

## Configuracion y entorno

* No hardcodear URLs ni secretos.
* Usar `.env` con `VITE_API_BASE_URL` (fallback local: `http://127.0.0.1:8000/api/v1`).
* No almacenar credenciales en el repo.

---

## API (resumen de consumo)

* Base: `/api/v1`.
* Autenticacion web: **JWT** via `/api/v1/auth/login`.
* Enviar token con `Authorization: Bearer <token>`.
* Endpoints esperados:
  * `GET /api/v1/health`
  * `GET /api/v1/targets`
  * `GET /api/v1/targets/{id}/status`
  * `GET /api/v1/targets/{id}/history`
  * `GET /api/v1/alerts`
* El endpoint `/api/v1/ping-results` es solo para el worker; no usar en la UI.

---

## Validacion

* `npm run dev` para desarrollo local.
* `npm run build` para validar build.
* `npm run lint` si se modifican archivos de JS/JSX.
* No inventar resultados de pruebas.

---

## Git

* No crear commits ni modificar el historial a menos que el usuario lo solicite explicitamente.
* No revertir cambios existentes.
* No crear ramas nuevas sin indicacion.

---

## Nota final para el asistente

Este repositorio representa una **herramienta NOC real**, no un proyecto academico.
Las decisiones deben priorizar **claridad, usabilidad y mantenibilidad**.
