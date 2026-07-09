# Checklist operativo pre-defensa - ResearchFlow v2

Dos pasadas: la tarde/noche anterior (verificacion completa) y la hora previa (sanity check rapido). Si algo falla en la hora previa, activar el plan B (workflow demo + capturas) sin dudar.

## A. El dia antes

### Infraestructura

- [ ] Droplet arriba: `ssh root@IP` responde y `docker compose ps` muestra los 5 servicios (caddy, postgres, redis, n8n, evolution) en running/healthy.
- [ ] HTTPS ok: `https://n8n.TU-DOMINIO` y `https://evo.TU-DOMINIO/manager` cargan sin advertencia de certificado.
- [ ] Snapshot reciente del droplet tomado en DigitalOcean (respaldo ante desastre).
- [ ] Backup fresco: `pg_dump` de las bases `researchflow` y `n8n` descargado a la PC.

### n8n y credenciales

- [ ] Los 4 workflows importados y con el toggle **Active** encendido (investigacion, ideas WhatsApp, digest, demo).
- [ ] Sin placeholders vivos: buscar `REPLACE_WITH_` en los nodos de los workflows activos; no debe quedar ninguno.
- [ ] Credencial Postgres conecta (abrir un nodo Postgres y hacer un test).
- [ ] Credencial Gmail OAuth2 valida: enviar un correo de prueba (ejecutar la rama de preguntas con un tema trivial).
- [ ] Credencial Google Sheets valida y spreadsheet accesible con hoja `datasets`.
- [ ] Key de Gemini activa: una ejecucion de prueba completa sin 403/429; presupuesto de Google Cloud sin alertas.

### WhatsApp

- [ ] Evolution Manager: instancia `researchflow` en estado conectado; si aparece desconectada, re-escanear el QR.
- [ ] Webhook de la instancia apuntando a `https://n8n.TU-DOMINIO/webhook/researchflow-whatsapp` con evento `MESSAGES_UPSERT`.
- [ ] Prueba real: mandar "hola" y una idea vaga desde el telefono personal; el agente responde; `ideas` lista el backlog.
- [ ] Telefono del numero secundario cargado y con internet (WhatsApp se desconecta si el telefono muere).

### Landing

- [ ] Landing desplegada en Vercel y cargando en el dominio publico.
- [ ] `vercel.json` con el dominio real (sin `REPLACE_WITH_N8N_DOMAIN`).
- [ ] Envio de prueba sin pregunta: aparecen preguntas en pantalla y llega el correo.
- [ ] Envio de prueba con pregunta: respuesta "en curso" inmediata y articulo en el correo en menos de 10 minutos, con grafico si hubo cifras.

### Datos y demo

- [ ] Datos de prueba limpios: borrar solicitudes/ideas basura de los ensayos (`DELETE` selectivo o dejar solo ejemplos presentables); el backlog debe tener 2-3 ideas decentes para el comando `ideas`.
- [ ] Ejecuciones verdes recientes visibles en Executions (se muestran en la defensa si algo falla en vivo).
- [ ] Plan B listo: workflow demo activo y probado desde la landing (`/api/demo`), y capturas de `anexos_evidencias.md` completas y ordenadas en una carpeta abierta.
- [ ] Guion ensayado con cronometro (`defensa_guion.md`): la demo cabe en 4 minutos.

## B. Una hora antes

- [ ] `docker compose ps`: 5 servicios arriba.
- [ ] Abrir y dejar listas las pestanas: landing, n8n (Workflows + Executions), Gmail, spreadsheet, Evolution Manager, WhatsApp Web con el chat del bot.
- [ ] Terminal con sesion ssh abierta y psql listo (`docker compose exec postgres psql -U postgres -d researchflow`).
- [ ] Enviar una solicitud de calentamiento con pregunta desde la landing: confirma Gemini, Gmail, Sheets y WhatsApp en una sola pasada; ademas deja una ejecucion verde fresca para mostrar.
- [ ] WhatsApp: instancia sigue conectada; mandar un "ping" con el comando `ideas`.
- [ ] Silenciar notificaciones personales del equipo; cerrar pestanas ajenas a la demo.
- [ ] Carpeta de capturas (plan B) abierta en segundo plano.
- [ ] Agua, cargador, y el numero de solicitud de la prueba de calentamiento anotado por si el tribunal quiere trazabilidad en Postgres.

## C. Criterio go / no-go para la demo en vivo

Hacer la demo en vivo solo si en la hora previa pasaron: la solicitud de calentamiento (correo recibido) y el ping de WhatsApp. Si fallo cualquiera de los dos, abrir la defensa con el workflow demo y las capturas, y mencionar que el sistema completo esta documentado en el informe, los manuales y la matriz de rubrica.
