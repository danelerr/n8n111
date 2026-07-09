# Proyecto final: ResearchFlow - Asistente de investigacion automatizado y verificable con n8n

Estudiante: Daniel Cueto

Programa: Automatizacion de Negocios con n8n

Institucion: Embajada de los Estados Unidos

Docente: Ph.D. Milton Cayo Blanco

Fecha: 3 de julio de 2026

## 1. Resumen Ejecutivo

ResearchFlow es un asistente personal de investigacion para un creador de contenido / analista independiente, construido sobre n8n. El problema de negocio es que investigar un tema a fondo de forma manual (buscar fuentes, filtrar su calidad, extraer datos, construir graficos y redactar un articulo) toma entre 4 y 6 horas por tema, y ademas es propenso a sesgos, cifras sin respaldo y fuentes dudosas.

La solucion v2 se compone de 4 workflows de n8n desplegados en un droplet de DigitalOcean: (1) "Investigacion profunda", que recibe solicitudes desde una landing en Vercel via webhook, registra el pedido en Postgres, carga una metodologia editable (playbook) desde la tabla `app_settings` y ejecuta una investigacion en 3 fases con Gemini 2.5 Flash y Google Search grounding, entregando un articulo HTML con graficos QuickChart por Gmail y aviso por WhatsApp; (2) "Ideas por WhatsApp", que captura y refina ideas conversando con un AI Agent con memoria por numero de telefono via Evolution API; (3) "Digest semanal", que resume el backlog de ideas pendientes cada lunes; y (4) "Demo sin credenciales", para demostraciones sin depender de APIs externas.

El diferencial del proyecto es la trazabilidad: por reglas duras del playbook, nunca se inventan cifras ni fuentes, todo hecho cita su fuente o se marca `requiere_verificacion`, y solo se grafican cifras que tienen fuente. El resultado: una investigacion pasa de 4-6 horas a unos 10 minutos de ejecucion mas una revision humana breve, con costo marginal de centavos por investigacion.

## 2. Introduccion

La transformacion digital permite convertir procesos repetitivos en flujos automatizados y medibles. El trabajo de investigacion para contenido y analisis sigue siendo mayormente manual: se recibe una idea, se abren decenas de pestanas, se copian notas, se evaluan fuentes a ojo, se transcriben cifras a una hoja de calculo, se arma un grafico y se redacta. Cuando se agrega IA generativa sin proceso, aparece un riesgo nuevo: respuestas fluidas que mezclan hechos comprobados con inferencias y cifras inventadas.

ResearchFlow usa n8n no como una herramienta de formulario, sino como orquestador de trabajo intelectual: captura la solicitud por web o WhatsApp, aplica una metodologia de investigacion explicita (el playbook del usuario, almacenado en base de datos y editable sin tocar los flujos), ejecuta busqueda web real mediante Google Search grounding de Gemini, clasifica lo encontrado en hechos, hipotesis y opiniones, genera graficos solo con datos respaldados, guarda toda la evidencia en Postgres y Google Sheets, y comunica el resultado por Gmail y WhatsApp.

Este informe documenta el problema, el diseno, la implementacion en produccion (droplet DigitalOcean con Docker), los resultados y el analisis economico del proyecto.

## 3. Requisitos Minimos del Proyecto

| Requisito oficial | Como se cumple en ResearchFlow |
| --- | --- |
| Al menos un Trigger | Tres tipos: Webhook `/webhook/researchflow` (landing Vercel), Webhook `/webhook/researchflow-whatsapp` (Evolution API) y Schedule Trigger (digest semanal, lunes 8am). |
| Al menos tres integraciones externas | Seis: Gemini API (con Google Search grounding), Gmail, Google Sheets, Evolution API (WhatsApp), QuickChart y PostgreSQL. |
| Base de datos o Google Sheets | Ambos: Postgres 16 en el droplet (7 tablas `research_*` y `app_settings`) y Google Sheets como repositorio de datasets (hoja `datasets`). |
| Proceso automatizado de comunicacion | Articulo HTML con graficos por Gmail, avisos y conversacion por WhatsApp, digest semanal por ambos canales. |
| Evidencias funcionales | Workflows JSON importables, plan de pruebas, workflow demo ejecutable sin credenciales, capturas definidas en `anexos_evidencias.md`. |
| Analisis economico | ROI y costos reales del droplet y APIs en las secciones 13 y 14. |
| Documentacion tecnica | Informe, manual tecnico, manual de usuario, esquemas SQL, guia de despliegue y plan de pruebas. |

## 4. Planteamiento del Problema

El proceso manual actual de un creador de contenido / analista independiente que investiga un tema presenta estos problemas:

- Investigar un tema a fondo (buscar fuentes, filtrar calidad, extraer datos, hacer graficos, redactar el articulo) toma entre 4 y 6 horas por tema.
- La seleccion de fuentes es propensa a sesgos: es facil quedarse con lo primero que aparece, sin evaluar el incentivo del medio ni distinguir investigacion original de opinion o propaganda.
- Las cifras se copian a mano y muchas veces quedan sin fuente asociada; un grafico sin fuente es indefendible.
- Las ideas de temas llegan por canales dispersos (mensajes, notas, navegador) y se pierden.
- No existe una base historica unica de solicitudes, fuentes, evidencia, datasets y articulos que permita reutilizar trabajo previo.
- La comunicacion del resultado (enviar el articulo, avisar que esta listo) es manual.

La oportunidad consiste en automatizar la captura, la investigacion metodica con IA, el registro trazable y la comunicacion, manteniendo reglas de calidad estrictas que la IA debe cumplir.

## 5. Objetivos

### 5.1 Objetivo general

Implementar con n8n un asistente de investigacion automatizado que transforme un tema o pregunta en un articulo verificable con graficos, reduciendo el tiempo de investigacion de 4-6 horas a minutos, con trazabilidad completa de fuentes y comunicacion automatica por Gmail y WhatsApp.

### 5.2 Objetivos especificos

1. Analizar el proceso manual de investigacion y codificar la metodologia del usuario en un playbook editable almacenado en base de datos.
2. Disenar e implementar 4 workflows en n8n: investigacion profunda, ideas por WhatsApp, digest semanal y demo sin credenciales.
3. Integrar Gemini 2.5 Flash con Google Search grounding en un proceso de 3 fases (base, profundizacion, sintesis JSON estricta).
4. Registrar solicitudes, fuentes, evidencia, datasets, articulos e ideas en PostgreSQL, y datasets en Google Sheets.
5. Generar graficos QuickChart exclusivamente con cifras que tienen fuente verificada.
6. Entregar el articulo por Gmail y avisos por WhatsApp (Evolution API), y capturar ideas por WhatsApp con un AI Agent con memoria.
7. Desplegar el stack completo en produccion (droplet DigitalOcean con Docker, HTTPS via Caddy) y validar el flujo end-to-end.

## 6. Marco Teorico

**Automatizacion de procesos:** uso de tecnologia para ejecutar tareas repetitivas con minima intervencion humana, reduciendo errores y tiempos. ResearchFlow automatiza un proceso intelectual completo, no solo tareas administrativas.

**Transformacion digital:** rediseno de procesos con herramientas digitales para ganar productividad y capacidades nuevas de analisis. Aqui, la investigacion pasa de artesanal a industrializada con control de calidad.

**BPM (Business Process Management):** disciplina para identificar, modelar, ejecutar y mejorar procesos. El proceso "investigar un tema" fue modelado en fases explicitas (playbook) antes de automatizarse, y sus estados viven en la base de datos (`nuevo`, `en_proceso`, `completado`; ideas: `idea -> refinada -> en_cola -> investigada`).

**Integracion de aplicaciones:** conexion de sistemas independientes para compartir datos y coordinar acciones. n8n integra landing web, Postgres, Gemini, QuickChart, Gmail, Google Sheets y WhatsApp en un solo flujo.

**APIs REST:** interfaces que exponen operaciones via HTTP (GET, POST) con datos JSON. El proyecto consume la API REST de Gemini (generateContent), la de Evolution API (sendText) y la de QuickChart (chart por URL).

**Webhooks:** endpoints HTTP que reciben eventos externos y disparan un workflow. La landing hace POST a `/webhook/researchflow` (via proxy de Vercel) y Evolution API notifica cada mensaje de WhatsApp a `/webhook/researchflow-whatsapp`.

**IA aplicada a negocios y grounding:** los modelos generativos redactan y estructuran informacion, pero pueden alucinar datos. El grounding con Google Search ancla las respuestas de Gemini en resultados de busqueda web reales y citables. ResearchFlow combina grounding con reglas duras (nunca inventar cifras ni fuentes, marcar `requiere_verificacion`) para que la IA sea auditable.

**Plataforma n8n:** herramienta de automatizacion visual, self-hosted, que conecta triggers, nodos de transformacion (Set, Code, IF), bases de datos, APIs y nodos de IA (AI Agent, modelos de chat, memoria) mediante flujos versionables en JSON.

## 7. Analisis del Negocio

### 7.1 Descripcion

Negocio: creador de contenido / analista independiente que produce articulos, analisis y material educativo basado en investigacion.

Sector: creacion de contenido, analisis e investigacion aplicada.

Productos: articulos con datos y graficos, informes breves, backlog de temas investigables.

Cliente del sistema: el propio analista (asistente personal), extensible a equipos de contenido, consultores y estudiantes.

Problemas del negocio: tiempo de produccion alto (4-6 h por tema), riesgo reputacional por cifras o fuentes dudosas, perdida de ideas y ausencia de archivo historico reutilizable.

### 7.2 Proceso Seleccionado

Proceso automatizado: investigacion completa de un tema, desde la captura de la idea hasta la entrega del articulo verificable.

Flujo del proceso: una persona envia un tema (y opcionalmente una pregunta) desde la landing o por WhatsApp. Si solo hay tema, el sistema propone 3-5 preguntas investigables y las guarda como ideas. Si hay pregunta, el sistema responde de inmediato "en proceso" y ejecuta la investigacion en 3 fases con busqueda web real, clasifica afirmaciones (hecho / hipotesis / opinion), extrae datasets con fuente, genera graficos, guarda todo en Postgres y Sheets, y entrega el articulo por Gmail con aviso por WhatsApp.

## 8. Estudio de Viabilidad

### 8.1 Viabilidad Tecnica

Viable con recursos ya disponibles: n8n self-hosted (visto en el curso), droplet DigitalOcean con Docker (docker-compose con Caddy, n8n, Postgres 16, Redis y Evolution API v2.2), Gemini API en tier pagado con rate limits amplios, y servicios gratuitos (QuickChart, DuckDNS, Vercel free). Todos los nodos usados (Webhook, Set, Code, IF, Postgres, HTTP Request, Gmail, Google Sheets, Schedule Trigger, AI Agent con modelo Gemini y memoria) son estandar de n8n. Existe ademas un workflow demo sin credenciales que elimina el riesgo tecnico de la presentacion.

### 8.2 Viabilidad Economica

Costos concretos y bajos: droplet 8 GB a $48/mes cubierto por los $150 de creditos de DigitalOcean vigentes (vencen julio 2026); regimen posterior recomendado de 4 GB a $24/mes. Gemini 2.5 Flash cuesta centavos por investigacion completa (cuenta tier Pagado 1, limite $250, con alertas de presupuesto configuradas); el tier pagado incluye una franja diaria gratuita amplia de consultas con grounding. QuickChart, DuckDNS, Vercel, Evolution API (open source) y las APIs de Google Workspace: $0. No hay licencias.

### 8.3 Viabilidad Operativa

El usuario solo llena un formulario o escribe por WhatsApp; el sistema hace el resto. La metodologia es editable sin tocar los workflows (registro `playbook_investigacion` en `app_settings`). La supervision humana se conserva donde importa: revision del articulo antes de publicar, y los elementos marcados `requiere_verificacion` quedan explicitos. Comandos simples por WhatsApp ("ideas", "investigar N") operan el backlog sin abrir n8n.

## 9. Diseno de la Solucion

### 9.1 Arquitectura General

```text
ENTRADA
  Landing page (Vercel) --POST /api/investigar (proxy, sin CORS)--+
                                                                  v
  WhatsApp (Evolution API v2.2) --webhook messages.upsert--> [ n8n self-hosted ]
                                                             droplet DigitalOcean
ORQUESTACION (docker-compose + Caddy HTTPS/DuckDNS)             (Docker)
  WF1 Investigacion profunda   (webhook /webhook/researchflow)
  WF2 Ideas por WhatsApp       (webhook /webhook/researchflow-whatsapp)
  WF3 Digest semanal           (Schedule Trigger lunes 8am)
  WF4 Demo sin credenciales    (para demostraciones)

INTELIGENCIA
  Gemini 2.5 Flash + Google Search grounding (fases base y profundizacion)
  Gemini 2.5 Flash JSON estricto (fase sintesis, sin busqueda)
  Playbook editable en tabla app_settings (metodologia del usuario)

DATOS
  Postgres 16 (droplet): research_requests, research_sources, research_evidence,
    research_artifacts, research_ideas, research_datasets, app_settings
  Google Sheets: hoja "datasets" (una fila por punto de dato con fuente)

SALIDA
  QuickChart: graficos PNG (barras, pastel, lineas) solo con cifras con fuente
  Gmail: articulo HTML con graficos incrustados / preguntas propuestas / digest
  WhatsApp: avisos, listado de ideas, conversacion con AI Agent
```

[Insertar aqui el diagrama de arquitectura - Figura 1]

### 9.2 Herramientas Utilizadas

| Herramienta | Funcion |
| --- | --- |
| n8n self-hosted (Docker) | Orquestacion de los 4 workflows |
| PostgreSQL 16 | Almacenamiento: solicitudes, fuentes, evidencia, artefactos, ideas, datasets y configuracion (playbook) |
| Gemini API (2.5 Flash) | Investigacion en 3 fases, generacion de preguntas, refinado de ideas, redaccion del digest |
| Google Search grounding | Busqueda web real y citable dentro de Gemini (fases base y profundizacion) |
| QuickChart | Graficos PNG por URL (barras, pastel, lineas) sin API key |
| Gmail (OAuth2) | Entrega del articulo HTML, preguntas propuestas y digest |
| Google Sheets (OAuth2) | Repositorio de datasets (hoja `datasets`) |
| Evolution API v2.2 | Canal WhatsApp: captura de ideas, comandos y avisos |
| AI Agent de n8n + memoria | Conversacion de refinado de ideas con memoria por numero de telefono |
| Caddy | Reverse proxy con HTTPS automatico (Let's Encrypt) |
| DuckDNS | Subdominio gratuito para HTTPS y OAuth |
| Vercel | Hosting de la landing con rewrite `/api/investigar` (evita CORS) |
| Docker Compose | Stack reproducible: Caddy, n8n, Postgres, Redis, Evolution API |

## 10. Diseno del Flujo de Trabajo

Workflow principal: `n8n_workflow_research_production.json` ("ResearchFlow - Investigacion profunda").

```text
Webhook - Nueva investigacion
  -> Normalizar solicitud
  -> Postgres - Registrar solicitud (RETURNING id)
  -> Postgres - Cargar playbook (app_settings)
  -> IF - Con pregunta
     [SIN pregunta]
       -> Preparar peticion de preguntas -> Gemini - Generar preguntas (3-5, JSON)
       -> Procesar preguntas -> Postgres - Guardar idea (research_ideas)
       -> Gmail - Enviar preguntas -> Responder preguntas (a la landing)
     [CON pregunta]
       -> Responder en proceso (respuesta inmediata a la landing)
       -> Preparar fase base -> Gemini - Fase base con busqueda (grounding)
       -> Preparar profundizacion -> Gemini - Profundizar con busqueda (grounding)
       -> Preparar sintesis -> Gemini - Sintesis estructurada (JSON estricto)
       -> Procesar resultado (valida datasets, arma QuickChart y articulo HTML)
       -> Postgres - Guardar evidencia -> Gmail - Enviar articulo
       -> Evolution API - Aviso WhatsApp -> Postgres - Actualizar resultado
       -> Preparar filas Sheets -> Google Sheets - Registrar datos
```

[Insertar aqui la captura del workflow en n8n - Figura 2]

### 10.1 Descripcion de Nodos

Nodos principales de los 4 workflows:

| Workflow | Nodo | Funcion |
| --- | --- | --- |
| Investigacion | Webhook - Nueva investigacion | Recibe POST de la landing (via proxy Vercel) o del flujo de ideas. |
| Investigacion | Normalizar solicitud | Estandariza nombre, email, whatsapp, tema, pregunta, prioridad y canal. |
| Investigacion | Postgres - Registrar solicitud | INSERT en `research_requests` con RETURNING id para trazar todo el flujo. |
| Investigacion | Postgres - Cargar playbook | Lee la metodologia editable desde `app_settings`; si falta, usa un playbook minimo embebido. |
| Investigacion | IF - Con pregunta | Bifurca: investigar (con pregunta) o proponer preguntas (solo tema). |
| Investigacion | Responder en proceso | Responde de inmediato a la landing; la investigacion sigue en segundo plano. |
| Investigacion | Gemini - Fase base con busqueda | Fase 1 con grounding: base del tema, vocabulario tecnico, controversias. |
| Investigacion | Gemini - Profundizar con busqueda | Fase 2 con grounding: 5 porques y datos numericos con fuente. |
| Investigacion | Gemini - Sintesis estructurada | Fase 3 sin busqueda: JSON estricto con hechos (fuente_url), hipotesis, opiniones, datasets, articulo_markdown y fuentes. |
| Investigacion | Procesar resultado | Valida datasets (solo cifras con fuente), construye URLs QuickChart, articulo HTML, SQL y filas para Sheets. |
| Investigacion | Postgres - Guardar evidencia | Inserta fuentes, evidencia clasificada, datasets y el articulo como artifact. |
| Investigacion | Gmail - Enviar articulo | Envia el articulo HTML con graficos incrustados. |
| Investigacion | Evolution API - Aviso WhatsApp | Aviso corto de investigacion lista. |
| Investigacion | Postgres - Actualizar resultado | Marca la solicitud como completada con resumen e informe. |
| Investigacion | Google Sheets - Registrar datos | Agrega una fila por punto de dato en la hoja `datasets`. |
| Investigacion | Gemini - Generar preguntas | Rama sin pregunta: 3-5 preguntas investigables en JSON, guardadas en `research_ideas` y enviadas por Gmail. |
| Ideas WhatsApp | Webhook - Evolution WhatsApp | Recibe eventos `messages.upsert` de Evolution API. |
| Ideas WhatsApp | IF - Mensaje valido / Comando investigar / Comando ideas | Filtra eventos y enruta comandos "investigar N" e "ideas". |
| Ideas WhatsApp | AI Agent - Refinar idea | Agente con modelo Gemini y memoria por numero: refina la idea y propone preguntas numeradas. |
| Ideas WhatsApp | Postgres - Guardar idea / Listar ideas / Obtener idea / Marcar en cola | Operan el backlog `research_ideas` y sus estados. |
| Ideas WhatsApp | HTTP - Lanzar investigacion | "investigar N" dispara el webhook del workflow de investigacion. |
| Ideas WhatsApp | Evolution - Responder idea / Enviar lista / Confirmar lanzamiento | Respuestas al usuario por WhatsApp. |
| Digest semanal | Schedule - Lunes 8am | Trigger programado semanal. |
| Digest semanal | Postgres - Ideas pendientes | Consulta el backlog pendiente. |
| Digest semanal | Gemini - Redactar digest | Redacta un digest breve (sin busqueda web). |
| Digest semanal | Gmail - Enviar digest / Evolution - Aviso digest | Entrega por ambos canales. |
| Demo | Webhook - Demo / Investigacion simulada / Preguntas simuladas | Misma logica de entrada con investigacion simulada y grafico QuickChart real; sin credenciales. |

## 11. Implementacion

1. **Infraestructura:** creacion del droplet DigitalOcean (Ubuntu 24.04, 8 GB / 4 vCPU), subdominio DuckDNS, instalacion de Docker y despliegue del stack con `deploy/docker-compose.yml` (Caddy con HTTPS Let's Encrypt, n8n, Postgres 16, Redis, Evolution API v2.2), segun `deploy/deploy_digitalocean.md`.
2. **Base de datos:** ejecucion de `database_schema_postgres.sql` sobre la base `researchflow` (7 tablas, playbook inicial en `app_settings` y registro semilla de prueba).
3. **Credenciales:** Postgres (host `postgres` interno del compose), Gmail OAuth2 y Google Sheets OAuth2 (proyecto Google Cloud con redirect URI de n8n), API key de Gemini en los nodos HTTP, credencial Google Gemini para el AI Agent, y `EVOLUTION_API_KEY` en los nodos de WhatsApp.
4. **Creacion de flujos:** importacion de los 4 workflows JSON y reemplazo de placeholders (dueno, correo, WhatsApp, ID de spreadsheet).
5. **Integracion de APIs:** Gemini via HTTP Request (generateContent con `google_search` en fases 1-2 y `responseMimeType: application/json` en la sintesis), QuickChart por URL construida en el nodo Code, Evolution API `sendText`.
6. **Webhooks:** conexion de la landing en Vercel mediante rewrite `/api/investigar` hacia `/webhook/researchflow` (sin CORS), y webhook de Evolution API (`messages.upsert`) hacia `/webhook/researchflow-whatsapp` tras escanear el QR de la instancia `researchflow`.
7. **Pruebas unitarias:** validacion por nodo con datos de `test_data/` (normalizacion, INSERT con RETURNING id, parseo del JSON de sintesis, construccion de URLs QuickChart), segun `plan_pruebas.md`.
8. **Pruebas integrales:** landing sin pregunta (preguntas por pantalla y Gmail), landing con pregunta (respuesta inmediata + articulo con graficos por Gmail + aviso WhatsApp + filas en Sheets + tablas `research_*` pobladas), ideas por WhatsApp (idea vaga -> agente; "ideas" -> lista; "investigar N" -> lanzamiento) y digest programado.
9. **Puesta en produccion:** activacion de los workflows en el droplet, alertas de presupuesto en la cuenta de Gemini, verificacion end-to-end y snapshot del droplet como respaldo antes del vencimiento de creditos.

## 12. Resultados

| Indicador | Antes (manual) | Despues (ResearchFlow) |
| --- | --- | --- |
| Tiempo por investigacion | 4 a 6 horas | ~10 min de ejecucion + 20-30 min de revision humana |
| Investigaciones posibles por semana | 1 a 2 | 5 a 10 |
| Cifras sin fuente en el entregable | Frecuentes | 0: sin fuente no se grafica; lo dudoso queda `requiere_verificacion` |
| Registro de fuentes y evidencia | Disperso (pestanas, notas) | 100% en `research_sources` / `research_evidence`, clasificado |
| Ideas perdidas | Varias por semana | 0: backlog `research_ideas` + digest semanal |
| Costo marginal por investigacion | Horas de trabajo | Centavos de API (Gemini Flash) |
| Comunicacion del resultado | Manual | Automatica: Gmail + WhatsApp |
| Datasets reutilizables | No existian | Postgres + Google Sheets, cada punto con fuente |

La mejora central no es solo velocidad: es que cada articulo queda auditable (que fuente respalda que hecho) y el conocimiento se acumula en una base consultable.

## 13. ROI

Supuestos razonables (perfil: analista independiente en Bolivia):

- Investigaciones por semana: 4 (16 al mes).
- Tiempo manual por investigacion: 5 horas (punto medio del rango 4-6 h).
- Tiempo con ResearchFlow: ~10 min de ejecucion + 30 min de revision = 0.67 h.
- Ahorro por investigacion: 4.33 horas.
- Valor conservador de la hora del analista: $6 USD.
- Costo mensual del sistema (post-creditos): droplet 4 GB $24 + Gemini < $1 = $25. Durante los creditos de DigitalOcean: ~$1.
- Inversion inicial: ~40 horas de desarrollo y despliegue x $6 = $240 (una sola vez).

Calculo:

```text
Horas ahorradas al mes  = 16 x 4.33            = 69.3 h
Ahorro mensual          = 69.3 x $6            = $415.80
Costo mensual sistema   =                        $25.00
Beneficio neto mensual  = 415.80 - 25.00       = $390.80
ROI mensual             = 390.80 / 25 x 100    = 1,563%
Recuperacion inversion  = 240 / 390.80         = 0.61 meses (~3 semanas)
```

Incluso recortando los supuestos a la mitad (8 investigaciones/mes, hora a $3), el beneficio neto (~$79/mes) sigue superando con holgura el costo del sistema.

## 14. Analisis Economico

### 14.1 Costos

Tabla de costos de referencia (de `deploy/deploy_digitalocean.md`):

| Item | Costo/mes |
| --- | --- |
| Droplet 8 GB (con creditos este mes) | $48 -> $0 efectivo |
| Droplet 4 GB (regimen post-creditos) | $24 |
| Gemini API (Flash, uso personal) | < $1 |
| QuickChart, Wikipedia, DuckDNS, Vercel free | $0 |
| Google Workspace APIs (Gmail/Sheets) | $0 |
| Evolution API (open source) | $0 |

Notas: los $150 de creditos de DigitalOcean vencen en julio 2026, por lo que el primer periodo corre a costo efectivo ~$0 en infraestructura. La cuenta de Gemini es tier Pagado 1 (limite $250) con alertas de presupuesto; una investigacion completa con Flash cuesta centavos y el grounding tiene franja diaria gratuita amplia. No hay licencias de software: n8n self-hosted, Evolution API y Postgres son open source.

### 14.2 Beneficios

- Ahorro de ~69 horas al mes de trabajo de investigacion (seccion 13).
- Reduccion del riesgo reputacional: cero cifras sin fuente publicadas.
- Capacidad de produccion 4-5 veces mayor con el mismo tiempo disponible.
- Backlog de ideas que ya no se pierden y se refinan solas por WhatsApp.
- Activo de datos acumulativo (fuentes, evidencia, datasets) reutilizable en futuras piezas.
- Comunicacion y seguimiento sin esfuerzo (Gmail, WhatsApp, digest semanal).

## 15. Conclusiones

1. n8n permite automatizar un proceso intelectual completo: la investigacion en 3 fases con grounding, la clasificacion de evidencia y la entrega multicanal corren sin intervencion humana, y la persona se concentra en revisar y decidir.
2. La IA generativa aporta valor de negocio cuando se somete a reglas verificables: el playbook con reglas duras (no inventar, citar o marcar `requiere_verificacion`, no graficar sin fuente) convierte a Gemini de un riesgo de alucinaciones en un asistente auditable.
3. Guardar la metodologia en datos (`app_settings`) y no en los flujos hace al sistema mantenible: el estilo de investigacion se ajusta editando un registro, sin tocar los 4 workflows.
4. El proyecto es economicamente contundente: con $25/mes de costo total (o ~$1 durante los creditos), el ROI mensual supera el 1,500% bajo supuestos conservadores.
5. La arquitectura de produccion (Docker Compose, Caddy con HTTPS, Postgres, webhooks publicos) demuestra que lo aprendido en el curso escala de un n8n local a un servicio real en internet.

## 16. Recomendaciones

- Integrar fuentes de datos primarias por API directa (Our World in Data, bancos centrales, INE) como herramientas del flujo, ademas del grounding, para datasets mas ricos.
- Implementar RAG sobre las investigaciones pasadas (tablas `research_*`) para que cada investigacion nueva aproveche la evidencia ya verificada.
- Agregar publicacion automatica del articulo (blog via API, Google Docs/Drive) con paso de aprobacion humana previa.
- Incorporar un segundo modelo como verificador cruzado de los hechos marcados `requiere_verificacion`.
- Programar respaldos automaticos de Postgres (pg_dump a objeto de almacenamiento) ademas del snapshot del droplet.
- Al vencer los creditos, bajar el droplet a 4 GB ($24/mes) o evaluar snapshot + apagado si el uso es esporadico.
- Mantener revision humana obligatoria antes de publicar cualquier contenido con elementos `requiere_verificacion`.

## 17. Bibliografia

[1] n8n GmbH, "n8n Docs - Webhook node", https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/

[2] n8n GmbH, "n8n Docs - HTTP Request node", https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/

[3] n8n GmbH, "n8n Docs - Postgres node", https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.postgres/

[4] n8n GmbH, "n8n Docs - AI Agent node", https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/

[5] n8n GmbH, "n8n Docs - Docker Compose installation", https://docs.n8n.io/hosting/installation/server-setups/docker-compose/

[6] Google, "Gemini API - Grounding with Google Search", https://ai.google.dev/gemini-api/docs/google-search

[7] Google, "Gemini Developer API - Pricing", https://ai.google.dev/gemini-api/docs/pricing

[8] QuickChart, "QuickChart Documentation", https://quickchart.io/documentation/

[9] Evolution API, "Evolution API Documentation", https://doc.evolution-api.com/

[10] Docker Inc., "Docker Compose Documentation", https://docs.docker.com/compose/

[11] DigitalOcean, "Droplets Documentation", https://docs.digitalocean.com/products/droplets/

[12] Vercel, "Project Configuration - Rewrites", https://vercel.com/docs/rewrites

[13] PostgreSQL Global Development Group, "PostgreSQL 16 Documentation", https://www.postgresql.org/docs/16/

[14] Caddy, "Caddy Documentation - Automatic HTTPS", https://caddyserver.com/docs/automatic-https

## 18. Rubrica de Evaluacion

| Criterio | Puntaje | Como lo cubre el proyecto |
| --- | ---: | --- |
| Identificacion del problema empresarial | 10 | Proceso manual de 4-6 h por tema, sesgos y fuentes dudosas (secciones 4 y 7). |
| Justificacion de la automatizacion | 10 | Viabilidad tecnica/economica/operativa y ROI de 1,563% (secciones 8 y 13). |
| Diseno de la solucion | 15 | Arquitectura de 4 workflows, stack en droplet y modelo de datos de 7 tablas (secciones 9 y 10). |
| Implementacion funcional en n8n | 20 | 4 workflows JSON importables y desplegados en produccion; demo sin credenciales (seccion 11). |
| Integraciones externas | 15 | Gemini + grounding, Gmail, Google Sheets, Evolution API, QuickChart, Postgres. |
| Innovacion y creatividad | 10 | Investigacion en 3 fases con playbook editable en DB, reglas anti-alucinacion y graficos solo con cifras con fuente. |
| Analisis economico y ROI | 10 | Costos reales del deploy y calculo explicito de ROI (secciones 13 y 14). |
| Calidad del informe tecnico | 5 | Este informe (19 secciones), manuales, plan de pruebas y anexos. |
| Presentacion y defensa | 5 | `defensa_guion.md`, `checklist_defensa.md` y demo en vivo sin credenciales. |
| Total | 100 | Detalle por criterio en `matriz_rubrica.md`. |

## 19. Anexos

Disponibles en el paquete `researchflow/`:

- Workflows n8n (JSON importables): `n8n_workflow_research_production.json`, `n8n_workflow_ideas_whatsapp.json`, `n8n_workflow_weekly_digest.json`, `n8n_workflow_demo_import.json`.
- Esquema de datos: `database_schema_postgres.sql` (PostgreSQL, produccion).
- Metodologia: `playbook_investigacion.md` (version larga) y su version condensada cargada en `app_settings`.
- Arquitectura y decisiones de stack: `arquitectura_stack.md`.
- Landing page: `landing_page/` (index.html, script.js, styles.css, vercel.json con proxy).
- Despliegue: `deploy/` (docker-compose.yml, Caddyfile, .env.example, init-databases.sh, deploy_digitalocean.md).
- Manuales: `manual_tecnico.md`, `manual_usuario.md`.
- Pruebas: `plan_pruebas.md`, `test_data/` (sample_request.json, sample_demo_response.json).
- Evaluacion: `matriz_rubrica.md`, `anexos_evidencias.md` (capturas pendientes de tomar en la demo).
- Defensa: `defensa_guion.md`, `checklist_defensa.md`.
- Fuentes: `fuentes_consultadas.md`.
