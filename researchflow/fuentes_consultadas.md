# Fuentes consultadas (arquitectura v2)

Documentacion oficial usada para disenar e implementar el proyecto, con el uso que se le dio.

## n8n

- Webhook node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/ -- triggers de la landing (`/webhook/researchflow`) y de Evolution API (`/webhook/researchflow-whatsapp`).
- Respond to Webhook node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/ -- respuesta inmediata "en_proceso" a la landing mientras la investigacion sigue corriendo.
- HTTP Request node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/ -- llamadas a Gemini (generateContent), Evolution API (sendText) y lanzamiento interno de investigaciones desde el flujo de WhatsApp.
- Code node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/ -- preparacion de prompts por fase, parseo del JSON de sintesis, construccion de URLs QuickChart, articulo HTML y filas para Sheets.
- IF node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.if/ -- bifurcacion con/sin pregunta y enrutado de comandos de WhatsApp.
- Postgres node: https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.postgres/ -- registro de solicitudes (RETURNING id), carga del playbook desde `app_settings`, evidencia, ideas y datasets.
- Gmail node: https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.gmail/ -- envio del articulo HTML con graficos, preguntas propuestas y digest semanal.
- Google Sheets node: https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googlesheets/ -- registro de datasets (una fila por punto de dato) en la hoja `datasets`.
- Schedule Trigger node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/ -- digest semanal (lunes 8am).
- AI Agent node: https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/ -- refinado conversacional de ideas en el flujo de WhatsApp.
- Google Gemini Chat Model: https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatgooglegemini/ -- modelo del AI Agent.
- Simple Memory node: https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.memorybufferwindow/ -- memoria de conversacion por numero de telefono.
- Google OAuth2 credentials: https://docs.n8n.io/integrations/builtin/credentials/google/oauth-single-service/ -- credenciales de Gmail y Google Sheets.
- Docker Compose installation: https://docs.n8n.io/hosting/installation/server-setups/docker-compose/ -- referencia para el self-hosting de n8n en el droplet.

## Gemini API (Google AI)

- Documentacion general: https://ai.google.dev/gemini-api/docs -- llamadas generateContent con Gemini 2.5 Flash en las 4 fases de investigacion (base, profundizacion, sintesis y verificacion adversarial), generacion de preguntas y digest.
- Grounding with Google Search: https://ai.google.dev/gemini-api/docs/google-search -- busqueda web real y citable en las fases base y profundizacion.
- Structured output (JSON): https://ai.google.dev/gemini-api/docs/structured-output -- fase de sintesis con `responseMimeType: application/json` (JSON estricto sin busqueda).
- Pricing: https://ai.google.dev/gemini-api/docs/pricing -- estimacion de costo por investigacion (centavos con Flash) y franja gratuita de grounding del tier pagado.

## Graficos y WhatsApp

- QuickChart: https://quickchart.io/documentation/ -- graficos PNG por URL (barras, pastel, lineas) generados solo con cifras que tienen fuente; sin API key.
- Evolution API: https://doc.evolution-api.com/ -- instancia de WhatsApp `researchflow`: webhook `messages.upsert`, endpoint `sendText`, manager y API key.

## Infraestructura y despliegue

- Docker Compose: https://docs.docker.com/compose/ -- stack del droplet (Caddy, n8n, Postgres 16, Redis, Evolution API v2.2) en `deploy/docker-compose.yml`.
- Docker Engine (instalacion): https://docs.docker.com/engine/install/ -- script `get.docker.com` usado en el droplet Ubuntu 24.04.
- DigitalOcean Droplets: https://docs.digitalocean.com/products/droplets/ -- creacion y dimensionamiento del droplet (8 GB con creditos, 4 GB post-creditos) y snapshots.
- Caddy (Automatic HTTPS): https://caddyserver.com/docs/automatic-https -- reverse proxy con certificados Let's Encrypt automaticos para `n8n.` y `evo.` en `deploy/Caddyfile`.
- DuckDNS: https://www.duckdns.org/spec.jsp -- subdominio gratuito apuntando a la IP del droplet (resuelve tambien sub-subdominios).
- Vercel Rewrites: https://vercel.com/docs/rewrites -- proxy `/api/investigar` hacia el webhook de n8n en `landing_page/vercel.json` (evita CORS).
- PostgreSQL 16: https://www.postgresql.org/docs/16/ -- esquema de `database_schema_postgres.sql` (SERIAL, TIMESTAMPTZ, ON CONFLICT, dollar-quoting del playbook).

## APIs de Google Workspace

- Gmail API: https://developers.google.com/gmail/api -- envio de correos HTML via el nodo Gmail con OAuth2.
- Google Sheets API: https://developers.google.com/sheets/api -- append de filas via el nodo Google Sheets con OAuth2.
- OAuth 2.0 de Google: https://developers.google.com/identity/protocols/oauth2 -- proyecto de Google Cloud con redirect URI de n8n para ambas credenciales.

## Material local del curso

- `resumen_clases.md`
- `guia_curso_n8n.md`
- `n8n_evaluacion.pdf`
- `transcripts/`
- `visual_evidence/`
