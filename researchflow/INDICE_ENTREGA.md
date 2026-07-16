# Indice de entrega - ResearchFlow v2

## 1. Proyecto

**Titulo:** ResearchFlow: sistema automatizado de investigacion verificable con n8n, Gemini con Google Search grounding, WhatsApp y evidencia trazable.

**Objetivo:** capturar temas e ideas (web y WhatsApp), investigarlos con IA bajo una metodologia editable y reglas anti-alucinacion, y entregar articulos con hechos citados y graficos con fuente por Gmail y WhatsApp, con persistencia en Postgres y Google Sheets.

## 2. Contenido del paquete

### Informe y evaluacion

| Archivo | Que es |
| --- | --- |
| `informe_final.md` | Informe tecnico completo segun el formato oficial del curso |
| `output/pdf/informe_final_researchflow.pdf` | Version PDF del informe v2 (regenerada; volver a generar solo si se insertan capturas) |
| `matriz_rubrica.md` | Autoevaluacion contra la rubrica |
| `fuentes_consultadas.md` | Bibliografia y fuentes |

### Workflows n8n (4)

| Archivo | Workflow |
| --- | --- |
| `n8n_workflow_research_production.json` | Investigacion profunda: webhook `/webhook/researchflow`, 4 fases Gemini 2.5 Flash con grounding (base, profundizacion, sintesis y verificacion adversarial con puntaje de confianza), QuickChart, Postgres, Gmail, WhatsApp, Sheets |
| `n8n_workflow_ideas_whatsapp.json` | Ideas por WhatsApp: agente con memoria + comandos `ideas` / `investigar N` (webhook `/webhook/researchflow-whatsapp`) |
| `n8n_workflow_weekly_digest.json` | Digest semanal del backlog (Schedule lunes 8am) |
| `n8n_workflow_demo_import.json` | Demo sin credenciales (webhook `/webhook/researchflow-demo`), plan B de defensa |
| `workflow_blueprint.json` | Diagrama logico del flujo (no importable; documental) |

### Datos e infraestructura

| Archivo | Que es |
| --- | --- |
| `database_schema_postgres.sql` | Esquema de produccion: 8 tablas (incluye `research_verifications`) + playbook en `app_settings` + semilla |
| `deploy/deploy_digitalocean.md` | Guia paso a paso del despliegue completo |
| `deploy/docker-compose.yml` | Stack: Caddy + Postgres 16 + Redis + n8n + Evolution API v2.2 |
| `deploy/Caddyfile` | Proxy HTTPS para `n8n.DOMINIO` y `evo.DOMINIO` |
| `deploy/.env.example` | Variables del stack (dominio, passwords, claves) |
| `deploy/init-databases.sh` | Creacion de las bases en el Postgres del stack |

### Landing page

| Archivo | Que es |
| --- | --- |
| `landing_page/index.html` | Formulario de solicitud (tema, pregunta opcional, fuente, contacto) |
| `landing_page/script.js` | Envio al webhook y render de preguntas / estado de investigacion |
| `landing_page/styles.css` | Estilos |
| `landing_page/vercel.json` | Rewrites `/api/investigar` y `/api/demo` hacia n8n (sin CORS) |

### Metodologia y arquitectura

| Archivo | Que es |
| --- | --- |
| `playbook_investigacion.md` | Metodologia de investigacion (version larga; la condensada vive en `app_settings`) |
| `arquitectura_stack.md` | Inventario de recursos y decisiones de stack |

### Documentacion operativa

| Archivo | Que es |
| --- | --- |
| `manual_usuario.md` | Uso del sistema: landing, WhatsApp, digest, lectura del articulo, FAQ |
| `manual_tecnico.md` | Instalacion, 8 tablas, playbook editable, placeholders, mantenimiento, troubleshooting |
| `plan_pruebas.md` | Casos PU-01..PU-10 y PI-01..PI-05 con evidencia a capturar |
| `defensa_guion.md` | Guion de defensa de ~10 minutos con demo y plan B |
| `checklist_defensa.md` | Checklist operativo dia antes / hora antes |
| `anexos_evidencias.md` | Anexos del paquete y checklist de capturas pendientes |
| `CAMBIOS_v3.md` | Registro del cambio v2 -> v3 (verificacion adversarial + puntaje de confianza) y guia para aplicarlo sin crear un workflow nuevo |
| `README.md` | Punto de entrada del repositorio |

### Datos de prueba y scripts

| Archivo | Que es |
| --- | --- |
| `test_data/sample_request.json` | Payload con pregunta (investigacion completa) |
| `test_data/sample_request_solo_tema.json` | Payload solo tema (generacion de preguntas) |
| `test_data/sample_demo_response.json` | Respuesta esperada del workflow demo |
| `scripts/validate_package.ps1` | Validacion de JSON/JS del paquete |
| `scripts/generate_report_pdf.py` | Generador del PDF del informe |

## 3. Orden de revision sugerido

1. `README.md` y `arquitectura_stack.md`: que es el proyecto y con que stack.
2. `informe_final.md` (o el PDF): el documento academico completo.
3. `playbook_investigacion.md` y `database_schema_postgres.sql`: la metodologia y su encarnacion en datos.
4. Los 4 workflows JSON (abrirlos importados en n8n para ver los nodos y sus notas).
5. `deploy/deploy_digitalocean.md` + `manual_tecnico.md`: como se levanta y se opera.
6. `manual_usuario.md`: la experiencia del usuario final.
7. `plan_pruebas.md` + `anexos_evidencias.md`: como se valido y con que evidencia.
8. `defensa_guion.md` + `checklist_defensa.md`: la presentacion.

## 4. Pendientes manuales (no automatizables desde el repositorio)

- [ ] Completar `deploy/.env` (config sensible centralizada): `GEMINI_API_KEY`, `EVOLUTION_API_KEY`, `GOOGLE_SHEET_ID`, `OWNER_NAME`, `OWNER_EMAIL`, `OWNER_WHATSAPP`. Los workflows la leen via `{{ $env.* }}`; no hay que editar nodos.
- [ ] Crear credenciales nativas en n8n (no van en `.env`): Postgres, Gmail OAuth2, Google Sheets OAuth2, Google Gemini (AI Agent).
- [ ] Reemplazar `REPLACE_WITH_N8N_DOMAIN` en `landing_page/vercel.json` (unico placeholder fuera de n8n).
- [ ] Ejecutar el despliegue de `deploy/deploy_digitalocean.md` (droplet, docker, esquema, credenciales n8n, QR de Evolution, Sheets, Vercel).
- [ ] Correr `plan_pruebas.md` sobre el sistema real y tomar las capturas de `anexos_evidencias.md`.
- [ ] Volver a regenerar el PDF (`scripts/generate_report_pdf.py`) SOLO despues de insertar las capturas en el informe (la version v2 sin capturas ya esta generada).
- [ ] Snapshot del droplet y alerta de presupuesto en Google Cloud antes de la defensa.
