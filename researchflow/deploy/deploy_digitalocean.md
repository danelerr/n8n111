# Despliegue de ResearchFlow en DigitalOcean

Guia paso a paso para levantar el stack completo (n8n + Postgres + Redis + Evolution API + Caddy con HTTPS) en un droplet, aprovechando los creditos de DigitalOcean.

## 0. Requisitos previos

- Cuenta DigitalOcean con creditos.
- Un dominio. Sirve uno gratis (`.tech` del pack de estudiante, o un subdominio DuckDNS).
  Con dominio real solo creas 2 registros A; Caddy emite el HTTPS solo (Let's Encrypt).
  En esta guia el ejemplo es `camba.tech`.
- API key de Gemini (https://aistudio.google.com > Get API key).
- Proyecto de Google Cloud con OAuth para Gmail y Sheets (ver seccion 4b).
- Numero de WhatsApp secundario para Evolution API.

> No necesitas comprar ni instalar ningun certificado SSL/TLS: Caddy lo genera
> automaticamente. La clave SSH solo se usa para entrar al droplet (seccion 1).

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

Con dominio propio (recomendado, ej. `camba.tech`):

1. En el panel DNS del dominio, crear **dos registros A** apuntando a la IP del droplet:

   | Tipo | Host | Valor |
   | --- | --- | --- |
   | A | `n8n` | IP del droplet |
   | A | `evo` | IP del droplet |

2. Esperar la propagacion y verificar (desde tu PC):

   ```bash
   dig +short n8n.camba.tech    # debe devolver la IP del droplet
   dig +short evo.camba.tech    # debe devolver la IP del droplet
   ```

   Hasta que ambos resuelvan, Caddy no podra emitir los certificados HTTPS.

En `.env` se pone `DOMAIN=camba.tech` (sin `n8n.`/`evo.`; Caddy agrega esos prefijos).

Alternativa gratis con DuckDNS: crear `tuproyecto.duckdns.org` apuntando al droplet y
usar `DOMAIN=tuproyecto.duckdns.org`. Verifica primero con `dig` que los sub-subdominios
`n8n.tuproyecto.duckdns.org` y `evo.tuproyecto.duckdns.org` resuelvan; si no, usa un
dominio real.

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
nano .env        # completar TODO: DOMAIN, POSTGRES_PASSWORD, N8N_ENCRYPTION_KEY,
                 # EVOLUTION_API_KEY, GEMINI_API_KEY, GOOGLE_SHEET_ID,
                 # OWNER_NAME, OWNER_EMAIL, OWNER_WHATSAPP
                 # generar clave: openssl rand -hex 24
chmod +x init-databases.sh
docker compose up -d
docker compose ps    # todo debe quedar en running/healthy
```

> Los workflows leen estos valores desde las variables de entorno del contenedor
> n8n (`{{ $env.GEMINI_API_KEY }}`, `{{ $env.OWNER_EMAIL }}`, etc.). Ya **no** hay
> que reemplazar placeholders `REPLACE_WITH_*` nodo por nodo: basta con completar el
> `.env`. Si editas el `.env` despues, aplica los cambios con `docker compose up -d`.

Cargar el esquema de la aplicacion:

```bash
docker compose exec -T postgres psql -U postgres -d researchflow < /opt/researchflow/database_schema_postgres.sql
```

## 4b. Configurar Google OAuth (Gmail + Sheets)

Este es el paso mas laborioso. Sin el, no funcionan el envio por correo ni el registro
en Sheets. Se hace una sola vez en https://console.cloud.google.com.

1. **Crear/elegir un proyecto** (menu superior > selector de proyecto > New Project).
2. **Habilitar las APIs**: menu > APIs & Services > Library. Buscar y habilitar:
   - **Gmail API**
   - **Google Sheets API**
   - (opcional pero comun) **Google Drive API**
3. **Pantalla de consentimiento** (APIs & Services > OAuth consent screen):
   - User Type: **External**. Completar nombre de app, correo de soporte y de contacto.
   - En **Test users**, agregar tu propio correo (el mismo que usaras en Gmail/Sheets).
     Mientras la app este en modo "Testing", solo los test users pueden autorizar; no
     hace falta publicar ni pasar verificacion de Google.
4. **Crear las credenciales OAuth** (APIs & Services > Credentials > Create Credentials
   > OAuth client ID):
   - Application type: **Web application**.
   - En **Authorized redirect URIs**, pegar la URI que te muestra n8n al crear la
     credencial (formato `https://n8n.camba.tech/rest/oauth2-credential/callback`).
     La misma URI sirve para Gmail y para Sheets.
   - Guardar y copiar **Client ID** y **Client Secret**.
5. Esos Client ID/Secret se pegan en las credenciales de n8n (seccion 5). Al darle
   "Sign in with Google" en n8n, autoriza con tu cuenta (la que agregaste como test user).

> Requisito para el redirect: el dominio ya debe resolver y tener HTTPS (secciones 2 y 4).
> Por eso este paso va despues de levantar el stack.

## 5. Configurar n8n

1. Abrir `https://n8n.TU-DOMINIO` y crear la cuenta de propietario.
2. Importar los 4 workflows (menu Workflows > Import from File):
   - `n8n_workflow_research_production.json`
   - `n8n_workflow_ideas_whatsapp.json`
   - `n8n_workflow_weekly_digest.json`
   - `n8n_workflow_demo_import.json` (opcional en produccion)
3. Crear credenciales nativas y asignarlas a los nodos (esto no se puede inyectar
   por `.env` porque n8n las guarda cifradas en su propio almacen):
   - **Postgres**: host `postgres`, puerto 5432, base `researchflow`, usuario `postgres`, password del `.env`.
   - **Gmail OAuth2**: pegar el Client ID/Secret de la seccion 4b; darle "Sign in with Google" y autorizar. Copiar la redirect URI que muestra n8n hacia Google Cloud si aun no la agregaste.
   - **Google Sheets OAuth2**: mismo Client ID/Secret. Crear un spreadsheet con una hoja llamada `datasets`; su ID ya se toma de `GOOGLE_SHEET_ID` del `.env` (no hay que tocar el nodo).
   - **Google Gemini (PaLM) API** para el AI Agent del flujo WhatsApp: usar `GEMINI_API_KEY`.

   Las claves de Gemini (nodos HTTP), Evolution, el ID del spreadsheet y los datos del
   propietario (`OWNER_*`) **ya se leen del `.env`** via `{{ $env.* }}`. No hay que
   reemplazar nada en los nodos.
4. Activar los workflows (toggle Active). El flujo de investigacion (`/webhook/researchflow`)
   debe quedar Active antes de usar `investigar N` por WhatsApp, porque el flujo de WhatsApp
   lo llama por su URL publica (`RESEARCH_WEBHOOK_URL`).

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
