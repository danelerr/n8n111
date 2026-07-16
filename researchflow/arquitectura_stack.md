# Arquitectura y stack de ResearchFlow

Fecha de decision: julio 2026. Este documento consolida el panorama de recursos disponibles y las decisiones de stack tomadas para el proyecto.

## 1. Inventario de recursos disponibles

| Recurso | Detalle | Rol en el proyecto |
| --- | --- | --- |
| DigitalOcean | $150 en creditos, **vencen julio 2026** | Droplet(s) para n8n + Evolution API. Levantar dentro del mes del credito |
| Gemini API | Cuenta de facturacion **Pagado 1** (limite $250) en AI Studio | Motor de IA: investigacion con Google Search grounding, generacion de preguntas, redaccion, extraccion de datos |
| Google AI Pro | Suscripcion consumer (app Gemini, NotebookLM) | Uso personal: preparar defensa con NotebookLM. NO alimenta la API |
| Google Cloud | Proyecto con OAuth habilitado | Credenciales para Google Sheets y Gmail |
| Vercel | Free tier | Hosting de la landing page (decision final; reemplaza GitHub Pages) |
| Firebase | Free tier | Sin uso por ahora (reserva) |
| QuickChart / Wikipedia API / Our World in Data | Gratis, sin API key | Graficos PNG / base de temas / estadisticas primarias |

## 2. Implicaciones del tier Pagado 1 de Gemini

- Rate limits mucho mas altos que el free tier: el flujo de investigacion iterativa no se atasca.
- El uso ES facturable. Mitigaciones obligatorias:
  1. Configurar **alerta de presupuesto** en la cuenta de facturacion de Google Cloud (ej. aviso a $5 y a $20).
  2. Verificar que medio de pago respalda la cuenta de facturacion (aparece asociada al plan de estudiante).
  3. Usar **Gemini Flash por defecto** en todos los nodos; reservar Pro solo para la sintesis final si hace falta. Una investigacion completa con Flash cuesta centavos.
- Google Search grounding: el tier pagado incluye una franja diaria gratuita amplia de consultas con grounding; suficiente para este proyecto.

## 3. Stack por capa

```text
Entrada
  Landing page (Vercel) --------POST-------> Webhook n8n
  WhatsApp (Evolution API) ---webhook------> Webhook n8n (flujo de ideas)

Orquestacion
  n8n self-hosted en droplet DigitalOcean (Docker)

Inteligencia
  Gemini API (Flash) + Google Search grounding (4 fases: base, profundizacion, sintesis JSON
  y verificacion adversarial que audita hechos/cifras y asigna un puntaje de confianza 0-100)
  El playbook dirige el grounding hacia fuentes prioritarias (Wikipedia como punto
  de partida, Our World in Data para estadisticas, medios de investigacion original)
  Metodologia: playbook_investigacion.md, inyectada desde app_settings (guia adaptable)

Datos
  Postgres (droplet) o Supabase - tablas research_*
  Google Sheets - datasets por investigacion

Salida
  QuickChart - graficos PNG (barras, pastel, lineas) con datos reales
  Gmail - articulo HTML + graficos incrustados
  WhatsApp - avisos cortos y captura de ideas
```

## 4. Nota de integracion Vercel -> n8n

La landing en Vercel hace POST directo al webhook de n8n. El nodo Webhook de n8n
debe configurar **Allowed Origins (CORS)** con el dominio de Vercel
(ej. `https://researchflow.vercel.app`). Alternativa: rewrite en `vercel.json`
para proxyear `/api/investigar` hacia el webhook y evitar CORS por completo.

## 5. Estado de decisiones

- **Resuelto**: la DB principal vive en el Postgres del droplet (base `researchflow`), compartiendo servidor con las bases `n8n` y `evolution`. Ver `deploy/docker-compose.yml`. Supabase queda como alternativa documentada.
- **Resuelto**: stack de despliegue completo en `deploy/` (Caddy + n8n + Postgres 16 + Redis + Evolution API v2.2) con guia paso a paso en `deploy/deploy_digitalocean.md`.
- **Pendiente del usuario**: crear el droplet (recomendado 8 GB con creditos; minimo 4 GB) y el subdominio DuckDNS. Los creditos vencen este mes: levantar cuanto antes.
- **Pendiente del usuario**: credenciales reales en n8n (Postgres, Gmail, Sheets, Gemini, Evolution) y reemplazo de placeholders `REPLACE_WITH_*`.
