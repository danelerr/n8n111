# Anexos y evidencias - ResearchFlow v2

Este documento lista (1) los anexos que componen el paquete de entrega y (2) el checklist de capturas de pantalla que faltan tomar sobre el sistema desplegado. Las capturas se insertan en el informe final y sirven de respaldo en la defensa.

## Parte 1 - Anexos del paquete v2

| Anexo | Archivo(s) | Descripcion |
| --- | --- | --- |
| A1. Workflow investigacion | `n8n_workflow_research_production.json` | Investigacion profunda: webhook, 4 fases Gemini con grounding (base, profundizacion, sintesis y verificacion adversarial con puntaje de confianza), QuickChart, Postgres, Gmail, WhatsApp, Sheets |
| A2. Workflow ideas WhatsApp | `n8n_workflow_ideas_whatsapp.json` | Agente conversacional con memoria + comandos `ideas` / `investigar N` |
| A3. Workflow digest | `n8n_workflow_weekly_digest.json` | Digest semanal del backlog (lunes 8am) |
| A4. Workflow demo | `n8n_workflow_demo_import.json` | Demo sin credenciales para landing y plan B de defensa |
| A5. Esquema de base | `database_schema_postgres.sql` | 8 tablas (incluye `research_verifications`) + playbook inicial en `app_settings` + datos semilla |
| A6. Infraestructura | `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/.env.example`, `deploy/init-databases.sh`, `deploy/deploy_digitalocean.md` | Stack Docker completo y guia de despliegue en DigitalOcean |
| A7. Landing page | `landing_page/index.html`, `styles.css`, `script.js`, `vercel.json` | Formulario, render de resultados y proxy Vercel sin CORS |
| A8. Metodologia | `playbook_investigacion.md` | Version larga del playbook (la condensada vive en `app_settings`) |
| A9. Arquitectura | `arquitectura_stack.md` | Decisiones de stack e inventario de recursos |
| A10. Blueprint | `workflow_blueprint.json` | Diagrama logico del flujo |
| A11. Datos de prueba | `test_data/sample_request.json`, `sample_request_solo_tema.json`, `sample_demo_response.json` | Payloads para el plan de pruebas |
| A12. Documentacion operativa | `manual_usuario.md`, `manual_tecnico.md`, `plan_pruebas.md`, `checklist_defensa.md`, `defensa_guion.md` | Manuales, pruebas y defensa |

## Parte 2 - Checklist de capturas pendientes

Tomar cada captura sobre el sistema real desplegado. Nombrar los archivos como se indica (carpeta sugerida: `output/capturas/`).

### Workflows en n8n

- [ ] `n8n_workflows_lista.png`: vista Workflows con los 4 flujos importados y en Active.
- [ ] `n8n_investigacion_verde.png`: ejecucion completa verde del workflow de investigacion (canvas entero, rama con pregunta).
- [ ] `n8n_preguntas_verde.png`: ejecucion verde de la rama sin pregunta (generacion de preguntas).
- [ ] `n8n_whatsapp_verde.png`: ejecucion verde del workflow de ideas (rama agente y rama `investigar N`).
- [ ] `n8n_digest_verde.png`: ejecucion manual verde del digest semanal.
- [ ] `n8n_demo_verde.png`: ejecucion verde del workflow demo.

### Entregables al usuario

- [ ] `correo_articulo.png`: Gmail con el articulo HTML: respuesta corta, hechos con fuentes y grafico incrustado visible.
- [ ] `correo_preguntas.png`: Gmail con las preguntas propuestas (modo sin pregunta).
- [ ] `correo_digest.png`: Gmail con el digest semanal.
- [ ] `whatsapp_conversacion_ideas.png`: conversacion completa: idea vaga -> respuesta del agente con preguntas numeradas -> `ideas` -> `investigar N` -> confirmacion -> aviso de articulo listo.
- [ ] `landing_preguntas.png`: landing en Vercel mostrando las preguntas propuestas en pantalla.
- [ ] `landing_en_proceso.png`: landing mostrando "Investigacion en curso" con numero de solicitud.

### Datos y persistencia

- [ ] `sheets_datasets.png`: hoja `datasets` del spreadsheet con filas de datos, cada una con su fuente.
- [ ] `pg_requests.png`: `SELECT id, tema, estado, created_at FROM research_requests ORDER BY id DESC LIMIT 5;` en psql.
- [ ] `pg_evidence.png`: `SELECT tipo, soporte, afirmacion FROM research_evidence WHERE request_id = X LIMIT 10;` mostrando hechos e hipotesis.
- [ ] `pg_datasets_ideas.png`: SELECT sobre `research_datasets` (con `quickchart_url`) y sobre `research_ideas` (estados del backlog).
- [ ] `pg_app_settings.png`: `SELECT key, LEFT(value, 200) FROM app_settings;` mostrando el playbook editable.

### Infraestructura

- [ ] `evolution_manager.png`: Evolution Manager con la instancia `researchflow` conectada (estado open/connected) y el webhook configurado.
- [ ] `vercel_deploy.png`: panel de Vercel con la landing desplegada y su dominio.
- [ ] `do_droplet.png`: panel de DigitalOcean con el droplet activo (nombre, IP, tamano).
- [ ] `docker_compose_ps.png`: salida de `docker compose ps` con los 5 servicios en running/healthy.

### Regla de las capturas

Cada captura debe mostrar fecha/hora o algun identificador (request_id, numero de idea) que la ligue a las pruebas del `plan_pruebas.md`, para que el tribunal pueda seguir la trazabilidad de una misma solicitud a traves de correo, Sheets y Postgres.
