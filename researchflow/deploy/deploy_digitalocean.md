# Despliegue de ResearchFlow en DigitalOcean

Guia paso a paso para levantar el stack completo (n8n + Postgres + Redis + Evolution API + Caddy con HTTPS) en un droplet, aprovechando los creditos de DigitalOcean.

## 0. Requisitos previos

- Cuenta DigitalOcean con creditos.
- Subdominio DuckDNS gratis (https://www.duckdns.org) o dominio propio.
- API key de Gemini (https://aistudio.google.com > Get API key).
- Proyecto de Google Cloud con OAuth para Gmail y Sheets (visto en clases 3-5).
- Numero de WhatsApp secundario para Evolution API.

## 1. Crear el droplet

1. DigitalOcean > Create > Droplet.
2. Region: la mas cercana (NYC o SFO van bien desde Bolivia).
3. Imagen: **Ubuntu 24.04 LTS**.
4. Tamano recomendado con creditos: **8 GB RAM / 4 vCPU Premium** (~$48/mes).
   Minimo funcional: 4 GB RAM (~$24/mes).
5. Autenticacion: SSH key (recomendado) o password.
6. Hostname: `researchflow-prod`. Crear.
7. Anotar la IP publica.

Opcional recomendado: crear un segundo droplet de 2 GB como **staging** para probar
cambios sin tocar produccion (mismos pasos, dominio distinto).

## 2. Apuntar el dominio

Con DuckDNS:
1. Crear el subdominio, ej. `researchflow.duckdns.org`, apuntando a la IP del droplet.
2. DuckDNS resuelve tambien los sub-subdominios (`n8n.researchflow.duckdns.org`,
   `evo.researchflow.duckdns.org`) hacia la misma IP: es lo que usa el Caddyfile.

Con dominio propio: crear registros A para `n8n.midominio.com` y `evo.midominio.com`.

## 3. Instalar Docker en el droplet

```bash
ssh root@IP_DEL_DROPLET
curl -fsSL https://get.docker.com | sh
```

## 4. Subir el stack

Desde tu PC (PowerShell, en la carpeta researchflow):

```powershell
scp -r deploy database_schema_postgres.sql root@IP_DEL_DROPLET:/opt/researchflow/
```

En el droplet:

```bash
cd /opt/researchflow/deploy
cp .env.example .env
nano .env        # completar DOMAIN, POSTGRES_PASSWORD, N8N_ENCRYPTION_KEY, EVOLUTION_API_KEY
                 # generar clave: openssl rand -hex 24
chmod +x init-databases.sh
docker compose up -d
docker compose ps    # todo debe quedar en running/healthy
```

Cargar el esquema de la aplicacion:

```bash
docker compose exec -T postgres psql -U postgres -d researchflow < /opt/researchflow/database_schema_postgres.sql
```

## 5. Configurar n8n

1. Abrir `https://n8n.TU-DOMINIO` y crear la cuenta de propietario.
2. Importar los 4 workflows (menu Workflows > Import from File):
   - `n8n_workflow_research_production.json`
   - `n8n_workflow_ideas_whatsapp.json`
   - `n8n_workflow_weekly_digest.json`
   - `n8n_workflow_demo_import.json` (opcional en produccion)
3. Crear credenciales y asignarlas a los nodos:
   - **Postgres**: host `postgres`, puerto 5432, base `researchflow`, usuario `postgres`, password del `.env`.
   - **Gmail OAuth2**: credenciales del proyecto Google Cloud (redirect URI que indica n8n).
   - **Google Sheets OAuth2**: mismo proyecto; crear un spreadsheet con una hoja llamada `datasets` y reemplazar `REPLACE_WITH_GOOGLE_SHEET_ID` en el nodo.
   - **Gemini**: en los nodos HTTP "Gemini - ...", reemplazar `REPLACE_WITH_GEMINI_API_KEY` (o crear una credencial Header Auth y usarla).
   - **Google Gemini (PaLM) API** para el AI Agent del flujo WhatsApp: misma API key.
   - **Evolution**: en los nodos "Evolution ...", reemplazar `REPLACE_WITH_EVOLUTION_API_KEY` con el valor del `.env`.
   - Reemplazar `REPLACE_WITH_OWNER_NAME`, `REPLACE_WITH_OWNER_EMAIL` y `REPLACE_WITH_OWNER_WHATSAPP` en los nodos indicados.
4. Activar los workflows (toggle Active).

## 6. Conectar WhatsApp (Evolution API)

1. Abrir `https://evo.TU-DOMINIO/manager` e ingresar con la `EVOLUTION_API_KEY`.
2. Crear instancia `researchflow` y escanear el QR con el WhatsApp secundario.
3. En la instancia > Webhooks: activar y apuntar a
   `https://n8n.TU-DOMINIO/webhook/researchflow-whatsapp` con el evento `MESSAGES_UPSERT`.
4. Probar: enviar "hola, tengo una idea sobre X" al numero conectado.

## 7. Publicar la landing en Vercel

1. En `landing_page/vercel.json` reemplazar `REPLACE_WITH_N8N_DOMAIN` por `n8n.TU-DOMINIO`.
2. Con Vercel CLI: `cd landing_page && npx vercel --prod` (o importar la carpeta desde vercel.com).
3. La landing usa el proxy `/api/investigar`, sin problemas de CORS.

## 8. Verificacion end-to-end

1. Landing sin pregunta -> deben aparecer preguntas propuestas en pantalla y llegar por Gmail.
2. Landing con pregunta -> respuesta "en proceso" inmediata; en minutos llega el articulo con graficos a Gmail y aviso a WhatsApp; revisar filas en Google Sheets y tablas `research_*` en Postgres.
3. WhatsApp: mandar una idea vaga -> respuesta del agente + registro en `research_ideas`; "ideas" -> lista; "investigar N" -> lanza investigacion.

## 9. Antes de que venzan los creditos

```bash
# Snapshot del droplet desde el panel de DigitalOcean (o doctl)
# Costo: ~$0.06/GB/mes. Permite destruir el droplet y restaurarlo despues.
```

Decision al vencer creditos: mantener el droplet pagando (~$24/mes en 4 GB),
reducir tamano, o destruir y conservar el snapshot.

## Costos de referencia (para el analisis economico del informe)

| Item | Costo/mes |
| --- | --- |
| Droplet 8 GB (con creditos este mes) | $48 -> $0 efectivo |
| Droplet 4 GB (regimen post-creditos) | $24 |
| Gemini API (Flash, uso personal) | < $1 |
| QuickChart, Wikipedia, DuckDNS, Vercel free | $0 |
| Google Workspace APIs (Gmail/Sheets) | $0 |
| Evolution API (open source) | $0 |
