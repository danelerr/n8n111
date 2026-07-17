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
| `docs/DOCUMENTACION.md` | Uso, arquitectura, configuracion, operacion, metodologia y pruebas |
| `docs/CAMBIOS_v3.md` | Diseño y estado del candidato de verificacion adversarial V3 |
| `deploy/` | Docker Compose, Caddy, entorno, esquema de base de datos y acceso al servidor |
| `chat/` | Interfaz responsive, build frontend con `slot-text` y `simulador_whatsapp.py` |
| `landing_page/` | Interfaz web publicada en Vercel |
| `workflows/` | Cuatro workflows estables de n8n; investigacion profunda ya usa V3 |
| `deploy/database_schema_postgres.sql` | Tablas y playbook activo |
| `test_data/` | Payloads de prueba |
| `output/pdf/informe_researchflow.pdf` | Informe final canonico |

## Punto de partida

1. Leer `docs/DOCUMENTACION.md`.
2. Consultar `deploy/SERVER_ACCESS.md` para operar produccion.
3. Consultar `docs/CAMBIOS_v3.md` para el estado de produccion y las rotaciones pendientes
   de Gemini y Evolution.

Los secretos permanecen exclusivamente en `deploy/.env` y en las credenciales cifradas de n8n.
