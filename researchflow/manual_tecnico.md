# Manual tecnico - ResearchFlow v2

## 1. Requisitos

- Cuenta DigitalOcean (droplet Ubuntu 24.04; recomendado 8 GB RAM con creditos, minimo 4 GB).
- Subdominio DuckDNS gratis o dominio propio (requerido para HTTPS y para Google OAuth).
- API key de Gemini (https://aistudio.google.com, cuenta de facturacion Pagado 1).
- Proyecto Google Cloud con OAuth habilitado (credenciales Gmail y Google Sheets).
- Numero de WhatsApp secundario para Evolution API.
- Cuenta Vercel free para la landing.
- En la PC local: ssh/scp y opcionalmente Vercel CLI.

## 2. Arquitectura desplegada

Todo el backend corre en un droplet DigitalOcean con Docker Compose (`deploy/docker-compose.yml`):

| Servicio | Imagen | Rol |
| --- | --- | --- |
| caddy | caddy:2 | Reverse proxy con HTTPS automatico (`n8n.DOMINIO` y `evo.DOMINIO`) |
| postgres | postgres:16 | Base de n8n, base `researchflow` (aplicacion) y base de Evolution |
| redis | redis:7 | Cache/cola para Evolution API |
| n8n | docker.n8n.io/n8nio/n8n | Orquestador con los 4 workflows |
| evolution | atendai/evolution-api:v2.2.0 | Puente WhatsApp (instancia `researchflow`) |

La landing vive en Vercel y llega a n8n via el rewrite `/api/investigar` de `landing_page/vercel.json` (sin CORS). El playbook de investigacion vive en la tabla `app_settings` y se inyecta a los prompts en tiempo de ejecucion.

Workflows (importables en n8n):

| Archivo | Workflow | Disparo |
| --- | --- | --- |
| `n8n_workflow_research_production.json` | Investigacion profunda | `POST /webhook/researchflow` |
| `n8n_workflow_ideas_whatsapp.json` | Ideas por WhatsApp | `POST /webhook/researchflow-whatsapp` (Evolution, evento messages.upsert) |
| `n8n_workflow_weekly_digest.json` | Digest semanal | Schedule lunes 08:00 |
| `n8n_workflow_demo_import.json` | Demo sin credenciales | `POST /webhook/researchflow-demo` |

## 3. Instalacion (resumen)

La guia completa paso a paso esta en `deploy/deploy_digitalocean.md`. Resumen del orden:

1. Crear droplet Ubuntu 24.04 y apuntar el dominio DuckDNS a su IP.
2. Instalar Docker (`curl -fsSL https://get.docker.com | sh`).
3. Subir `deploy/` y `database_schema_postgres.sql` a `/opt/researchflow/`.
4. Copiar `deploy/.env.example` a `.env` y completar `DOMAIN`, `POSTGRES_PASSWORD`, `N8N_ENCRYPTION_KEY`, `EVOLUTION_API_KEY`.
5. `docker compose up -d` y verificar con `docker compose ps`.
6. Cargar el esquema: `docker compose exec -T postgres psql -U postgres -d researchflow < /opt/researchflow/database_schema_postgres.sql`.
7. Configurar n8n (cuenta, credenciales nativas, importar los 4 workflows, activar). La config sensible ya viene del `.env`.
8. Conectar WhatsApp en Evolution Manager (instancia `researchflow`, QR, webhook).
9. Publicar la landing en Vercel con el dominio en `vercel.json`.
10. Verificacion end-to-end (seccion 8 de la guia de deploy y `plan_pruebas.md`).

## 4. Base de datos (8 tablas)

Esquema en `database_schema_postgres.sql`, base `researchflow`:

| Tabla | Contenido | Campos clave |
| --- | --- | --- |
| `research_requests` | Solicitud principal de investigacion | `id`, `tema`, `pregunta`, `estado` (nuevo/en_proceso/completado/error), `resumen`, `informe_markdown`, `puntaje_calidad`, `nivel_confianza`, `veredicto`, `error_detalle` |
| `research_sources` | Fuentes consultadas por investigacion | `request_id`, `titulo`, `url`, `tipo`, `calidad`, `confianza` |
| `research_evidence` | Afirmaciones clasificadas | `request_id`, `tipo` (hecho/hipotesis/opinion), `afirmacion`, `soporte` (con_fuente/requiere_verificacion), `confianza` |
| `research_verifications` | Auditoria adversarial (Fase 4) por investigacion | `request_id`, `puntaje_calidad` (0-100), `nivel_confianza`, `veredicto`, `senales_alerta`, `contradicciones`, `limitaciones`, `hechos_auditados` |
| `research_artifacts` | Entregables generados (articulo) | `request_id`, `tipo`, `titulo`, `contenido`, `estado` |
| `research_ideas` | Backlog de ideas (WhatsApp o web) | `idea_original`, `tema_refinado`, `preguntas_sugeridas`, `estado` (idea/refinada/en_cola/investigada/descartada), `request_id` |
| `research_datasets` | Datos numericos con fuente por punto | `request_id`, `datos_json`, `fuente_principal`, `tipo_grafico`, `quickchart_url` |
| `app_settings` | Configuracion editable sin tocar workflows | `key`, `value`, `descripcion` |

Cada punto de `datos_json` sigue el formato:
`[{"etiqueta":..., "valor":..., "unidad":..., "periodo":..., "fuente_url":...}]`

## 5. Playbook editable en app_settings

La metodologia de investigacion NO esta cableada en los workflows: el nodo "Postgres - Cargar playbook" lee el registro `playbook_investigacion` de `app_settings` y lo inyecta en los prompts de las cuatro fases Gemini (base, profundizacion, sintesis y verificacion adversarial). Para cambiar el estilo de investigacion basta un UPDATE, sin tocar ni reimportar workflows:

```sql
UPDATE app_settings
SET value = 'NUEVA METODOLOGIA...aqui el texto completo del playbook...',
    updated_at = NOW()
WHERE key = 'playbook_investigacion';
```

Notas:

- La version larga y comentada de la metodologia esta en `playbook_investigacion.md`; el valor en la tabla es la version condensada que consume la IA.
- Si el registro no existe o la lectura falla, los prompts usan un playbook minimo embebido en el workflow (fallback): el sistema no se cae.
- El cambio aplica desde la siguiente ejecucion; no requiere reiniciar nada.

## 6. Mapa de placeholders y credenciales

### 6.1 Configuracion via variables de entorno (`.env`)

Estos valores se completan **una sola vez** en `deploy/.env` y n8n los inyecta a los
workflows como `{{ $env.* }}`. No hay que editar los nodos tras importar.

| Variable (`.env`) | Se usa en | Valor a poner |
| --- | --- | --- |
| `GEMINI_API_KEY` | Nodos HTTP "Gemini - ..." (investigacion x4, digest x1) | API key de AI Studio |
| `EVOLUTION_API_KEY` | Nodos HTTP "Evolution ..." (investigacion, WhatsApp x4, digest) y servicio Evolution | Clave global de Evolution API |
| `GOOGLE_SHEET_ID` | Nodo "Google Sheets - Registrar datos" | ID del spreadsheet (de su URL); debe tener una hoja `datasets` |
| `OWNER_NAME` | Nodo "Preparar lanzamiento" (workflow WhatsApp) | Nombre del propietario |
| `OWNER_EMAIL` | Nodo "Preparar lanzamiento" (WhatsApp) y "Gmail - Enviar digest" (digest) | Correo del propietario |
| `OWNER_WHATSAPP` | Nodo "Evolution - Aviso digest" (digest) | Numero WhatsApp del propietario con codigo de pais (sin +) |
| `RESEARCH_WEBHOOK_URL` | Nodo "Lanzar investigacion" (WhatsApp) | Se deriva sola de `DOMAIN`: `https://n8n.DOMAIN/webhook/researchflow` |

Requisito: n8n debe correr con `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (ya viene asi en el
`docker-compose.yml`) para que los nodos puedan leer `$env`.

Unico placeholder manual restante (fuera de n8n):

| Placeholder | Donde esta | Valor a poner |
| --- | --- | --- |
| `REPLACE_WITH_GEMINI_API_KEY` | Nodos HTTP "Gemini - ..." (investigacion x5: base, profundizar, sintesis, verificacion, preguntas; digest x1) | API key de AI Studio |
| `REPLACE_WITH_EVOLUTION_API_KEY` | Nodos HTTP "Evolution ..." (investigacion, WhatsApp x4, digest) | `EVOLUTION_API_KEY` del `.env` del droplet |
| `REPLACE_WITH_GOOGLE_SHEET_ID` | Nodo "Google Sheets - Registrar datos" | ID del spreadsheet (de su URL); debe tener una hoja `datasets` |
| `REPLACE_WITH_OWNER_NAME` | Nodo "Preparar lanzamiento" (workflow WhatsApp) | Nombre del propietario |
| `REPLACE_WITH_OWNER_EMAIL` | Nodo "Preparar lanzamiento" (WhatsApp) y "Gmail - Enviar digest" (digest) | Correo del propietario |
| `REPLACE_WITH_OWNER_WHATSAPP` | Nodo "Evolution - Aviso digest" (digest) | Numero WhatsApp del propietario con codigo de pais |
| `REPLACE_WITH_N8N_DOMAIN` | `landing_page/vercel.json` (rewrites `/api/investigar` y `/api/demo`) | `n8n.TU-DOMINIO` |

> Auto-llamado del flujo de ideas: el nodo "HTTP - Lanzar investigacion" (workflow WhatsApp) ya NO usa `localhost` cableado. Toma la base del webhook de la variable de entorno `RF_WEBHOOK_BASE` (definida en `docker-compose.yml`, por defecto `http://localhost:5678` que sirve para la auto-llamada dentro del mismo contenedor). En produccion detras de Caddy puedes fijar `RF_WEBHOOK_BASE=https://n8n.TU-DOMINIO` en el `.env` sin editar el workflow. Requiere `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (ya incluido en el compose).

### 6.2 Credenciales de n8n (menu Credentials)

| Credencial n8n | Nodos que la usan | Datos |
| --- | --- | --- |
| Postgres | Todos los nodos "Postgres - ..." | host `postgres`, puerto 5432, base `researchflow`, usuario `postgres`, password del `.env` |
| Gmail OAuth2 | "Gmail - Enviar articulo/preguntas/digest" | Cliente OAuth del proyecto Google Cloud; agregar la redirect URI que muestra n8n |
| Google Sheets OAuth2 | "Google Sheets - Registrar datos" | Mismo proyecto Google Cloud |
| Google Gemini (PaLM) API | "Google Gemini Chat Model" (AI Agent del flujo WhatsApp) | La misma API key de AI Studio |

Los nodos HTTP de Gemini y Evolution leen la key desde variables de entorno (`{{ $env.GEMINI_API_KEY }}`, `{{ $env.EVOLUTION_API_KEY }}`), asi que no quedan claves dentro de los JSON versionados. Opcionalmente se puede migrar a credenciales Header Auth de n8n.

## 7. Mantenimiento

### 7.1 Logs

```bash
cd /opt/researchflow/deploy
docker compose ps                      # estado de los 5 servicios
docker compose logs -f n8n             # logs de n8n en vivo
docker compose logs -f evolution       # logs de Evolution API
docker compose logs --tail=100 caddy   # certificados / proxy
```

En n8n, el menu Executions muestra cada ejecucion con el detalle por nodo (util para depurar prompts y respuestas de Gemini).

### 7.2 Backups

```bash
# Backup de la base de la aplicacion
docker compose exec -T postgres pg_dump -U postgres researchflow > backup_researchflow_$(date +%F).sql

# Backup de la base interna de n8n (workflows y credenciales cifradas)
docker compose exec -T postgres pg_dump -U postgres n8n > backup_n8n_$(date +%F).sql
```

Descargar los .sql a la PC con `scp`. Ademas, tomar **snapshot del droplet** desde el panel de DigitalOcean antes de cambios grandes y antes de que venzan los creditos (~$0.06/GB/mes; permite destruir el droplet y restaurarlo despues).

### 7.3 Rotacion de claves

- **Gemini**: generar nueva key en AI Studio, reemplazarla en los nodos HTTP Gemini (y en la credencial Google Gemini del AI Agent), borrar la vieja.
- **Evolution**: cambiar `EVOLUTION_API_KEY` en el `.env`, `docker compose up -d evolution`, actualizar los nodos Evolution en n8n.
- **Gmail/Sheets OAuth**: si el refresh token expira, reconectar la credencial desde n8n.
- **N8N_ENCRYPTION_KEY**: NO rotarla a la ligera; si se pierde o cambia, se pierden las credenciales guardadas en n8n. Guardarla en un gestor de contrasenas.
- Configurar alerta de presupuesto en Google Cloud (ej. $5 y $20) para vigilar el gasto de Gemini.

## 8. Solucion de problemas comunes

| Sintoma | Causa probable | Solucion |
| --- | --- | --- |
| Webhook devuelve 404 | Workflow inactivo, o se usa la URL de test sin "Listen" activo | Activar el toggle del workflow y usar la Production URL (`/webhook/...`, no `/webhook-test/...`) |
| Gemini responde 400/401 | Body o modelo invalido, o `GEMINI_API_KEY` vacia/incorrecta | Revisar el nodo en Executions; verificar `GEMINI_API_KEY` en `.env` y que n8n se relanzo con `docker compose up -d` |
| Gemini responde 403/429 | API key invalida, facturacion no habilitada o cuota | Verificar la key en AI Studio y el estado de la cuenta de facturacion Pagado 1 |
| Evolution no envia mensajes | Instancia desconectada de WhatsApp | Abrir `https://evo.DOMINIO/manager`, re-escanear el QR con el telefono |
| WhatsApp no dispara el workflow | Webhook de la instancia mal configurado | En Evolution Manager apuntar a `https://n8n.DOMINIO/webhook/researchflow-whatsapp` con evento `MESSAGES_UPSERT` |
| Correo no llega | Credencial Gmail expirada, o filtrado a spam | Reconectar la credencial Gmail OAuth2 en n8n; revisar spam del destinatario |
| Landing da error de red | Dominio mal puesto en `vercel.json` o droplet caido | Verificar rewrite y `docker compose ps` |
| Sheets falla | ID de documento incorrecto, falta hoja `datasets`, o permisos | Revisar `GOOGLE_SHEET_ID` en `.env` y que la cuenta OAuth tenga acceso al spreadsheet |
| Articulo sin playbook personalizado | Registro `playbook_investigacion` ausente en `app_settings` | Reinsertar el registro (esta en `database_schema_postgres.sql`); mientras tanto opera el fallback embebido |
| HTTPS no levanta | DNS aun no propaga o puertos 80/443 cerrados | Esperar propagacion DuckDNS; revisar firewall del droplet |

## 9. Costos de referencia

Ver la tabla completa en `deploy/deploy_digitalocean.md`. Resumen: droplet $0 efectivo este mes con creditos (luego ~$24/mes en 4 GB), Gemini Flash < $1/mes de uso personal, el resto del stack (QuickChart, DuckDNS, Vercel, Evolution, APIs de Google) $0.
