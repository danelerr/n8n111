# ResearchFlow - Documentacion operativa

Esta es la unica guia de uso, arquitectura, configuracion, mantenimiento y pruebas del proyecto.
El sistema esta desplegado y la base estable son los cuatro workflows actuales.

## 1. Produccion

| Recurso | Valor |
| --- | --- |
| n8n 2.30.6 | `https://n8n.camba.tech` |
| Simulador de chat | `https://chat.camba.tech` |
| Evolution API | `https://evo.camba.tech` |
| Servidor | Droplet DigitalOcean, Ubuntu 24.04 |
| Ruta remota | `/opt/researchflow/deploy` |
| Acceso SSH | Ver `deploy/SERVER_ACCESS.md` |

## 2. Arquitectura

```text
Landing Vercel / WhatsApp / simulador
              |
              v
        n8n - 4 workflows
        |       |       |
     Gemini  Postgres  Gmail / Sheets / QuickChart / Evolution
              |
       Caddy + Docker en DigitalOcean
```

Servicios definidos en `deploy/docker-compose.yml`:

| Servicio | Funcion |
| --- | --- |
| Caddy | HTTPS y proxy para `n8n`, `evo` y `chat` |
| n8n | Orquestacion de los workflows |
| PostgreSQL 16 | Bases `n8n`, `researchflow` y `evolution` |
| Redis 7 | Cache de Evolution API |
| Evolution API | Integracion con WhatsApp |
| Simulador | Interfaz de chat que usa el mismo flujo conversacional |

La interfaz vive en `chat/`, usa `slot-text` para estados y etiquetas animadas, y se
compila como archivos estaticos que sirve `simulador_whatsapp.py`:

```bash
cd chat
pnpm install
pnpm build
```

Docker monta `chat/dist` en el contenedor. El archivo Python no contiene claves: recibe
Gemini, propietario y webhook mediante las variables de `deploy/.env`.

Workflows versionados:

| Archivo | Funcion | Disparo |
| --- | --- | --- |
| `n8n_workflow_research_production.json` | Investigacion V3 con verificacion adversarial y generacion de preguntas | `POST /webhook/researchflow` |
| `n8n_workflow_ideas_whatsapp.json` | Captura, refinado y lanzamiento de ideas | `POST /webhook/researchflow-whatsapp` |
| `n8n_workflow_weekly_digest.json` | Resumen semanal del backlog | Lunes 08:00 |
| `n8n_workflow_demo_import.json` | Demostracion sin credenciales externas | `POST /webhook/researchflow-demo` |
| `n8n_workflow_research_v3_candidate.json` | Artefacto reproducible de staging; archivado en n8n | No publicado |

## 3. Uso

### Landing

- Con tema y sin pregunta: propone entre 3 y 5 preguntas, las muestra, las envia por correo y guarda la idea.
- Con tema y pregunta: responde inmediatamente con un `request_id`; luego investiga en tres fases y entrega el articulo por Gmail. Si hay numero configurado, tambien envia aviso por WhatsApp.

### WhatsApp o simulador

- Un mensaje libre crea o refina una idea.
- `ideas` muestra el backlog numerado.
- `investigar N` lanza la investigacion de la idea N.
- Los mensajes propios y los grupos se ignoran.

### Digest

Cada lunes a las 08:00 resume las ideas pendientes y envia el resultado por Gmail y WhatsApp.

### Lectura del resultado

El articulo separa hechos, hipotesis y opiniones. Toda cifra debe tener una fuente asociada; si no existe evidencia numerica suficiente, el sistema no genera grafico. Los elementos `requiere_verificacion` deben revisarse antes de publicar.

## 4. Configuracion

El archivo real `deploy/.env` no se versiona. Su plantilla es `deploy/.env.example`.

| Variable | Uso |
| --- | --- |
| `DOMAIN` | Dominio base de Caddy y n8n |
| `TZ` | Zona horaria |
| `POSTGRES_PASSWORD` | Bases de n8n, ResearchFlow y Evolution |
| `N8N_ENCRYPTION_KEY` | Cifrado de credenciales de n8n; no cambiar sin respaldo |
| `GEMINI_API_KEY` | Nodos HTTP de Gemini |
| `EVOLUTION_API_KEY` | Evolution API y nodos que envian mensajes |
| `GOOGLE_SHEET_ID` | Spreadsheet con hoja `datasets` |
| `OWNER_NAME` | Nombre del propietario |
| `OWNER_EMAIL` | Destino del digest y lanzamientos desde ideas |
| `OWNER_WHATSAPP` | Numero internacional sin `+` |

Credenciales que se crean dentro de n8n:

- Postgres: host `postgres`, puerto `5432`, base `researchflow`, usuario `postgres`.
- Gmail OAuth2.
- Google Sheets OAuth2.
- Google Gemini para el modelo del AI Agent.

Las claves no deben copiarse a los JSON ni a esta documentacion.

## 5. Datos y metodologia

`database_schema_postgres.sql` crea siete tablas:

- `research_requests`: solicitud y estado general.
- `research_sources`: fuentes encontradas.
- `research_evidence`: hechos, hipotesis y opiniones.
- `research_artifacts`: articulos y otros entregables.
- `research_ideas`: backlog conversacional.
- `research_datasets`: cifras, fuentes y graficos.
- `app_settings`: configuracion editable.

La metodologia activa vive en `app_settings`, con la clave `playbook_investigacion`. El SQL incluye la semilla canonica. Para cambiarla sin editar workflows:

```sql
UPDATE app_settings
SET value = 'NUEVA METODOLOGIA', updated_at = NOW()
WHERE key = 'playbook_investigacion';
```

Principios del playbook:

1. Entender primero el encargo y formular preguntas comprobables.
2. Empezar con contexto general y vocabulario tecnico.
3. Priorizar fuentes primarias, datos oficiales e investigacion original.
4. Profundizar con causas, incentivos y los cinco porques cuando aplique.
5. Separar hechos, hipotesis y opiniones.
6. No inventar fuentes ni cifras.
7. No graficar un punto sin `fuente_url`.
8. Explicitar contradicciones y vacios de informacion.

Si el registro falta, el workflow usa un fallback minimo para no detenerse.

## 6. Operacion del servidor

Conectarse usando `deploy/SERVER_ACCESS.md` y entrar a la ruta del despliegue:

```bash
cd /opt/researchflow/deploy
docker compose ps
docker compose logs --tail=100 n8n
docker compose logs --tail=100 evolution
docker compose logs --tail=100 caddy
```

Aplicar cambios de infraestructura:

```bash
docker compose config --quiet
docker compose up -d
docker compose ps
```

n8n esta fijado en la imagen `2.30.6`; no se usa `latest`. La API publica y la
telemetria estan deshabilitadas. Las ejecuciones se conservan durante 14 dias o hasta
un maximo de 10 000 registros, lo que ocurra primero.

Cargar o restaurar el esquema de la aplicacion:

```bash
docker compose exec -T postgres psql -U postgres -d researchflow < /opt/researchflow/database_schema_postgres.sql
```

Backups:

```bash
docker compose exec -T postgres pg_dump -U postgres researchflow > backup_researchflow.sql
docker compose exec -T postgres pg_dump -U postgres n8n > backup_n8n.sql
```

Tomar snapshot del droplet antes de cambios grandes. La `N8N_ENCRYPTION_KEY` debe conservarse junto con el backup; sin ella no se pueden descifrar las credenciales guardadas.

## 7. Verificacion

Antes de desplegar un cambio:

1. Validar que los cuatro JSON abren correctamente.
2. Verificar las conexiones y el codigo de los nodos.
3. Ejecutar `docker compose config --quiet`.
4. Probar la landing sin pregunta.
5. Probar una investigacion completa con pregunta.
6. Probar `ideas` e `investigar N`.
7. Ejecutar manualmente el digest.
8. Confirmar correo, registros Postgres, filas de Sheets y aviso por WhatsApp.

Validacion especifica del candidato V3:

```bash
node scripts/build_v3_candidate.mjs
node scripts/validate_v3.mjs
```

El validador ejecuta los nodos Code relevantes con fixtures locales; no llama Gemini,
no escribe en Postgres y no envia correo ni WhatsApp. Las entregas externas permanecen
deshabilitadas dentro del JSON candidato.

Datos de prueba disponibles en `test_data/`.

## 8. Problemas frecuentes

| Sintoma | Revision |
| --- | --- |
| Webhook 404 | Workflow activo y URL `/webhook/`, no `/webhook-test/` |
| Gemini 400/401/403/429 | `GEMINI_API_KEY`, modelo, facturacion y cuota |
| WhatsApp no responde | Instancia Evolution conectada y webhook `MESSAGES_UPSERT` |
| Gmail no entrega | Credencial OAuth, spam y correo del destinatario |
| Sheets falla | `GOOGLE_SHEET_ID`, hoja `datasets` y permisos OAuth |
| Landing no conecta | Rewrite de Vercel, DNS y estado de n8n |
| HTTPS falla | DNS, puertos 80/443 y logs de Caddy |
| Falta el playbook | Reaplicar la semilla de `database_schema_postgres.sql` |

## 9. Propuesta v3

`CAMBIOS_v3.md` documenta el desarrollo y el registro de despliegue. Ya se completaron
el backup, la migracion idempotente, la importacion aislada, la prueba del fallback y
la promocion sobre el workflow estable. La clave de Gemini fue rotada y sincronizada con
el entorno y la credencial interna de n8n. La prueba real termino en
`completado_v3_auditado`, con auditoria completa, puntaje 80, informe, artifact y evidencia
persistida. El registro controlado fue eliminado despues.

Durante la prueba se elimino `responseMimeType` del auditor porque Gemini no lo admite
junto con Google Search grounding, y se aplico
`deploy/migrations/004_evidence_support_text.sql` para conservar URLs de soporte completas.

Para continuar:

1. reconectar la credencial Gmail OAuth2 en n8n;
2. volver a vincular la instancia `researchflow` de Evolution mediante QR;
3. ejecutar una investigacion que produzca datasets numericos verificados para comprobar
   la escritura final en Google Sheets.

El workflow estable ya es la V3. Ante una regresion, restaurar
`/opt/researchflow/backups/promotion-v3-20260716T203527Z/workflow-pre-v3.json`.
