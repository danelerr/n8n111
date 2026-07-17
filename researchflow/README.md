# ResearchFlow

Asistente de investigacion automatizado con n8n, Gemini, PostgreSQL, Gmail, Google Sheets, QuickChart y Evolution API.

## Produccion

- n8n: `https://n8n.camba.tech`
- Chat: `https://chat.camba.tech`
- Evolution: `https://evo.camba.tech`
- Acceso al droplet: `deploy/SERVER_ACCESS.md`

## Que hace

- Convierte un tema sin pregunta en preguntas investigables.
- Convierte una pregunta concreta en un articulo con fuentes y graficos respaldados.
- Captura y refina ideas por WhatsApp o por el simulador.
- Mantiene un backlog y envia un digest semanal.
- Registra solicitudes, fuentes, evidencia, datasets y articulos en PostgreSQL.

Regla central: ninguna cifra se grafica sin fuente y ninguna afirmacion dudosa se presenta como hecho verificado.

## Estructura

| Recurso | Contenido |
| --- | --- |
| `DOCUMENTACION.md` | Uso, arquitectura, configuracion, operacion, metodologia y pruebas |
| `CAMBIOS_v3.md` | Diseño y estado del candidato de verificacion adversarial V3 |
| `deploy/` | Docker Compose, Caddy, entorno y acceso al servidor |
| `chat/` | Interfaz responsive y build frontend con `slot-text` |
| `landing_page/` | Interfaz web publicada en Vercel |
| `n8n_workflow_*.json` | Cuatro workflows estables; investigacion profunda ya usa V3 |
| `database_schema_postgres.sql` | Tablas y playbook activo |
| `simulador_whatsapp.py` | Chat web conectado al flujo conversacional |
| `test_data/` | Payloads de prueba |
| `output/pdf/informe_researchflow.pdf` | Informe final canonico |

## Punto de partida

1. Leer `DOCUMENTACION.md`.
2. Consultar `deploy/SERVER_ACCESS.md` para operar produccion.
3. Consultar `CAMBIOS_v3.md` para el estado de produccion y las rotaciones pendientes
   de Gemini y Evolution.

Los secretos permanecen exclusivamente en `deploy/.env` y en las credenciales cifradas de n8n.
