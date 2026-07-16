# Guion de defensa - ResearchFlow v2 (~10 minutos)

Alineado a la rubrica: problema, solucion tecnica, demo funcional, integraciones, innovacion, analisis economico y cierre.

## Minuto 0-1: El problema (1 min)

"Mi proyecto se llama ResearchFlow. El problema que ataco es doble. Primero: investigar bien un tema toma una hora o mas entre buscar fuentes, contrastarlas, ordenar datos y redactar; por eso la mayoria de las ideas se quedan sin investigar. Segundo: cuando se le pide a una IA que investigue, el riesgo es que invente cifras y fuentes con total confianza. ResearchFlow automatiza la investigacion completa con n8n, pero con reglas duras anti-alucinacion: toda cifra lleva fuente o no se publica."

## Minuto 1-3: Solucion y arquitectura (2 min)

Mostrar el diagrama / los workflows en n8n mientras se explica:

- "Todo corre en un droplet de DigitalOcean con Docker: Caddy con HTTPS, n8n, Postgres, Redis y Evolution API para WhatsApp. La landing esta en Vercel y llega a n8n por un proxy sin CORS."
- "Son 4 workflows: **Investigacion profunda** (webhook desde la landing: registra en Postgres, carga la metodologia desde la base, y corre 4 fases con Gemini 2.5 Flash usando Google Search grounding: base del tema, profundizacion con los 5 porques y datos numericos con fuente, sintesis en JSON estricto, y una **verificacion adversarial** que vuelve a auditar hechos y cifras y le pone un puntaje de confianza al informe; despues genera graficos con QuickChart, guarda evidencia en 5 tablas, envia el articulo por Gmail con su badge de confianza, avisa por WhatsApp y registra los datos en Google Sheets). **Ideas por WhatsApp** (un agente conversacional con memoria que refina ideas vagas y comandos `ideas` e `investigar N`). **Digest semanal** (cada lunes resume el backlog). Y un **Demo sin credenciales** como plan B."
- "Integraciones externas: Gemini API con grounding, Postgres, Gmail, Google Sheets, Evolution API/WhatsApp y QuickChart. Mas que las tres exigidas."

## Minuto 3-7: Demo en vivo (4 min)

Preparacion previa: landing abierta, WhatsApp Web con el chat del bot, pestana de Gmail, pestana del spreadsheet, terminal con psql listo (ver `checklist_defensa.md`).

1. **Landing sin pregunta (~1 min):** enviar solo un tema (ej. "adopcion de criptomonedas en Bolivia"). Mostrar en pantalla las 3-5 preguntas generadas con su razon de interes. "El sistema no investiga a ciegas: si no hay pregunta, primero propone preguntas investigables. Tambien llegaron a mi correo."
2. **Landing con pregunta (~1.5 min):** pegar una de las preguntas y reenviar. Mostrar la respuesta inmediata "en curso" con numero de solicitud. "La investigacion corre en segundo plano; mientras, les muestro WhatsApp." (El correo llegara durante la demo; abrirlo al final del bloque: articulo con hechos citados, grafico con fuente y preguntas abiertas.)
3. **WhatsApp (~1 min):** mandar una idea vaga ("algo sobre el litio y el empleo"). Mostrar como el agente la refina y propone preguntas numeradas. Enviar `ideas` para ver el backlog. Enviar `investigar N` y mostrar la confirmacion. "Cualquier idea que se me ocurra en la calle queda capturada y lista para investigarse con un comando."
4. **Persistencia (~0.5 min):** mostrar la hoja `datasets` de Google Sheets con una fila por dato y su fuente, y un SELECT rapido en Postgres (`research_requests`, `research_evidence`) mostrando hechos vs hipotesis.

## Minuto 7-8: Innovacion (1 min)

- "**Playbook editable en base de datos**: mi metodologia de investigacion vive en la tabla `app_settings`. Con un UPDATE cambio como investiga el sistema, sin tocar los workflows. Es configuracion, no codigo."
- "**Reglas anti-alucinacion**: el prompt exige clasificar cada afirmacion como hecho con fuente, hipotesis que requiere verificacion, u opinion atribuida. Y solo se grafican cifras reales con fuente pegada al dato: si no hay cifras confiables, no hay grafico, y el articulo lo dice. Prefiero un informe honesto a uno bonito."
- "**Verificacion adversarial (auto-critica)**: no me quedo con lo que el modelo escribio. Una cuarta fase actua de revisor hostil: vuelve a buscar en la web para comprobar los hechos y cifras clave, detecta contradicciones, y le pone al informe un puntaje de confianza de 0 a 100 que viaja con cada entregable. Asi el usuario sabe cuanto fiarse antes de leerlo." (Mostrar el badge de confianza en el correo o en la landing con el demo.)
- "**Backlog conversacional**: las ideas no se pierden; se refinan por WhatsApp, se acumulan y un digest semanal me las recuerda."

## Minuto 8-9: Economia y ROI (1 min)

- "Costos reales: el droplet esta cubierto este mes por creditos de DigitalOcean (luego ~$24/mes, o menos reduciendo tamano); Gemini Flash cuesta centavos por investigacion, menos de $1 al mes de uso personal; QuickChart, DuckDNS, Vercel, Evolution API y las APIs de Google son gratis. Con alerta de presupuesto configurada en Google Cloud."
- "Una investigacion inicial manual toma cerca de 60 minutos; con ResearchFlow mi intervencion baja a minutos: escribir la pregunta y leer el resultado. Con 20 investigaciones al mes se liberan mas de 17 horas; contra un costo operativo de decenas de bolivianos, el retorno es de varios cientos por ciento el primer mes." (Cifras detalladas en `informe_final.md`.)

## Minuto 9-10: Cierre (1 min)

"ResearchFlow demuestra un proceso de conocimiento completo automatizado con n8n: captura por web y WhatsApp, investigacion con IA y busqueda real, evidencia trazable en Postgres y Sheets, y entrega por Gmail y WhatsApp; con la honestidad intelectual como requisito de diseno, no como promesa. Como siguientes pasos: revision humana antes de publicar, exportar a Google Drive y mas fuentes primarias conectadas. Gracias; preguntas."

## Plan B si falla el vivo

Orden de degradacion:

1. **Falla Gemini/credenciales/internet del droplet:** usar el workflow "ResearchFlow - Demo sin credenciales" (`/webhook/researchflow-demo`): la landing funciona igual y muestra un informe simulado con grafico QuickChart real. Decir de forma explicita que es el modo demo.
2. **Falla el droplet completo:** demo con capturas preparadas segun `anexos_evidencias.md`: ejecucion verde de cada workflow, correo con articulo y grafico, conversacion de WhatsApp, Sheets y tablas Postgres. Narrar el flujo sobre las capturas.
3. **Falla WhatsApp solamente:** saltar el bloque 3 de la demo y mostrar la conversacion en las capturas; el resto de la demo no depende de Evolution.

Regla de oro: nunca improvisar credenciales en vivo. Todo queda configurado y probado la noche anterior (ver `checklist_defensa.md`).

## Preguntas probables del tribunal

| Pregunta | Respuesta corta |
| --- | --- |
| Como evitas que la IA invente datos? | Reglas duras en el prompt + clasificacion hecho/hipotesis/opinion + solo se grafican cifras con fuente + fases con Google Search grounding que citan fuentes reales. |
| Que pasa si Gemini falla? | La ejecucion termina de forma controlada, la solicitud queda con estado de error en Postgres y el cliente recibe respuesta valida; ademas existe el workflow demo. |
| Por que Postgres y no solo Sheets? | Trazabilidad relacional (solicitud -> fuentes -> evidencia -> datasets -> articulo) y configuracion viva (playbook en `app_settings`); Sheets queda como vista de datos para el usuario. |
| Cuanto cuesta operarlo? | Menos de $1/mes en IA; el droplet es el unico costo fijo (~$24/mes post-creditos) y puede apagarse conservando un snapshot. |
| Es escalable? | Si: n8n en Docker escala vertical, Redis ya esta en el stack para colas de Evolution, y el diseno por webhooks permite separar servicios. |
