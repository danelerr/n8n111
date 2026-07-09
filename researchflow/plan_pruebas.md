# Plan de pruebas - ResearchFlow v2

## 1. Objetivo y alcance

Validar los 4 workflows de la arquitectura v2 (Investigacion profunda, Ideas por WhatsApp, Digest semanal y Demo sin credenciales) sobre el stack desplegado: droplet DigitalOcean con Caddy + n8n + Postgres 16 + Redis + Evolution API, landing en Vercel, Gmail, Google Sheets y Gemini.

Convenciones:

- `BASE` = `https://n8n.TU-DOMINIO`. Los webhooks de produccion son `BASE/webhook/researchflow`, `BASE/webhook/researchflow-whatsapp` y `BASE/webhook/researchflow-demo`.
- Payloads de ejemplo en `test_data/sample_request.json` (con pregunta), `test_data/sample_request_solo_tema.json` (solo tema) y `test_data/sample_demo_response.json` (respuesta demo esperada).
- Antes de las pruebas integrales: workflows activos, credenciales asignadas, placeholders reemplazados, instancia Evolution conectada.

Comando base para disparar webhooks desde PowerShell:

```powershell
$body = Get-Content "test_data\sample_request.json" -Raw
Invoke-RestMethod -Method Post -Uri "https://n8n.TU-DOMINIO/webhook/researchflow" -ContentType "application/json" -Body $body
```

## 2. Pruebas unitarias (PU)

### PU-01 - Webhook responde

- **Objetivo:** confirmar que el webhook de investigacion recibe POST y responde JSON.
- **Pasos:** 1) Activar el workflow "ResearchFlow - Investigacion profunda". 2) POST del payload con pregunta a `BASE/webhook/researchflow`.
- **Resultado esperado:** HTTP 200 con JSON de respuesta inmediata (modo en_proceso con `request_id`, o preguntas si no habia pregunta). Ejecucion visible en Executions.
- **Evidencia:** captura de la respuesta en consola y de la ejecucion verde en n8n.

### PU-02 - Normalizacion de payload incompleto

- **Objetivo:** verificar que un payload con campos faltantes no rompe el flujo.
- **Pasos:** 1) POST a `BASE/webhook/researchflow` con solo `{"tema": "prueba de normalizacion"}`. 2) Abrir la ejecucion y revisar la salida del nodo "Normalizar solicitud".
- **Resultado esperado:** los campos ausentes quedan con valores por defecto controlados (nombre generico, email vacio, `tipo_entregable` informe breve, `prioridad` media, `canal_origen` web); ningun nodo falla por campo indefinido.
- **Evidencia:** captura del output del nodo "Normalizar solicitud".

### PU-03 - INSERT devuelve request_id

- **Objetivo:** confirmar que "Postgres - Registrar solicitud" inserta y devuelve el id (RETURNING id).
- **Pasos:** 1) Ejecutar PU-01. 2) Revisar la salida del nodo Postgres en la ejecucion. 3) `SELECT id, tema, estado FROM research_requests ORDER BY id DESC LIMIT 1;`.
- **Resultado esperado:** el nodo devuelve el `id` nuevo; ese `request_id` aparece en la respuesta al cliente y coincide con la fila en la tabla.
- **Evidencia:** captura del output del nodo y del SELECT en psql.

### PU-04 - Carga del playbook desde app_settings

- **Objetivo:** verificar que la metodologia se lee de la base y llega a los prompts.
- **Pasos:** 1) Ejecutar una investigacion. 2) Revisar la salida del nodo "Postgres - Cargar playbook". 3) Revisar el body de "Gemini - Fase base con busqueda" en la ejecucion.
- **Resultado esperado:** el nodo trae el value de `key='playbook_investigacion'` y el texto de la metodologia (fases, jerarquia de fuentes, reglas duras) aparece dentro del prompt enviado a Gemini.
- **Evidencia:** captura del output del nodo de carga y del prompt con el playbook incluido.

### PU-05 - Generacion de preguntas con tema solo

- **Objetivo:** validar la rama SIN pregunta del workflow de investigacion.
- **Pasos:** 1) POST de `test_data/sample_request_solo_tema.json` a `BASE/webhook/researchflow`. 2) Revisar respuesta, correo y base.
- **Resultado esperado:** respuesta JSON con `modo: preguntas_generadas` y 3 a 5 preguntas; correo con las preguntas; fila nueva en `research_ideas` con las preguntas sugeridas. NO se ejecutan las fases de investigacion profunda.
- **Evidencia:** captura de la respuesta JSON, del correo y de `SELECT * FROM research_ideas ORDER BY id DESC LIMIT 1;`.

### PU-06 - Fallback si Gemini no esta configurado

- **Objetivo:** confirmar que una falla de Gemini no deja al sistema colgado ni respuestas invalidas.
- **Pasos:** 1) En una copia del workflow (o en staging), dejar el placeholder `REPLACE_WITH_GEMINI_API_KEY` sin reemplazar o poner una key invalida. 2) Enviar una solicitud.
- **Resultado esperado:** el nodo Gemini falla de forma controlada; la ejecucion termina sin quedar colgada; la solicitud queda registrada en `research_requests` con estado/detalle de error o respuesta de respaldo; el cliente recibe JSON valido (nunca un cuelgue silencioso).
- **Evidencia:** captura de la ejecucion con el nodo en error controlado y del estado en la tabla.

### PU-07 - Dataset sin fuente NO genera grafico

- **Objetivo:** validar la regla anti-alucinacion de la Fase 4: solo se grafican cifras con fuente.
- **Pasos:** 1) Ejecutar una investigacion sobre un tema sin cifras publicas claras (ej. un tema de opinion local muy nicho). 2) Revisar la salida del nodo "Procesar resultado" y el correo recibido.
- **Resultado esperado:** los puntos de dato sin `fuente_url` se descartan en la validacion; si no queda ningun dataset valido, no se construye URL de QuickChart, el correo llega sin grafico y el articulo declara que no hubo cifras confiables. "Preparar filas Sheets" no agrega filas.
- **Evidencia:** captura del output de "Procesar resultado" mostrando el descarte y del articulo sin grafico con la nota explicita.

### PU-08 - Filtro de mensajes propios y de grupos en WhatsApp

- **Objetivo:** confirmar que el workflow de ideas ignora eventos que no son mensajes directos de terceros.
- **Pasos:** 1) Con el workflow "Ideas por WhatsApp" activo, enviar un mensaje DESDE el numero conectado (fromMe) y un mensaje en un grupo donde este el numero. 2) Revisar Executions.
- **Resultado esperado:** ambas ejecuciones terminan en el nodo "Ignorar evento" tras "IF - Mensaje valido"; no se llama al agente, no se guarda idea y no se responde nada.
- **Evidencia:** captura de la ejecucion mostrando la ruta hacia "Ignorar evento".

### PU-09 - Comando "ideas" con backlog vacio

- **Objetivo:** validar la respuesta del comando `ideas` cuando no hay ideas pendientes.
- **Pasos:** 1) En base limpia (o con todas las ideas en estado investigada/descartada), enviar `ideas` por WhatsApp.
- **Resultado esperado:** respuesta por WhatsApp indicando que el backlog esta vacio e invitando a mandar una idea; sin errores en la ejecucion.
- **Evidencia:** captura del chat de WhatsApp y de la ejecucion verde.

### PU-10 - "investigar N" con N inexistente

- **Objetivo:** validar el manejo de un numero de idea invalido.
- **Pasos:** 1) Enviar `investigar 9999` por WhatsApp.
- **Resultado esperado:** la rama "IF - Idea encontrada" va por el lado negativo; llega respuesta "Evolution - Idea no encontrada" sugiriendo usar `ideas`; no se lanza ninguna investigacion ni se toca `research_requests`.
- **Evidencia:** captura del chat con la respuesta y de la ejecucion mostrando la rama negativa.

## 3. Pruebas integrales (PI)

### PI-01 - Flujo completo con pregunta

- **Objetivo:** validar la cadena entera: landing -> webhook -> 3 fases Gemini con grounding -> QuickChart -> Postgres -> Gmail -> WhatsApp -> Sheets.
- **Pasos:** 1) Desde la landing en Vercel, enviar el formulario completo con pregunta central y numero de WhatsApp. 2) Confirmar respuesta inmediata "en curso" con `request_id`. 3) Esperar 2-10 minutos. 4) Revisar correo, WhatsApp, Sheets y Postgres.
- **Resultado esperado:**
  - Correo con el articulo HTML: respuesta corta, hechos con fuentes, analisis, grafico(s) QuickChart incrustados y preguntas abiertas.
  - Aviso de WhatsApp con referencia al articulo.
  - Filas nuevas en la hoja `datasets` del spreadsheet (una por punto de dato, con fuente).
  - Registros ligados al `request_id` en las 4 tablas de evidencia: `research_sources`, `research_evidence`, `research_datasets`, `research_artifacts`; y la fila de `research_requests` con estado completado, resumen e informe.
- **Evidencia:** capturas del correo con grafico, del chat de WhatsApp, de la hoja `datasets`, de un SELECT por tabla filtrando por `request_id`, y de la ejecucion verde completa en n8n.

### PI-02 - Flujo sin pregunta desde la landing

- **Objetivo:** validar el modo generacion de preguntas end-to-end.
- **Pasos:** 1) Enviar el formulario de la landing con tema pero SIN pregunta central. 2) Observar la landing y el correo.
- **Resultado esperado:** la landing muestra "Preguntas propuestas" con 3-5 preguntas y su razon de interes; el mismo contenido llega por correo; la idea queda en `research_ideas`; no se ejecuta la investigacion profunda.
- **Evidencia:** captura de la landing con las preguntas, del correo y del SELECT sobre `research_ideas`.

### PI-03 - Idea por WhatsApp -> investigar N -> correo

- **Objetivo:** validar el ciclo completo del backlog conversacional.
- **Pasos:** 1) Enviar una idea vaga por WhatsApp (ej. "algo sobre el litio en Bolivia"). 2) Verificar respuesta del agente con preguntas numeradas. 3) Enviar `ideas` y ubicar el numero de la idea. 4) Enviar `investigar N`. 5) Esperar el resultado.
- **Resultado esperado:** el agente refina y guarda la idea (`research_ideas` estado idea/refinada); `ideas` lista el backlog; `investigar N` confirma por WhatsApp, marca la idea en_cola con su `request_id`, y en minutos llega el articulo al correo del propietario con aviso por WhatsApp; la idea puede verificarse ligada a la solicitud.
- **Evidencia:** captura de la conversacion completa de WhatsApp (idea, lista, comando, confirmacion, aviso final), del correo recibido y de `SELECT id, estado, request_id FROM research_ideas WHERE id = N;`.

### PI-04 - Digest semanal (ejecucion manual)

- **Objetivo:** validar el digest sin esperar al lunes.
- **Pasos:** 1) Asegurar que existan ideas pendientes en `research_ideas`. 2) Abrir el workflow "ResearchFlow - Digest semanal" y pulsar Execute Workflow. 3) Revisar correo y WhatsApp del propietario.
- **Resultado esperado:** correo con el resumen redactado por Gemini de las ideas pendientes y aviso corto por WhatsApp; ejecucion verde.
- **Evidencia:** captura del correo del digest, del aviso de WhatsApp y de la ejecucion manual verde.

### PI-05 - Demo sin credenciales desde la landing

- **Objetivo:** validar el plan B de demostracion, sin base de datos, Gemini, Gmail ni Evolution.
- **Pasos:** 1) Activar "ResearchFlow - Demo sin credenciales". 2) Apuntar la landing al endpoint demo (rewrite `/api/demo` de `vercel.json`, o `WEBHOOK_URL` hacia `BASE/webhook/researchflow-demo`). 3) Enviar el formulario con pregunta y luego sin pregunta.
- **Resultado esperado:** con pregunta, la landing muestra un informe simulado con grafico QuickChart real; sin pregunta, muestra preguntas simuladas; respuesta en segundos; sin credenciales involucradas.
- **Evidencia:** captura de la landing mostrando el resultado demo con grafico y de la ejecucion verde del workflow demo.

## 4. Criterio de aprobacion

El sistema se considera aprobado para defensa cuando:

- Todas las PU pasan (o quedan justificadas las que requieren staging, como PU-06).
- PI-01, PI-02, PI-03 y PI-05 pasan de punta a punta con evidencia capturada.
- PI-04 pasa en ejecucion manual.
- No quedan placeholders `REPLACE_WITH_*` en los workflows activos de produccion.
- Las capturas exigidas quedan archivadas segun `anexos_evidencias.md`.
