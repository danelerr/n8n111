# ResearchFlow n8n

Asistente de investigacion automatizado. Proyecto final del curso **Automatizacion de Negocios con n8n** (formato oficial: `curso_n8n/n8n_evaluacion.pdf`).

## Que hace

Le das un tema ("adopcion de cripto en Bolivia") o una pregunta concreta:

- **Sin pregunta**: genera 3-5 preguntas investigables e interesantes, las guarda en tu backlog y te las envia por correo.
- **Con pregunta**: ejecuta una investigacion profunda en internet en 3 fases (base del tema, profundizacion con 5 porques y datos, sintesis), guiada por tu metodologia personal (playbook editable en la base de datos). Entrega un **articulo con hechos citados, graficos estadisticos reales (QuickChart) y fuentes evaluadas** por Gmail, aviso por WhatsApp, datos a Google Sheets y trazabilidad completa en Postgres.
- **Por WhatsApp**: le mandas ideas vagas cuando se te ocurren; un agente con memoria las refina contigo, las guarda en el backlog, y con "investigar N" lanzas la investigacion completa.
- **Digest semanal**: cada lunes resume tu backlog y recomienda que investigar.

Reglas de calidad innegociables: nunca inventa cifras ni fuentes; todo hecho cita fuente o queda marcado como requiere verificacion; **sin cifras confiables no hay grafico**.

## Los 4 workflows

| Archivo | Trigger | Funcion |
| --- | --- | --- |
| `n8n_workflow_research_production.json` | Webhook `/webhook/researchflow` | Investigacion profunda + generador de preguntas |
| `n8n_workflow_ideas_whatsapp.json` | Webhook Evolution API | Captura y refinamiento de ideas, comandos `ideas` / `investigar N` |
| `n8n_workflow_weekly_digest.json` | Schedule (lunes 8am) | Digest del backlog por Gmail y WhatsApp |
| `n8n_workflow_demo_import.json` | Webhook `/webhook/researchflow-demo` | Demo sin credenciales (grafico QuickChart real) |

## Flujo principal

```text
Landing (Vercel) / WhatsApp (Evolution)
  -> Webhook n8n -> Normalizar -> Postgres (registro) -> Playbook (app_settings)
  -> Sin pregunta: Gemini genera preguntas -> backlog + Gmail + respuesta en pantalla
  -> Con pregunta: respuesta inmediata "en proceso"
       -> Gemini fase base (Google Search grounding)
       -> Gemini profundizacion (grounding: 5 porques + datos con fuente)
       -> Gemini sintesis (JSON estricto)
       -> QuickChart (graficos) + Postgres (evidencia/datasets/articulo)
       -> Gmail (articulo HTML con graficos) + WhatsApp (aviso)
       -> Google Sheets (datasets, fila por dato)
```

## Stack

- **n8n** self-hosted en droplet DigitalOcean (Docker) - `deploy/`
- **Gemini 2.5 Flash** con Google Search grounding (API key de AI Studio)
- **Postgres 16** (7 tablas, ver `database_schema_postgres.sql`)
- **QuickChart** (graficos PNG gratis, sin API key)
- **Gmail + Google Sheets** (OAuth Google Cloud)
- **Evolution API v2** (WhatsApp) + **Redis**
- **Caddy** (HTTPS automatico) + **DuckDNS**
- **Landing en Vercel** (`landing_page/`, proxy `/api/investigar` sin CORS)

## Por donde empezar

1. `INDICE_ENTREGA.md` - que entregar y en que orden.
2. `deploy/deploy_digitalocean.md` - levantar el stack completo en el droplet.
3. `manual_tecnico.md` - credenciales, placeholders `REPLACE_WITH_*` y mantenimiento.
4. `manual_usuario.md` - como se usa (landing, WhatsApp, digest).
5. `plan_pruebas.md` - pruebas unitarias e integrales.
6. `informe_final.md` - informe oficial de 19 secciones (PDF en `output/pdf/`).

## Configuracion minima (resumen)

La configuracion sensible se centraliza en `deploy/.env`: `GEMINI_API_KEY`, `EVOLUTION_API_KEY`, `GOOGLE_SHEET_ID`, `OWNER_NAME/EMAIL/WHATSAPP`. Los workflows la leen via `{{ $env.* }}`, asi que **no hay que editar placeholders nodo por nodo**. Solo quedan por crear en n8n las credenciales nativas (que n8n guarda cifradas): Postgres, Gmail OAuth2, Google Sheets OAuth2 y Google Gemini (para el AI Agent). El unico placeholder manual fuera de n8n es `REPLACE_WITH_N8N_DOMAIN` en `landing_page/vercel.json`. Detalle completo en `manual_tecnico.md` y `deploy/deploy_digitalocean.md`.

## Metodologia de investigacion

El comportamiento del asistente sigue `playbook_investigacion.md` (Wikipedia como punto de partida, vocabulario tecnico, jerarquia de fuentes por incentivos, Our World in Data, 5 porques, hechos/hipotesis/opiniones separados). Se inyecta desde la tabla `app_settings`: **editar el registro cambia el estilo de investigacion sin tocar los workflows**.
