# Cambios v3 - Verificacion adversarial y puntaje de confianza

Registro del salto **v2 -> v3** de ResearchFlow y guia para aplicarlo. La v3 NO agrega
un quinto workflow: refuerza el flujo de investigacion existente con una 4a fase de
auto-verificacion. Siguen siendo **4 workflows**.

## 1. Que cambio (resumen)

| Area | v2 | v3 |
| --- | --- | --- |
| Fases de investigacion | 3 (base, profundizacion, sintesis) | **4** (+ verificacion adversarial) |
| Confianza del informe | no existia | **puntaje 0-100 + nivel (alto/medio/bajo) + veredicto** en cada entregable |
| Tablas Postgres | 7 | **8** (nueva `research_verifications`) + 3 columnas en `research_requests` |
| Email / articulo | markdown->HTML basico (listas rotas) | render robusto + **badge de confianza** + seccion "Verificacion y confianza" |
| Robustez | sin reintentos; auto-llamada WhatsApp con `localhost` cableado | `retryOnFail` en las llamadas Gemini; auto-llamada configurable por `RF_WEBHOOK_BASE` |

### 1.1 Nodos nuevos (workflow "ResearchFlow - Investigacion profunda")

Se insertaron **2 nodos** entre la sintesis y el procesamiento:

- **`Preparar verificacion`** (Code): arma el prompt de auditoria adversarial sobre la
  sintesis (hechos declarados, cifras graficadas y citas web disponibles).
- **`Gemini - Verificacion`** (HTTP Request, con Google Search grounding): actua como
  revisor hostil. Re-comprueba en la web los hechos y cifras clave, marca cada hecho como
  `verificado / dudoso / sin_fuente / reclasificar_hipotesis`, detecta contradicciones y
  devuelve un JSON con `puntaje_calidad`, `nivel_confianza`, `veredicto`, `senales_alerta`
  y `limitaciones`.

El nodo **`Procesar resultado`** se reescribio para integrar esa verificacion: calcula el
puntaje (con fallback si la API falla), lo mete en el badge del correo, en el articulo y en
la base, y persiste una fila en `research_verifications`.

```
Webhook -> Normalizar -> Postgres (registro) -> Postgres (playbook) -> IF con pregunta
  [CON pregunta] -> Responder en proceso
     -> Preparar fase base       -> Gemini - Fase base con busqueda (grounding)
     -> Preparar profundizacion  -> Gemini - Profundizar con busqueda (grounding)
     -> Preparar sintesis        -> Gemini - Sintesis estructurada (JSON)
     -> Preparar verificacion    -> Gemini - Verificacion (grounding)   <-- NUEVO (Fase 4)
     -> Procesar resultado -> Postgres evidencia -> Gmail -> WhatsApp -> Postgres update -> Sheets
```

## 2. Como aplicarlo (3 pasos)

> No se crea ningun workflow nuevo. Se actualiza el que ya existe y se migra la base.

### Paso 1 - Base de datos (migracion idempotente)

Vuelve a ejecutar `database_schema_postgres.sql` completo (todo usa `IF NOT EXISTS`, no
rompe nada existente), o solo la parte nueva:

```sql
CREATE TABLE IF NOT EXISTS research_verifications (
  id SERIAL PRIMARY KEY,
  request_id INT REFERENCES research_requests(id),
  puntaje_calidad INT,
  nivel_confianza VARCHAR(20),
  veredicto TEXT,
  senales_alerta TEXT,
  contradicciones TEXT,
  limitaciones TEXT,
  hechos_auditados TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS puntaje_calidad INT;
ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS nivel_confianza VARCHAR(20);
ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS veredicto TEXT;
```

En el stack Docker: `docker compose exec -T postgres psql -U postgres -d researchflow < database_schema_postgres.sql`.

(Opcional) Para actualizar tambien el playbook con la Fase 6 en una base ya sembrada,
como `ON CONFLICT DO NOTHING` no la sobrescribe, corre el UPDATE del playbook a mano:
`UPDATE app_settings SET value = '...texto nuevo...' WHERE key='playbook_investigacion';`.

### Paso 2 - Workflow en n8n

Elige UNA opcion segun tu situacion:

- **Aun no lo tenias importado / lo importas limpio (recomendado):** importa
  `n8n_workflow_research_production.json` (y `n8n_workflow_demo_import.json`) como siempre.
  Ya trae los 2 nodos nuevos. No hay nada especial que hacer.

- **Ya lo tenias importado y configurado con credenciales:** para no reasignar todo,
  puedes:
  - a) Borrar el workflow viejo y reimportar el actualizado (rapido; hay que reasignar
    las credenciales Postgres/Gmail/Sheets del workflow), **o**
  - b) Agregar los 2 nodos a mano en el workflow existente y conectarlos como en el
    diagrama de arriba (Sintesis -> Preparar verificacion -> Gemini - Verificacion ->
    Procesar resultado). Copia los nodos desde el JSON nuevo.

> Nota: importar en n8n normalmente crea el workflow; si quieres reemplazar el existente,
> abrelo, borralo y reimporta, o pega los nodos nuevos. Las credenciales viven en n8n
> (no en el JSON), por eso siempre se reasignan tras un import.

### Paso 3 - Credencial del nodo nuevo

El nodo **`Gemini - Verificacion`** usa el mismo placeholder que los demas Gemini:
reemplaza `REPLACE_WITH_GEMINI_API_KEY` por tu API key de AI Studio (la misma de las otras
fases). Nada mas.

(Opcional) Para el auto-llamado del flujo de ideas por WhatsApp puedes fijar en el `.env`
`RF_WEBHOOK_BASE=https://n8n.TU-DOMINIO`; si no lo pones, usa `http://localhost:5678`.

## 3. Como verificar que quedo bien

1. Lanza una investigacion con pregunta (payload de `test_data/sample_request.json`).
2. En la ejecucion de n8n revisa la salida de **`Gemini - Verificacion`**: debe traer
   `puntaje_calidad`, `nivel_confianza` y `veredicto`.
3. En el correo debe verse el **badge de confianza** (ej. "Confianza ALTO - 78/100") y la
   seccion "Verificacion y confianza".
4. En la base:
   ```sql
   SELECT id, estado, puntaje_calidad, nivel_confianza FROM research_requests ORDER BY id DESC LIMIT 1;
   SELECT * FROM research_verifications ORDER BY id DESC LIMIT 1;
   ```
5. Caso de fallo controlado: si la API de Gemini falla, la ejecucion NO se cuelga
   (`continueOnFail` + reintentos) y el puntaje cae a una estimacion por cobertura de
   fuentes. Ver caso **PU-11** en `plan_pruebas.md`.

## 4. Archivos tocados en v3

- Workflows: `n8n_workflow_research_production.json` (2 nodos + reescritura de "Procesar
  resultado" + reintentos), `n8n_workflow_ideas_whatsapp.json` (fix `localhost` ->
  `RF_WEBHOOK_BASE` + reintento), `n8n_workflow_demo_import.json` (puntaje en la respuesta).
- Datos: `database_schema_postgres.sql` (tabla + columnas + Fase 6 del playbook).
- Deploy: `deploy/docker-compose.yml` y `deploy/.env.example` (`RF_WEBHOOK_BASE`,
  `N8N_BLOCK_ENV_ACCESS_IN_NODE`).
- Landing: `landing_page/` (fases actualizadas, badge de confianza, estilos).
- Docs: README, INDICE_ENTREGA, informe_final, manual_tecnico, manual_usuario,
  plan_pruebas (PU-11), matriz_rubrica, arquitectura_stack, defensa_guion,
  anexos_evidencias, playbook_investigacion, fuentes_consultadas; PDF regenerado.
