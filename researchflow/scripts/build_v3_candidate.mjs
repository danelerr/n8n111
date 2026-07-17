import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const args = process.argv.slice(2);
const productionMode = args.includes("--production");
const valueFor = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? path.resolve(args[index + 1]) : fallback;
};
const sourcePath = valueFor("--source", path.join(root, "n8n_workflow_research_production.json"));
const targetPath = valueFor("--target", path.join(root, "n8n_workflow_research_v3_candidate.json"));

const PREPARE_AUDIT_CODE = String.raw`
function extractText(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || '').join('\n').trim();
}

function parseJsonText(value) {
  if (!value) return null;
  const text = String(value)
    .trim()
    .replace(/^\x60\x60\x60json\s*/i, '')
    .replace(/^\x60\x60\x60\s*/i, '')
    .replace(/\x60\x60\x60\s*$/i, '')
    .trim();
  try { return JSON.parse(text); } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch (nestedError) { return null; }
  }
}

const array = (value) => Array.isArray(value) ? value : [];
const context = $('Preparar sintesis').first().json;
const response = $input.first().json || {};
const rawText = extractText(response);
const parsed = parseJsonText(rawText);
const structurallyValid = Boolean(
  parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
  (parsed.resumen || parsed.respuesta_corta || Array.isArray(parsed.hechos) || Array.isArray(parsed.datasets))
);

let executionId = '';
try { executionId = String($execution.id || ''); } catch (error) { executionId = ''; }
if (!executionId) executionId = 'candidate-' + Date.now();

if (!structurallyValid) {
  return [{ json: {
    ...context,
    execution_id: executionId,
    sintesis_original: {},
    sintesis_raw: rawText,
    sintesis_valida: false,
    auditable: false,
    motivo_no_auditable: response.error ? 'error_sintesis' : 'sintesis_json_invalida',
    hechos_esperados: [],
    datos_esperados: [],
    hechos_no_auditados: [],
    datos_no_auditados: [],
  } }];
}

const hechos = array(parsed.hechos).map((item, index) => {
  const hecho = typeof item === 'string' ? { afirmacion: item, fuente_url: '' } : item || {};
  return {
    audit_id: 'H' + (index + 1),
    afirmacion: String(hecho.afirmacion || '').trim(),
    fuente_url: String(hecho.fuente_url || '').trim(),
  };
}).filter((item) => item.afirmacion);

const datasets = array(parsed.datasets).map((dataset, datasetIndex) => ({
  ...(dataset || {}),
  datos: array(dataset?.datos).map((point, pointIndex) => ({
    ...(point || {}),
    audit_id: 'D' + (datasetIndex + 1) + '-P' + (pointIndex + 1),
  })),
}));

const datos = [];
for (const dataset of datasets) {
  for (const point of array(dataset.datos)) {
    if (point.etiqueta == null || !Number.isFinite(Number(point.valor))) continue;
    datos.push({
      id: point.audit_id,
      dataset: String(dataset.titulo || ''),
      etiqueta: String(point.etiqueta),
      valor: Number(point.valor),
      unidad: String(point.unidad || ''),
      periodo: String(point.periodo || ''),
      fuente_url_original: String(point.fuente_url || ''),
    });
  }
}

const MAX_HECHOS = 20;
const MAX_DATOS = 40;
const hechosEsperados = hechos.slice(0, MAX_HECHOS).map((item) => item.audit_id);
const datosEsperados = datos.slice(0, MAX_DATOS).map((item) => item.id);
const citas = [];
const seenUrls = new Set();
for (const item of array(context.citas_total)) {
  const url = String(item?.url || '').trim();
  if (!url || seenUrls.has(url)) continue;
  seenUrls.add(url);
  citas.push({ titulo: String(item?.titulo || url), url });
}

const auditPayload = {
  pregunta: String(context.pregunta || ''),
  hechos: hechos.slice(0, MAX_HECHOS).map((item) => ({
    id: item.audit_id,
    afirmacion: item.afirmacion,
    fuente_url_original: item.fuente_url,
  })),
  datos: datos.slice(0, MAX_DATOS),
  citas_disponibles: citas,
};

const prompt = [
  'Actua como auditor adversarial de ResearchFlow.',
  'Verifica cada afirmacion y cada cifra mediante busqueda web. No reescribas el articulo.',
  'No confies automaticamente en las URLs originales: contrastalas.',
  'Conserva exactamente los identificadores recibidos y responde todos una sola vez.',
  'Un elemento verificado debe incluir al menos una fuente que realmente lo soporte.',
  'Estados para hechos: verificado, dudoso, sin_fuente, reclasificar_hipotesis.',
  'Estados para datos: verificado, dudoso, sin_fuente.',
  'Tipos de fuente: oficial, primaria, medio_investigacion, analisis, otro.',
  '',
  'Devuelve SOLO JSON valido con esta forma:',
  '{',
  '  "hechos": [{"id":"H1","estado":"verificado","nota":"...","fuentes":[{"titulo":"...","url":"https://...","tipo":"oficial","soporta":true}]}],',
  '  "datos": [{"id":"D1-P1","estado":"verificado","nota":"...","fuentes":[{"titulo":"...","url":"https://...","tipo":"primaria","soporta":true}]}],',
  '  "contradicciones": [{"descripcion":"...","ids":["H1"],"gravedad":"baja|media|alta"}],',
  '  "limitaciones": ["..."],',
  '  "recomendaciones": ["..."]',
  '}',
  '',
  'ELEMENTOS A AUDITAR:',
  JSON.stringify(auditPayload),
].join('\n');

const sintesisOriginal = {
  ...parsed,
  hechos,
  datasets,
};
const totalAuditables = hechos.length + datos.length;

return [{ json: {
  ...context,
  execution_id: executionId,
  sintesis_original: sintesisOriginal,
  sintesis_raw: rawText,
  sintesis_valida: true,
  auditable: totalAuditables > 0,
  motivo_no_auditable: totalAuditables > 0 ? '' : 'sin_elementos_auditables',
  prompt_verificacion: prompt,
  hechos_esperados: hechosEsperados,
  datos_esperados: datosEsperados,
  hechos_no_auditados: hechos.slice(MAX_HECHOS).map((item) => item.audit_id),
  datos_no_auditados: datos.slice(MAX_DATOS).map((item) => item.id),
} }];
`;

const VALIDATE_AUDIT_CODE = String.raw`
function extractText(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || '').join('\n').trim();
}

function parseJsonText(value) {
  if (!value) return null;
  const text = String(value)
    .trim()
    .replace(/^\x60\x60\x60json\s*/i, '')
    .replace(/^\x60\x60\x60\s*/i, '')
    .replace(/\x60\x60\x60\s*$/i, '')
    .trim();
  try { return JSON.parse(text); } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch (nestedError) { return null; }
  }
}

const array = (value) => Array.isArray(value) ? value : [];
const validUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());
const previous = $('Preparar auditoria V3').first().json;
const response = $input.first().json || {};
const rawText = extractText(response);
const parsed = parseJsonText(rawText);
const errors = [];
const factStates = new Set(['verificado', 'dudoso', 'sin_fuente', 'reclasificar_hipotesis']);
const dataStates = new Set(['verificado', 'dudoso', 'sin_fuente']);
const sourceTypes = new Set(['oficial', 'primaria', 'medio_investigacion', 'analisis', 'otro']);

function normalizeSources(value) {
  const output = [];
  const seen = new Set();
  for (const source of array(value)) {
    const url = String(source?.url || '').trim();
    if (!validUrl(url) || seen.has(url)) continue;
    seen.add(url);
    const type = String(source?.tipo || 'otro');
    output.push({
      titulo: String(source?.titulo || url),
      url,
      tipo: sourceTypes.has(type) ? type : 'otro',
      soporta: source?.soporta !== false,
    });
  }
  return output;
}

function normalizeEntries(value, expectedIds, allowedStates, kind) {
  if (!Array.isArray(value)) {
    errors.push(kind + '_no_es_array');
    return [];
  }
  const expected = new Set(expectedIds);
  const seen = new Set();
  const normalized = [];
  for (const item of value) {
    const id = String(item?.id || '');
    const state = String(item?.estado || '');
    if (!expected.has(id)) { errors.push(kind + '_id_desconocido:' + id); continue; }
    if (seen.has(id)) { errors.push(kind + '_id_duplicado:' + id); continue; }
    if (!allowedStates.has(state)) { errors.push(kind + '_estado_invalido:' + id); continue; }
    seen.add(id);
    const sources = normalizeSources(item?.fuentes);
    if (state === 'verificado' && !sources.some((source) => source.soporta)) {
      errors.push(kind + '_verificado_sin_fuente:' + id);
    }
    normalized.push({
      id,
      estado: state,
      nota: String(item?.nota || '').slice(0, 1200),
      fuentes: sources,
    });
  }
  for (const id of expected) if (!seen.has(id)) errors.push(kind + '_id_faltante:' + id);
  return normalized;
}

let facts = [];
let data = [];
if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
  errors.push(response.error ? 'error_http_auditor' : 'auditoria_json_invalida');
} else {
  facts = normalizeEntries(parsed.hechos, previous.hechos_esperados || [], factStates, 'hecho');
  data = normalizeEntries(parsed.datos, previous.datos_esperados || [], dataStates, 'dato');
}

const groundingSources = [];
const groundingSeen = new Set();
const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
for (const chunk of chunks) {
  const web = chunk?.web || {};
  const url = String(web.uri || '').trim();
  if (!validUrl(url) || groundingSeen.has(url)) continue;
  groundingSeen.add(url);
  groundingSources.push({ titulo: String(web.title || url), url, tipo: 'otro', soporta: true });
}

const contradictions = array(parsed?.contradicciones).map((item) => ({
  descripcion: String(item?.descripcion || item || '').slice(0, 1600),
  ids: array(item?.ids).map(String),
  gravedad: ['baja', 'media', 'alta'].includes(String(item?.gravedad)) ? String(item.gravedad) : 'media',
})).filter((item) => item.descripcion);

const audit = {
  hechos: facts,
  datos: data,
  contradicciones: contradictions,
  limitaciones: array(parsed?.limitaciones).map(String).filter(Boolean),
  recomendaciones: array(parsed?.recomendaciones).map(String).filter(Boolean),
  fuentes_grounding: groundingSources,
};

return [{ json: {
  ...previous,
  auditoria_valida: errors.length === 0,
  errores_auditoria: errors,
  auditoria_raw_text: rawText,
  auditoria_raw: parsed,
  auditoria_validada: audit,
} }];
`;

const RECONCILE_CODE = String.raw`
const array = (value) => Array.isArray(value) ? value : [];
const previous = $input.first().json;
const original = previous.sintesis_original || {};
const validated = previous.auditoria_validada || {};
const factMap = new Map(array(validated.hechos).map((item) => [item.id, item]));
const dataMap = new Map(array(validated.datos).map((item) => [item.id, item]));
const verifiedFacts = [];
const pending = [];
const hypotheses = array(original.hipotesis).map(String);
const auditorSources = [];
const sourceSeen = new Set();

function addSource(source) {
  const url = String(source?.url || '').trim();
  if (!url || sourceSeen.has(url)) return;
  sourceSeen.add(url);
  auditorSources.push({
    titulo: String(source?.titulo || url),
    url,
    tipo: String(source?.tipo || 'otro'),
    confianza: source?.soporta === false ? 'baja' : 'alta',
  });
}

for (const fact of array(original.hechos)) {
  const verdict = factMap.get(fact.audit_id) || {
    id: fact.audit_id,
    estado: 'no_auditado',
    nota: 'No entro en el limite de esta auditoria.',
    fuentes: [],
  };
  for (const source of array(verdict.fuentes)) addSource(source);
  if (verdict.estado === 'verificado') {
    const supporting = array(verdict.fuentes).find((source) => source.soporta !== false);
    verifiedFacts.push({
      afirmacion: fact.afirmacion,
      fuente_url: String(supporting?.url || fact.fuente_url || ''),
      audit_id: fact.audit_id,
      verificacion: verdict,
    });
  } else if (verdict.estado === 'reclasificar_hipotesis') {
    hypotheses.push(fact.afirmacion);
  } else {
    pending.push({
      audit_id: fact.audit_id,
      afirmacion: fact.afirmacion,
      estado: verdict.estado,
      nota: verdict.nota || '',
      fuentes: array(verdict.fuentes),
    });
  }
}

const verifiedDatasets = [];
const pendingData = [];
for (const dataset of array(original.datasets)) {
  const points = [];
  for (const point of array(dataset.datos)) {
    const verdict = dataMap.get(point.audit_id) || {
      id: point.audit_id,
      estado: 'no_auditado',
      nota: 'No entro en el limite de esta auditoria.',
      fuentes: [],
    };
    for (const source of array(verdict.fuentes)) addSource(source);
    if (verdict.estado === 'verificado') {
      const supporting = array(verdict.fuentes).find((source) => source.soporta !== false);
      points.push({
        ...point,
        fuente_url: String(supporting?.url || point.fuente_url || ''),
        verificacion: verdict,
      });
    } else {
      pendingData.push({
        audit_id: point.audit_id,
        dataset: String(dataset.titulo || ''),
        etiqueta: String(point.etiqueta || ''),
        valor: point.valor,
        estado: verdict.estado,
        nota: verdict.nota || '',
      });
    }
  }
  if (points.length >= 2) verifiedDatasets.push({ ...dataset, datos: points });
}

const originalSources = array(original.fuentes).map((source) => ({
  titulo: String(source?.titulo || source?.url || ''),
  url: String(source?.url || ''),
  tipo: String(source?.tipo || 'otro'),
  confianza: String(source?.confianza || 'media'),
})).filter((source) => source.url);
for (const source of originalSources) {
  if (!sourceSeen.has(source.url)) {
    sourceSeen.add(source.url);
    auditorSources.push(source);
  }
}
for (const source of array(validated.fuentes_grounding)) addSource(source);

const factTotal = array(original.hechos).length;
const dataTotal = array(original.datasets).reduce((sum, dataset) => sum + array(dataset?.datos).filter((point) => point?.etiqueta != null && Number.isFinite(Number(point?.valor))).length, 0);
const factVerified = verifiedFacts.length;
const dataVerified = array(validated.datos).filter((item) => item.estado === 'verificado').length;
const categories = [];
if (factTotal > 0) categories.push({ weight: 0.7, ratio: factVerified / factTotal });
if (dataTotal > 0) categories.push({ weight: 0.3, ratio: dataVerified / dataTotal });
const weightTotal = categories.reduce((sum, item) => sum + item.weight, 0);
const score = weightTotal > 0
  ? Math.max(0, Math.min(100, Math.round(100 * categories.reduce((sum, item) => sum + item.weight * item.ratio, 0) / weightTotal)))
  : null;
const level = score == null ? 'no_aplicable' : (score >= 85 ? 'alto' : (score >= 60 ? 'medio' : 'bajo'));
const auditedCount = factMap.size + dataMap.size;
const totalCount = factTotal + dataTotal;
const status = totalCount === 0 ? 'no_aplicable' : (auditedCount < totalCount ? 'parcial' : 'completa');
const supportingSources = array(validated.hechos)
  .concat(array(validated.datos))
  .filter((item) => item.estado === 'verificado')
  .flatMap((item) => array(item.fuentes).filter((source) => source.soporta !== false));
const strongSources = supportingSources.filter((source) => ['oficial', 'primaria'].includes(source.tipo));
const strongRatio = supportingSources.length ? strongSources.length / supportingSources.length : 0;
const sourceQuality = supportingSources.length === 0 ? 'no_disponible' : (strongRatio >= 0.6 ? 'alta' : (strongRatio >= 0.3 ? 'media' : 'baja'));
const verdict = score == null
  ? 'No habia elementos auditables.'
  : 'Se verificaron ' + (factVerified + dataVerified) + ' de ' + totalCount + ' elementos auditables.';

const reconciled = {
  ...original,
  hechos: verifiedFacts,
  hipotesis: Array.from(new Set(hypotheses.filter(Boolean))),
  datasets: verifiedDatasets,
  fuentes: auditorSources,
  articulo_markdown: '',
};

return [{ json: {
  ...previous,
  sintesis_reconciliada: reconciled,
  pendientes_verificacion: pending,
  datos_pendientes_verificacion: pendingData,
  auditoria: {
    estado: status,
    puntaje: score,
    nivel: level,
    calidad_fuentes: sourceQuality,
    veredicto: verdict,
    hechos: array(validated.hechos),
    datos: array(validated.datos),
    fuentes: auditorSources,
    contradicciones: array(validated.contradicciones),
    limitaciones: array(validated.limitaciones),
    recomendaciones: array(validated.recomendaciones),
    respuesta_cruda: previous.auditoria_raw,
    respuesta_validada: validated,
    conteos: {
      hechos_total: factTotal,
      hechos_verificados: factVerified,
      datos_total: dataTotal,
      datos_verificados: dataVerified,
    },
  },
} }];
`;

const FALLBACK_CODE = String.raw`
const array = (value) => Array.isArray(value) ? value : [];
const previous = $input.first().json;
const original = previous.sintesis_original || {};
const noApplicable = previous.motivo_no_auditable === 'sin_elementos_auditables';
const status = noApplicable ? 'no_aplicable' : 'no_disponible';
const facts = array(original.hechos);
const pending = noApplicable ? [] : facts.map((fact) => ({
  audit_id: String(fact?.audit_id || ''),
  afirmacion: String(fact?.afirmacion || ''),
  estado: 'no_auditado',
  nota: 'La verificacion adversarial no estuvo disponible.',
  fuentes: [],
})).filter((fact) => fact.afirmacion);
const dataTotal = array(original.datasets).reduce((sum, dataset) => sum + array(dataset?.datos).length, 0);
const reconciled = {
  ...original,
  hechos: noApplicable ? facts : [],
  datasets: noApplicable ? array(original.datasets) : [],
  articulo_markdown: '',
};
const reason = array(previous.errores_auditoria).length
  ? previous.errores_auditoria.join('; ')
  : String(previous.motivo_no_auditable || 'auditor_no_disponible');

return [{ json: {
  ...previous,
  sintesis_reconciliada: reconciled,
  pendientes_verificacion: pending,
  datos_pendientes_verificacion: [],
  auditoria: {
    estado: status,
    puntaje: null,
    nivel: status,
    calidad_fuentes: 'no_disponible',
    veredicto: noApplicable ? 'No habia elementos auditables.' : 'Verificacion no disponible: ' + reason,
    hechos: [],
    datos: [],
    fuentes: [],
    contradicciones: [],
    limitaciones: noApplicable ? [] : ['La entrega no fue auditada de forma adversarial.'],
    recomendaciones: [],
    respuesta_cruda: previous.auditoria_raw || null,
    respuesta_validada: null,
    conteos: {
      hechos_total: facts.length,
      hechos_verificados: 0,
      datos_total: dataTotal,
      datos_verificados: 0,
    },
  },
} }];
`;

const PROCESS_RESULT_CODE = String.raw`
const array = (value) => Array.isArray(value) ? value : [];
const previous = $input.first().json;
const result = previous.sintesis_reconciliada || {};
const audit = previous.auditoria || {
  estado: 'no_disponible', puntaje: null, nivel: 'no_disponible', calidad_fuentes: 'no_disponible',
  veredicto: 'Verificacion no disponible.', hechos: [], datos: [], fuentes: [], contradicciones: [], limitaciones: [], recomendaciones: [],
};
const summary = String(result.resumen || ('No se pudo completar la sintesis automatica para "' + previous.tema + '".'));
const shortAnswer = String(result.respuesta_corta || 'Sin respuesta automatica; requiere revision manual.');
const facts = array(result.hechos).filter((item) => item?.afirmacion);
const pending = array(previous.pendientes_verificacion).filter((item) => item?.afirmacion);
const hypotheses = array(result.hipotesis).map(String).filter(Boolean);
const opinions = array(result.opiniones).map(String).filter(Boolean);
const whys = array(result.cinco_porques).map(String).filter(Boolean);
const openQuestions = array(result.preguntas_abiertas).map(String).filter(Boolean);
const contradictions = array(audit.contradicciones);
const limitations = array(audit.limitaciones).map(String).filter(Boolean);
const sources = array(result.fuentes).map((source) => ({
  titulo: String(source?.titulo || source?.url || ''),
  url: String(source?.url || ''),
  tipo: String(source?.tipo || 'otro'),
  confianza: String(source?.confianza || 'media'),
})).filter((source) => source.url);

const palette = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6', '#f43f5e', '#84cc16'];
const charts = [];
const validDatasets = [];
for (const dataset of array(result.datasets)) {
  const points = array(dataset?.datos).filter((point) => point && point.etiqueta != null && Number.isFinite(Number(point.valor)) && point.fuente_url);
  if (points.length < 2) continue;
  const type = ['lineas', 'pastel', 'barras'].includes(dataset.tipo_grafico) ? dataset.tipo_grafico : 'barras';
  const chartType = type === 'lineas' ? 'line' : (type === 'pastel' ? 'pie' : 'bar');
  const labels = points.map((point) => String(point.etiqueta).slice(0, 40));
  const values = points.map((point) => Number(point.valor));
  const config = {
    type: chartType,
    data: { labels, datasets: [{ label: String(dataset.titulo || previous.tema).slice(0, 80), data: values, backgroundColor: chartType === 'bar' ? palette[0] : palette.slice(0, values.length) }] },
    options: { plugins: { title: { display: true, text: String(dataset.titulo || '').slice(0, 90) }, legend: { display: chartType !== 'bar' } } },
  };
  const url = 'https://quickchart.io/chart?w=620&h=360&bkg=white&c=' + encodeURIComponent(JSON.stringify(config));
  const source = String(dataset.fuente_principal || points[0].fuente_url);
  charts.push({ titulo: String(dataset.titulo || ''), tipo: type, url, fuente: source });
  validDatasets.push({
    titulo: String(dataset.titulo || ''),
    descripcion: String(dataset.descripcion || ''),
    tipo_grafico: type,
    fuente_principal: source,
    datos: points,
    quickchart_url: url,
  });
}

const verificationLabel = audit.puntaje == null
  ? (audit.estado === 'no_aplicable' ? 'No aplicable' : 'No disponible')
  : audit.puntaje + '/100 (' + audit.nivel + ')';
const markdown = [];
markdown.push('# ' + previous.tema, '');
markdown.push('**Pregunta central:** ' + previous.pregunta, '');
markdown.push('**Respuesta corta:** ' + shortAnswer, '');
markdown.push('## Verificacion adversarial');
markdown.push('- Puntaje de verificacion: ' + verificationLabel);
markdown.push('- Estado: ' + audit.estado);
markdown.push('- Calidad de fuentes: ' + audit.calidad_fuentes);
markdown.push('- ' + audit.veredicto, '');
markdown.push('## Resumen', summary, '');
markdown.push('## Hechos verificados');
if (facts.length) for (const fact of facts) markdown.push('- ' + fact.afirmacion + ' [fuente: ' + fact.fuente_url + ']');
else markdown.push('- No hay hechos que hayan superado la auditoria.');
markdown.push('');
if (pending.length) {
  markdown.push('## Afirmaciones pendientes de verificacion');
  for (const item of pending) markdown.push('- [' + item.estado + '] ' + item.afirmacion + (item.nota ? ' — ' + item.nota : ''));
  markdown.push('');
}
if (contradictions.length) {
  markdown.push('## Contradicciones detectadas');
  for (const item of contradictions) markdown.push('- [' + String(item.gravedad || 'media') + '] ' + String(item.descripcion || item));
  markdown.push('');
}
if (whys.length) { markdown.push('## El porque (5 porques)'); for (const item of whys) markdown.push('- ' + item); markdown.push(''); }
if (hypotheses.length) { markdown.push('## Hipotesis'); for (const item of hypotheses) markdown.push('- ' + item); markdown.push(''); }
if (opinions.length) { markdown.push('## Opiniones registradas'); for (const item of opinions) markdown.push('- ' + item); markdown.push(''); }
if (limitations.length) { markdown.push('## Limitaciones'); for (const item of limitations) markdown.push('- ' + item); markdown.push(''); }
markdown.push('## Graficos');
if (charts.length) for (const chart of charts) markdown.push('- ' + (chart.titulo || chart.tipo) + ': ' + chart.url + ' (fuente: ' + chart.fuente + ')');
else markdown.push('- No hay al menos dos puntos numericos verificados por dataset; se omiten los graficos.');
markdown.push('');
if (openQuestions.length) { markdown.push('## Preguntas abiertas'); for (const item of openQuestions) markdown.push('- ' + item); markdown.push(''); }
markdown.push('## Fuentes');
if (sources.length) for (const source of sources) markdown.push('- [' + source.tipo + ', confianza ' + source.confianza + '] ' + source.titulo + ' - ' + source.url);
else markdown.push('- Sin fuentes registradas.');
const reportMarkdown = markdown.join('\n');

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const articleHtml = escapeHtml(reportMarkdown)
  .replace(/^### (.*)$/gm, '<h3>$1</h3>')
  .replace(/^## (.*)$/gm, '<h2>$1</h2>')
  .replace(/^# (.*)$/gm, '<h1>$1</h1>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/^- (.*)$/gm, '<li>$1</li>')
  .replace(/\n{2,}/g, '<br><br>');
const badgeColor = audit.puntaje == null ? '#64748b' : (audit.nivel === 'alto' ? '#15803d' : (audit.nivel === 'medio' ? '#a16207' : '#b91c1c'));
const chartsHtml = charts.map((chart) => '<div style="margin:16px 0"><img src="' + chart.url + '" alt="' + escapeHtml(chart.titulo) + '" style="max-width:100%;border-radius:8px"><br><small>Fuente: ' + escapeHtml(chart.fuente) + '</small></div>').join('');
const emailHtml = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:680px;margin:auto;color:#111">'
  + '<p style="background:' + badgeColor + ';color:white;padding:10px 14px;border-radius:8px">Verificacion: ' + escapeHtml(verificationLabel) + '</p>'
  + articleHtml
  + (chartsHtml ? '<h2>Graficos</h2>' + chartsHtml : '')
  + '<p><small>El puntaje mide cobertura de verificacion, no certeza absoluta.</small></p></div>';
const whatsappText = ('ResearchFlow completo "' + previous.tema + '". Verificacion: ' + verificationLabel + '. ' + shortAnswer + ' El articulo completo llego a tu correo.').slice(0, 900);

let requestId = 0;
try { requestId = Number($('Postgres - Registrar solicitud').first().json.request_id || 0); } catch (error) { requestId = 0; }
const evidence = [];
for (const fact of facts) evidence.push({ tipo: 'hecho', afirmacion: fact.afirmacion, soporte: fact.fuente_url, confianza: 'alta' });
for (const item of pending) evidence.push({ tipo: 'afirmacion_pendiente', afirmacion: item.afirmacion, soporte: item.estado, confianza: 'baja' });
for (const item of hypotheses) evidence.push({ tipo: 'hipotesis', afirmacion: item, soporte: 'requiere_verificacion', confianza: 'media' });
for (const item of opinions) evidence.push({ tipo: 'opinion', afirmacion: item, soporte: 'atribuida', confianza: 'baja' });
const persistPayload = {
  request_id: requestId,
  tema: String(previous.tema || ''),
  fuentes: sources.slice(0, 60),
  evidencias: evidence.slice(0, 80),
  datasets: validDatasets,
  artifact: { titulo: String(previous.tema || ''), contenido: reportMarkdown },
};
const verificationParams = [
  requestId,
  String(previous.execution_id || ''),
  String(audit.estado || 'no_disponible'),
  audit.puntaje == null ? null : Number(audit.puntaje),
  String(audit.nivel || 'no_disponible'),
  String(audit.calidad_fuentes || 'no_disponible'),
  'gemini-2.5-flash',
  JSON.stringify(array(audit.hechos)),
  JSON.stringify(array(audit.datos)),
  JSON.stringify(array(audit.fuentes)),
  JSON.stringify(array(audit.contradicciones)),
  JSON.stringify(array(audit.limitaciones)),
  JSON.stringify(audit.respuesta_cruda ?? null),
  JSON.stringify(audit.respuesta_validada ?? null),
  String(audit.veredicto || ''),
];
const finalState = ['completa', 'parcial'].includes(audit.estado) ? 'completado_v3_auditado' : 'completado_v3_sin_auditoria';
const sheetRows = [];
for (const dataset of validDatasets) for (const point of dataset.datos) sheetRows.push({
  request_id: requestId,
  tema: previous.tema,
  dataset: dataset.titulo,
  etiqueta: String(point.etiqueta),
  valor: Number(point.valor),
  unidad: String(point.unidad || ''),
  periodo: String(point.periodo || ''),
  fuente_url: String(point.fuente_url),
});

return [{ json: {
  ...previous,
  request_id: requestId,
  estado_final: finalState,
  resumen: summary,
  respuesta_corta: shortAnswer,
  hechos: facts,
  pendientes_verificacion: pending,
  hipotesis: hypotheses,
  opiniones: opinions,
  cinco_porques: whys,
  preguntas_abiertas: openQuestions,
  fuentes: sources,
  graficos: charts,
  datasets: validDatasets,
  informe_markdown: reportMarkdown,
  email_html: emailHtml,
  whatsapp_text: whatsappText,
  persist_payload_json: JSON.stringify(persistPayload),
  verification_params: verificationParams,
  sheet_rows: sheetRows,
} }];
`;

const VERIFICATION_QUERY = `WITH input AS (
  SELECT
    $1::int AS request_id,
    $2::text AS execution_id,
    $3::text AS estado,
    $4::int AS puntaje,
    $5::text AS nivel,
    $6::text AS calidad_fuentes,
    $7::text AS auditor_modelo,
    $8::jsonb AS hechos,
    $9::jsonb AS datos,
    $10::jsonb AS fuentes,
    $11::jsonb AS contradicciones,
    $12::jsonb AS limitaciones,
    $13::jsonb AS respuesta_cruda,
    $14::jsonb AS respuesta_validada,
    $15::text AS veredicto
), upserted AS (
  INSERT INTO research_verifications (
    request_id, execution_id, estado, puntaje, nivel, calidad_fuentes,
    auditor_modelo, hechos_auditados, datos_auditados, fuentes_verificacion,
    contradicciones, limitaciones, respuesta_cruda, respuesta_validada, veredicto
  )
  SELECT request_id, execution_id, estado, puntaje, nivel, calidad_fuentes,
    auditor_modelo, hechos, datos, fuentes, contradicciones, limitaciones,
    respuesta_cruda, respuesta_validada, veredicto
  FROM input WHERE request_id > 0
  ON CONFLICT (request_id, execution_id) DO UPDATE SET
    estado = EXCLUDED.estado,
    puntaje = EXCLUDED.puntaje,
    nivel = EXCLUDED.nivel,
    calidad_fuentes = EXCLUDED.calidad_fuentes,
    auditor_modelo = EXCLUDED.auditor_modelo,
    hechos_auditados = EXCLUDED.hechos_auditados,
    datos_auditados = EXCLUDED.datos_auditados,
    fuentes_verificacion = EXCLUDED.fuentes_verificacion,
    contradicciones = EXCLUDED.contradicciones,
    limitaciones = EXCLUDED.limitaciones,
    respuesta_cruda = EXCLUDED.respuesta_cruda,
    respuesta_validada = EXCLUDED.respuesta_validada,
    veredicto = EXCLUDED.veredicto,
    updated_at = NOW()
  RETURNING request_id, estado, puntaje, nivel, calidad_fuentes, veredicto
), updated AS (
  UPDATE research_requests AS request SET
    estado_verificacion = upserted.estado,
    puntaje_verificacion = upserted.puntaje,
    nivel_verificacion = upserted.nivel,
    calidad_fuentes_verificacion = upserted.calidad_fuentes,
    veredicto_verificacion = upserted.veredicto,
    verificacion_updated_at = NOW()
  FROM upserted WHERE request.id = upserted.request_id
  RETURNING request.id
)
SELECT
  COALESCE((SELECT request_id FROM upserted LIMIT 1), 0) AS request_id,
  COALESCE((SELECT estado FROM upserted LIMIT 1), 'sin_request_id') AS estado_verificacion;`;

const EVIDENCE_QUERY = `WITH payload AS (
  SELECT $1::jsonb AS value
), normalized AS (
  SELECT
    COALESCE((value->>'request_id')::int, 0) AS request_id,
    value
  FROM payload
), inserted_sources AS (
  INSERT INTO research_sources (request_id, titulo, url, tipo, calidad, confianza)
  SELECT n.request_id, source.titulo, source.url, source.tipo, 'auditada_v3', source.confianza
  FROM normalized AS n
  CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(n.value->'fuentes', '[]'::jsonb))
    AS source(titulo text, url text, tipo text, confianza text)
  WHERE n.request_id > 0 AND source.url <> ''
  RETURNING id
), inserted_evidence AS (
  INSERT INTO research_evidence (request_id, tipo, afirmacion, soporte, confianza)
  SELECT n.request_id, evidence.tipo, evidence.afirmacion, evidence.soporte, evidence.confianza
  FROM normalized AS n
  CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(n.value->'evidencias', '[]'::jsonb))
    AS evidence(tipo text, afirmacion text, soporte text, confianza text)
  WHERE n.request_id > 0 AND evidence.afirmacion <> ''
  RETURNING id
), inserted_datasets AS (
  INSERT INTO research_datasets (request_id, titulo, descripcion, datos_json, fuente_principal, tipo_grafico, quickchart_url, estado)
  SELECT n.request_id, dataset.titulo, dataset.descripcion, dataset.datos::text,
    dataset.fuente_principal, dataset.tipo_grafico, dataset.quickchart_url, 'verificado_v3'
  FROM normalized AS n
  CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(n.value->'datasets', '[]'::jsonb))
    AS dataset(titulo text, descripcion text, datos jsonb, fuente_principal text, tipo_grafico text, quickchart_url text)
  WHERE n.request_id > 0
  RETURNING id
), inserted_artifact AS (
  INSERT INTO research_artifacts (request_id, tipo, titulo, contenido, estado)
  SELECT n.request_id, 'articulo', n.value->'artifact'->>'titulo', n.value->'artifact'->>'contenido', 'generado_v3'
  FROM normalized AS n WHERE n.request_id > 0
  RETURNING id
)
SELECT
  (SELECT count(*) FROM inserted_sources) AS fuentes_insertadas,
  (SELECT count(*) FROM inserted_evidence) AS evidencias_insertadas,
  (SELECT count(*) FROM inserted_datasets) AS datasets_insertados,
  (SELECT count(*) FROM inserted_artifact) AS artifacts_insertados;`;

function codeNode(id, name, position, code, notes) {
  return {
    parameters: { jsCode: code },
    id,
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
    notes,
  };
}

function ifNode(id, name, position, expression, conditionId) {
  return {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
        conditions: [{
          id: conditionId,
          leftValue: expression,
          rightValue: true,
          operator: { type: "boolean", operation: "true", singleValue: true },
        }],
        combinator: "and",
      },
      options: {},
    },
    id,
    name,
    type: "n8n-nodes-base.if",
    typeVersion: 2.2,
    position,
  };
}

const workflow = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const byName = (name) => workflow.nodes.find((node) => node.name === name);
const clone = (value) => JSON.parse(JSON.stringify(value));
const alreadyV3 = Boolean(byName("Preparar auditoria V3"));

workflow.name = productionMode
  ? "ResearchFlow - Investigacion profunda V3"
  : "ResearchFlow - Investigacion profunda V3 (candidato)";
workflow.active = false;
workflow.id = productionMode ? "TMQnnUSlrZxe7z5C" : "rfV3Candidate001";
workflow.versionId = productionMode
  ? "c467edda-939a-44b1-860f-e60b30cc9521"
  : "f6dca3c5-0c12-4cef-9d30-c03c44303e13";
if (Array.isArray(workflow.shared)) {
  workflow.shared = workflow.shared.map((entry) => ({ ...entry, workflowId: workflow.id }));
}
workflow.meta = productionMode
  ? {
      ...(workflow.meta || {}),
      researchflowVersion: "3.0.0",
      verification: "adversarial",
    }
  : {
      ...(workflow.meta || {}),
      candidate: true,
      candidateVersion: "3.0.0",
      warning: "Candidato inactivo. Aplicar migracion 003 y validar antes de habilitar entregas o activar.",
    };
delete workflow.meta.candidate;
delete workflow.meta.candidateVersion;
delete workflow.meta.warning;
if (!productionMode) {
  workflow.meta.candidate = true;
  workflow.meta.candidateVersion = "3.0.0";
  workflow.meta.warning = "Candidato inactivo. Aplicar migracion 003 y validar antes de habilitar entregas o activar.";
}

const webhook = byName("Webhook - Nueva investigacion");
if (productionMode) {
  webhook.parameters.path = "researchflow";
  webhook.notes = "Webhook estable de ResearchFlow V3.";
} else {
  webhook.parameters.path = "researchflow-v3-candidate";
  webhook.webhookId = "researchflow-v3-candidate";
  webhook.notes = "Webhook exclusivo del candidato V3. No sustituye /researchflow mientras el workflow permanezca inactivo.";
}

if (!alreadyV3) {
const synthesis = byName("Gemini - Sintesis estructurada");
synthesis.retryOnFail = true;
synthesis.maxTries = 3;
synthesis.waitBetweenTries = 3000;
synthesis.notes += " V3: tres intentos antes de declarar la sintesis no auditable.";

const prepareAudit = codeNode(
  "rf-v3-001",
  "Preparar auditoria V3",
  [2640, -140],
  PREPARE_AUDIT_CODE,
  "Parsea la sintesis, asigna IDs estables y crea el contrato acotado para el auditor.",
);
const ifSynthesis = ifNode(
  "rf-v3-002",
  "IF - Sintesis auditable",
  [2860, -140],
  "={{ $json.auditable }}",
  "cond-v3-auditable",
);
const auditHttp = {
  parameters: {
    method: "POST",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: "x-goog-api-key", value: "={{ $env.GEMINI_API_KEY }}" },
      { name: "Content-Type", value: "application/json" },
    ] },
    sendBody: true,
    specifyBody: "json",
    // Gemini no admite Google Search grounding junto con responseMimeType JSON.
    // El prompt exige JSON y el nodo siguiente lo extrae y valida estrictamente.
    jsonBody: "={{ { contents: [{ role: 'user', parts: [{ text: $json.prompt_verificacion }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0 } } }}",
    options: { timeout: 120000 },
  },
  id: "rf-v3-003",
  name: "Gemini - Verificacion adversarial",
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position: [3080, -260],
  notes: "Audita hechos y cifras con Google Search grounding. No calcula el puntaje.",
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 3000,
  continueOnFail: true,
  alwaysOutputData: true,
};
const validateAudit = codeNode(
  "rf-v3-004",
  "Validar auditoria V3",
  [3300, -260],
  VALIDATE_AUDIT_CODE,
  "Valida JSON, IDs, estados y fuentes. Un verificado sin fuente invalida la auditoria.",
);
const ifAudit = ifNode(
  "rf-v3-005",
  "IF - Auditoria valida",
  [3520, -260],
  "={{ $json.auditoria_valida }}",
  "cond-v3-audit-valid",
);
const reconcile = codeNode(
  "rf-v3-006",
  "Reconciliar auditoria V3",
  [3740, -340],
  RECONCILE_CODE,
  "Aplica los veredictos, excluye cifras rechazadas y calcula el puntaje de cobertura de forma determinista.",
);
const fallback = codeNode(
  "rf-v3-007",
  "Marcar verificacion no disponible",
  [3740, 20],
  FALLBACK_CODE,
  "Ruta explicita para sintesis no auditable, auditor invalido o auditoria no aplicable. Nunca inventa puntaje.",
);

workflow.nodes.push(prepareAudit, ifSynthesis, auditHttp, validateAudit, ifAudit, reconcile, fallback);

const processResult = byName("Procesar resultado");
processResult.parameters.jsCode = PROCESS_RESULT_CODE;
processResult.position = [3960, -140];
processResult.notes = "Construye el entregable exclusivamente desde la sintesis reconciliada; solo grafica puntos verificados.";

const postgresVerification = clone(byName("Postgres - Guardar evidencia"));
postgresVerification.id = "rf-v3-008";
postgresVerification.name = "Postgres - Guardar verificacion";
postgresVerification.position = [4180, -140];
postgresVerification.parameters = {
  operation: "executeQuery",
  query: VERIFICATION_QUERY,
  options: { queryReplacement: "={{ $json.verification_params }}" },
};
postgresVerification.notes = "Upsert idempotente por request_id + execution_id y actualizacion del ultimo estado de verificacion.";
postgresVerification.continueOnFail = false;
postgresVerification.alwaysOutputData = true;
workflow.nodes.push(postgresVerification);

const saveEvidence = byName("Postgres - Guardar evidencia");
saveEvidence.position = [4400, -140];
saveEvidence.parameters = {
  operation: "executeQuery",
  query: EVIDENCE_QUERY,
  options: { queryReplacement: "={{ [ $('Procesar resultado').first().json.persist_payload_json ] }}" },
};
saveEvidence.notes = "Inserta fuentes, evidencia, datasets y artifact mediante un payload JSONB parametrizado.";
saveEvidence.continueOnFail = false;
saveEvidence.alwaysOutputData = true;

const downstreamPositions = {
  "Gmail - Enviar articulo": [4620, -140],
  "Evolution API - Aviso WhatsApp": [4840, -140],
  "Postgres - Actualizar resultado": [5060, -140],
  "Preparar filas Sheets": [5280, -140],
  "Google Sheets - Registrar datos": [5500, -140],
};
for (const [name, position] of Object.entries(downstreamPositions)) byName(name).position = position;

if (!productionMode) {
  for (const name of ["Gmail - Enviar articulo", "Evolution API - Aviso WhatsApp", "Google Sheets - Registrar datos", "Gmail - Enviar preguntas"]) {
    const node = byName(name);
    node.disabled = true;
    node.notes = (node.notes ? node.notes + " " : "") + "DESHABILITADO EN CANDIDATO: habilitar solo despues de las pruebas de staging.";
  }
}

const updateResult = byName("Postgres - Actualizar resultado");
updateResult.parameters = {
  operation: "executeQuery",
  query: "UPDATE research_requests SET estado=$1, resumen=$2, informe_markdown=$3, updated_at=NOW() WHERE id=$4 RETURNING id, estado;",
  options: {
    queryReplacement: "={{ [ $('Procesar resultado').first().json.estado_final, $('Procesar resultado').first().json.resumen, $('Procesar resultado').first().json.informe_markdown, $('Procesar resultado').first().json.request_id ] }}",
  },
};
updateResult.notes = productionMode
  ? "Actualizacion final parametrizada de ResearchFlow V3."
  : "Actualizacion final parametrizada. Las entregas externas permanecen deshabilitadas en el candidato.";

workflow.connections["Gemini - Sintesis estructurada"] = {
  main: [[{ node: "Preparar auditoria V3", type: "main", index: 0 }]],
};
workflow.connections["Preparar auditoria V3"] = {
  main: [[{ node: "IF - Sintesis auditable", type: "main", index: 0 }]],
};
workflow.connections["IF - Sintesis auditable"] = {
  main: [
    [{ node: "Gemini - Verificacion adversarial", type: "main", index: 0 }],
    [{ node: "Marcar verificacion no disponible", type: "main", index: 0 }],
  ],
};
workflow.connections["Gemini - Verificacion adversarial"] = {
  main: [[{ node: "Validar auditoria V3", type: "main", index: 0 }]],
};
workflow.connections["Validar auditoria V3"] = {
  main: [[{ node: "IF - Auditoria valida", type: "main", index: 0 }]],
};
workflow.connections["IF - Auditoria valida"] = {
  main: [
    [{ node: "Reconciliar auditoria V3", type: "main", index: 0 }],
    [{ node: "Marcar verificacion no disponible", type: "main", index: 0 }],
  ],
};
workflow.connections["Reconciliar auditoria V3"] = {
  main: [[{ node: "Procesar resultado", type: "main", index: 0 }]],
};
workflow.connections["Marcar verificacion no disponible"] = {
  main: [[{ node: "Procesar resultado", type: "main", index: 0 }]],
};
workflow.connections["Procesar resultado"] = {
  main: [[{ node: "Postgres - Guardar verificacion", type: "main", index: 0 }]],
};
workflow.connections["Postgres - Guardar verificacion"] = {
  main: [[{ node: "Postgres - Guardar evidencia", type: "main", index: 0 }]],
};
}

// Mantener también las instalaciones V3 existentes alineadas con el contrato
// actual del API: grounding y responseMimeType JSON no pueden combinarse.
const existingAuditor = byName("Gemini - Verificacion adversarial");
if (existingAuditor) {
  existingAuditor.parameters.jsonBody = "={{ { contents: [{ role: 'user', parts: [{ text: $json.prompt_verificacion }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0 } } }}";
}

for (const name of [
  "Gemini - Fase base con busqueda",
  "Gemini - Profundizar con busqueda",
  "Gemini - Sintesis estructurada",
  "Gemini - Verificacion adversarial",
]) {
  const node = byName(name);
  if (!node) continue;
  node.retryOnFail = true;
  node.maxTries = 3;
  node.waitBetweenTries = 3000;
}

// Los exports históricos locales no incluían estas referencias (solo IDs y
// nombres, nunca secretos). Sin ellas, importar reemplazaba la producción con
// nodos Postgres/Gmail/Sheets desconectados de sus credenciales existentes.
const credentialDefaults = {
  "Postgres - Registrar solicitud": { postgres: { id: "fpD1FhKrmqilg5Yk", name: "Postgres account" } },
  "Postgres - Cargar playbook": { postgres: { id: "fpD1FhKrmqilg5Yk", name: "Postgres account" } },
  "Postgres - Guardar evidencia": { postgres: { id: "fpD1FhKrmqilg5Yk", name: "Postgres account" } },
  "Postgres - Actualizar resultado": { postgres: { id: "fpD1FhKrmqilg5Yk", name: "Postgres account" } },
  "Postgres - Guardar idea": { postgres: { id: "fpD1FhKrmqilg5Yk", name: "Postgres account" } },
  "Postgres - Guardar verificacion": { postgres: { id: "fpD1FhKrmqilg5Yk", name: "Postgres account" } },
  "Gmail - Enviar articulo": { gmailOAuth2: { id: "42DoFh3hjEi0OKme", name: "Gmail account" } },
  "Gmail - Enviar preguntas": { gmailOAuth2: { id: "42DoFh3hjEi0OKme", name: "Gmail account" } },
  "Google Sheets - Registrar datos": { googleSheetsOAuth2Api: { id: "03Fo6YBhMsBcA7B2", name: "Google Sheets account" } },
};
for (const [nodeName, credentials] of Object.entries(credentialDefaults)) {
  const node = byName(nodeName);
  if (node && !node.credentials) node.credentials = clone(credentials);
}

const candidateDeliveryNote = "DESHABILITADO EN CANDIDATO: habilitar solo despues de las pruebas de staging.";
for (const name of ["Gmail - Enviar articulo", "Evolution API - Aviso WhatsApp", "Google Sheets - Registrar datos", "Gmail - Enviar preguntas"]) {
  const node = byName(name);
  if (!node) continue;
  if (productionMode) {
    delete node.disabled;
    node.notes = String(node.notes || "").replace(candidateDeliveryNote, "").trim();
  } else {
    node.disabled = true;
    if (!String(node.notes || "").includes(candidateDeliveryNote)) {
      node.notes = (node.notes ? node.notes + " " : "") + candidateDeliveryNote;
    }
  }
}

const finalUpdate = byName("Postgres - Actualizar resultado");
if (finalUpdate) {
  finalUpdate.notes = productionMode
    ? "Actualizacion final parametrizada de ResearchFlow V3."
    : "Actualizacion final parametrizada. Las entregas externas permanecen deshabilitadas en el candidato.";
}

fs.writeFileSync(targetPath, JSON.stringify(workflow, null, 2) + "\n");
console.log(`${productionMode ? "Workflow V3 de produccion" : "Candidato V3"} generado: ${targetPath}`);
