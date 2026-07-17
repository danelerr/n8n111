# Propuesta v3 - Verificacion adversarial adaptada a ResearchFlow

Estado: **V3 promovida a produccion sobre el ID y webhook estables**.

Esta implementacion parte de la version funcional conocida de ResearchFlow (4 workflows,
configuracion sensible mediante `deploy/.env`, auto-llamada por
`RESEARCH_WEBHOOK_URL` y despliegue actual en DigitalOcean). El 16 de julio de 2026 se respaldaron ambas bases y los workflows, se
aplico dos veces la migracion idempotente, se importo el candidato y se ejecuto una
prueba controlada. La V3 sustituyo despues a la V2 en `TMQnnUSlrZxe7z5C` y atiende
`/webhook/researchflow`. El candidato y el duplicado antiguo quedaron archivados.

La clave de Gemini fue sustituida, validada contra el API y sincronizada con el entorno y
la credencial `googlePalmApi` de n8n. Una ejecucion real termino en
`completado_v3_auditado`: auditoria `completa`, puntaje 80, nivel `medio`, informe,
artifact y 12 evidencias persistidas. La solicitud controlada se elimino despues de la
verificacion.

La prueba tambien corrigio dos problemas de integracion: Gemini no admite combinar
Google Search grounding con `responseMimeType: application/json`, y las URLs de soporte
podian superar el antiguo `VARCHAR(80)`. El auditor conserva grounding, exige JSON en el
prompt y lo valida en el nodo siguiente; `research_evidence.soporte` ahora es `TEXT`.
Evolution sigue requiriendo volver a vincular el telefono y la credencial OAuth de Gmail
debe reconectarse. Ninguno de esos dos pendientes afecta a Gemini ni a la persistencia.

Artefactos implementados:

- `n8n_workflow_research_v3_candidate.json`: candidato inactivo con webhook aislado;
- `deploy/migrations/003_verificacion_adversarial.sql`: migracion aditiva e idempotente;
- `deploy/migrations/004_evidence_support_text.sql`: conserva URLs completas de evidencia;
- `test_data/v3_audit_fixtures.json`: casos validos, adversariales y de fallo;
- `scripts/build_v3_candidate.mjs`: generador reproducible desde el workflow estable;
- `scripts/validate_v3.mjs`: validacion de conexiones, contratos y reconciliacion.

El export publicado esta en
`/opt/researchflow/v3/n8n_workflow_research_v3_promoted.json`. El backup inmediatamente
anterior al corte esta en
`/opt/researchflow/backups/promotion-v3-20260716T203527Z`.

## 1. Problema que busca resolver

La version actual separa hechos, hipotesis y opiniones, exige fuente por cifra y omite
graficos sin datos respaldados. Aun asi, la sintesis final depende de que el mismo modelo:

- interprete correctamente los hallazgos de las fases anteriores;
- no convierta una interpretacion en hecho;
- copie la cifra y la URL correctas;
- detecte contradicciones entre fuentes;
- no sobrestime la calidad de su propia respuesta.

La v3 propone una fase posterior de auditoria que vuelva a consultar la web y revise
cada afirmacion y dato antes de entregar el articulo.

## 2. Principios de la propuesta

1. **La version funcional actual sigue siendo la fuente de verdad.** La v3 se construira
   primero como candidato separado y no se activara directamente sobre produccion.
2. **La auditoria debe cambiar el resultado, no solo decorarlo.** Un hecho marcado como
   dudoso no puede seguir apareciendo como "hecho verificado" ni guardarse con confianza
   alta.
3. **Sin auditoria no hay puntaje numerico.** Un fallo de Gemini debe producir
   `estado_verificacion = no_disponible`, nunca un 70/100 o 100/100 heuristico.
4. **El nivel se deriva del puntaje.** El modelo no puede devolver simultaneamente
   `20/100` y nivel `alto`.
5. **La evidencia del auditor tambien es trazable.** Las fuentes encontradas en la
   verificacion deben almacenarse, no quedar ocultas en la respuesta cruda de Gemini.
6. **No se reintroducen placeholders.** El nuevo nodo Gemini usara
   `={{ $env.GEMINI_API_KEY }}`, igual que los nodos existentes.
7. **No se duplica configuracion.** La auto-llamada de WhatsApp seguira usando
   `RESEARCH_WEBHOOK_URL`; no se agregara `RF_WEBHOOK_BASE`.
8. **El puntaje mide cobertura de verificacion, no probabilidad de verdad.** En la
   interfaz debe llamarse preferentemente "puntaje de verificacion".

## 3. Arquitectura propuesta

No se agrega un quinto workflow permanente. Durante staging existe un candidato separado;
cuando sea aprobado sustituira al workflow `ResearchFlow - Investigacion profunda`.
La rama con pregunta queda asi:

```text
Gemini - Sintesis estructurada
  -> Preparar verificacion
  -> IF - Sintesis auditable
     -> Gemini - Verificacion adversarial
     -> Validar auditoria
     -> IF - Auditoria valida
        -> Reconciliar auditoria
        -> o Marcar verificacion no disponible
  -> Procesar resultado
  -> Guardar verificacion
  -> persistencia y entregas existentes
```

Las rutas no auditables convergen en `Procesar resultado`, pero conservan estado
`no_disponible` o `no_aplicable` y puntaje nulo. Gmail, WhatsApp y Sheets estan
deshabilitados en el candidato hasta completar staging.

### 3.1 Preparar verificacion

Nodo Code que:

- parsea la sintesis estructurada;
- asigna identificadores estables a cada hecho (`H1`, `H2`, ...);
- asigna identificadores a datasets y puntos (`D1-P1`, `D1-P2`, ...);
- incluye las citas recogidas por las fases base y profundizacion;
- construye un prompt acotado para revisar hechos y cifras, no para reescribir el articulo.

La salida hacia el auditor debe usar identificadores, evitando reconciliar resultados por
coincidencia aproximada de texto.

### 3.2 Gemini - Verificacion adversarial

Nodo HTTP Request con Google Search grounding:

- API key: `={{ $env.GEMINI_API_KEY }}`;
- mismo modelo configurado actualmente, inicialmente Gemini 2.5 Flash;
- temperatura baja;
- timeout explicito;
- hasta 3 intentos con espera entre intentos;
- respuesta JSON con un contrato validable.

El API no permite `responseMimeType: application/json` cuando se usa Google Search. Por
eso el contrato se impone en el prompt y `Validar auditoria V3` extrae y valida el JSON.

Contrato propuesto:

```json
{
  "hechos": [
    {
      "id": "H1",
      "estado": "verificado|dudoso|sin_fuente|reclasificar_hipotesis",
      "nota": "Motivo breve",
      "fuentes": [
        {"titulo": "...", "url": "https://...", "tipo": "oficial|primaria|medio_investigacion|analisis|otro", "soporta": true}
      ]
    }
  ],
  "datos": [
    {
      "id": "D1-P1",
      "estado": "verificado|dudoso|sin_fuente",
      "nota": "Motivo breve",
      "fuentes": [
        {"titulo": "...", "url": "https://...", "tipo": "oficial|primaria|medio_investigacion|analisis|otro", "soporta": true}
      ]
    }
  ],
  "contradicciones": ["..."],
  "limitaciones": ["..."],
  "recomendaciones": ["..."]
}
```

El auditor no define directamente el puntaje final ni el nivel.

### 3.3 Validar y reconciliar auditoria

Nodo Code independiente. Su responsabilidad es validar la forma de la respuesta y aplicar
sus conclusiones:

- `verificado`: permanece en la seccion de hechos verificados;
- `dudoso` o `sin_fuente`: pasa a una seccion "Afirmaciones pendientes de verificacion";
- `reclasificar_hipotesis`: se mueve a hipotesis;
- un punto numerico no verificado se excluye de QuickChart y Google Sheets;
- las fuentes nuevas del auditor se agregan a la trazabilidad;
- las contradicciones y limitaciones se incorporan al articulo y al correo.

Si la respuesta no es JSON valido, esta incompleta o el nodo HTTP falla:

```text
estado_verificacion = no_disponible
puntaje_verificacion = null
nivel_verificacion = no_disponible
```

La investigacion puede entregarse, pero debe indicar claramente que no fue auditada. Esa
ruta debe quedar visible en la ejecucion; no basta con que todo aparezca verde mediante
`continueOnFail`.

### 3.4 Calculo del puntaje

El puntaje se calcula de forma determinista despues de reconciliar, usando solamente los
estados validados. La formula inicial 60/25/15 fue descartada porque mezclaba cobertura,
calidad de fuente y contradicciones en un unico numero.

Reglas obligatorias:

- sin respuesta valida del auditor: no hay puntaje;
- el resultado se limita a 0-100;
- `alto`, `medio` y `bajo` se derivan del numero con umbrales definidos en codigo;
- el correo explica que el valor representa cobertura de verificacion, no certeza absoluta.

Formula implementada:

- 70%: proporcion de hechos verificados;
- 30%: proporcion de puntos numericos verificados;
- si una categoria no existe, su peso se redistribuye;
- `alto`: 85-100, `medio`: 60-84, `bajo`: 0-59.

La calidad de fuentes se informa por separado y no altera el puntaje. Las
contradicciones se muestran como alertas independientes: una auditoria puede tener
cobertura alta y, al mismo tiempo, encontrar una contradiccion grave.

## 4. Persistencia implementada en el candidato

La migracion fue creada en:

`deploy/migrations/003_verificacion_adversarial.sql`

No se volvera a ejecutar el esquema completo ni se incluiran datos semilla en la migracion.

Resumen de la estructura creada:

```sql
ALTER TABLE research_requests
  ADD COLUMN IF NOT EXISTS estado_verificacion VARCHAR(30),
  ADD COLUMN IF NOT EXISTS puntaje_verificacion INT,
  ADD COLUMN IF NOT EXISTS nivel_verificacion VARCHAR(20),
  ADD COLUMN IF NOT EXISTS veredicto_verificacion TEXT;

CREATE TABLE IF NOT EXISTS research_verifications (
  id BIGSERIAL PRIMARY KEY,
  request_id INT NOT NULL REFERENCES research_requests(id) ON DELETE CASCADE,
  execution_id VARCHAR(120) NOT NULL,
  estado VARCHAR(30) NOT NULL,
  puntaje INT,
  nivel VARCHAR(20) NOT NULL,
  calidad_fuentes VARCHAR(20) NOT NULL,
  auditor_modelo VARCHAR(80),
  hechos_auditados JSONB NOT NULL DEFAULT '[]'::jsonb,
  datos_auditados JSONB NOT NULL DEFAULT '[]'::jsonb,
  fuentes_verificacion JSONB NOT NULL DEFAULT '[]'::jsonb,
  contradicciones JSONB NOT NULL DEFAULT '[]'::jsonb,
  limitaciones JSONB NOT NULL DEFAULT '[]'::jsonb,
  respuesta_cruda JSONB,
  respuesta_validada JSONB,
  veredicto TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (request_id, execution_id),
  CHECK (puntaje IS NULL OR puntaje BETWEEN 0 AND 100)
);
```

Se permiten varias auditorias por solicitud para conservar historial. La fila de
`research_requests` contiene solamente el estado y puntaje mas recientes.

## 5. Entregables y experiencia del usuario

### Correo

El correo puede mostrar:

- nivel y puntaje de verificacion, si existe auditoria valida;
- hechos verificados;
- afirmaciones pendientes o reclasificadas;
- contradicciones y limitaciones;
- graficos construidos solo con puntos admitidos por la auditoria.

Si la auditoria falla, el badge debe decir "Verificacion no disponible" y no mostrar un
numero.

### WhatsApp

El aviso final puede incluir el nivel o indicar que la verificacion no estuvo disponible.
No se modifica el workflow de ideas ni su variable `RESEARCH_WEBHOOK_URL` para implementar
esta fase.

### Landing

La landing de produccion recibe una respuesta inmediata "en proceso"; actualmente no
recibe el resultado final. Por eso la primera iteracion no debe afirmar que mostrara el
puntaje final en pantalla. El badge puede mostrarse en el workflow demo.

Mostrar el resultado final en la landing requeriria una mejora posterior: endpoint de
estado por `request_id` y polling o actualizacion en tiempo real.

## 6. Estrategia de implementacion segura

1. [x] Exportar y respaldar el workflow y la base actuales.
2. [x] Regenerar y validar el candidato con `node scripts/build_v3_candidate.mjs` y
   `node scripts/validate_v3.mjs`.
3. [x] Aplicar la migracion sobre produccion y ejecutarla dos veces.
4. [x] Importar el candidato con webhook aislado y credenciales preservadas.
5. [x] Ejecutar pruebas con respuestas Gemini simuladas, sin efectos externos.
6. [x] Probar el webhook `researchflow-v3-candidate` con datos controlados y comprobar
   el fallback y la persistencia; el registro de ensayo fue eliminado despues.
7. [x] Sustituir la clave de Gemini reportada como filtrada y repetir la prueba hasta
   obtener sintesis y auditoria validas.
8. [ ] Volver a vincular Evolution y reconectar Gmail OAuth antes de probar ambos avisos.
9. [x] Ejecutar una investigacion real con auditoria valida y persistencia completa.
   Google Sheets queda pendiente de una prueba que produzca datasets numericos verificados.
10. [x] Importar el artefacto de promocion sobre `TMQnnUSlrZxe7z5C`, publicar y verificar
    `/webhook/researchflow`, conservando el export V2 para rollback.

Rollback: mantener el workflow funcional actual exportado y activo hasta que el candidato
v3 haya superado las pruebas. La migracion solo agrega estructuras y no elimina datos.

## 7. Criterios de aceptacion

- [x] El nuevo nodo usa `$env.GEMINI_API_KEY`; no existen placeholders nuevos.
- [x] Un fallo del auditor produce `no_disponible` y puntaje `null`.
- [x] Nunca se puede mostrar `20/100 - alto` ni otra combinacion inconsistente.
- [x] Un hecho `dudoso` o `sin_fuente` no aparece como verificado ni se guarda con confianza alta.
- [x] Una hipotesis reclasificada deja de persistirse como hecho.
- [x] Un dato numerico rechazado no llega a QuickChart ni a Google Sheets.
- [x] Las fuentes encontradas por el auditor quedan almacenadas.
- [x] La migracion puede ejecutarse dos veces sin duplicar semillas ni perder datos.
- [ ] La rama sin pregunta conserva exactamente su comportamiento actual.
- [ ] Los workflows de WhatsApp, digest y demo no sufren regresiones.
- [x] Las conexiones se verifican directamente, ademas de pasar la validacion estructural.
- [x] Existe una ejecucion real del fallback de staging sin efectos externos.
- [x] Existe una ejecucion real con sintesis y auditoria validas despues de rotar la clave.

## 8. Decisiones abiertas para la siguiente iteracion

1. Evaluar si un segundo modelo independiente mejora al auditor actual.
2. Revisar los limites iniciales de 20 hechos y 40 cifras por ejecucion.
3. Definir si una contradiccion grave debe bloquear la entrega en una iteracion posterior.
4. Agregar, si se aprueba, un endpoint de estado para la landing y el chat.

## 9. Prerrequisitos de seguridad independientes de v3

Antes de ampliar el uso publico conviene resolver los riesgos ya identificados en la
version actual:

- mantener revocada la API key que estuvo historicamente expuesta en el repositorio;
- proteger `chat.camba.tech` y los webhooks contra abuso;
- retirar la exposicion directa del puerto 8777;
- definir manejo de errores explicito para evitar ejecuciones aparentemente exitosas con
  fallos internos.

La clave ya fue retirada del codigo y la configuracion sensible del simulador ya usa
variables de entorno. Los demas puntos siguen pendientes antes de ampliar el acceso.
