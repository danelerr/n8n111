import assert from "node:assert/strict";
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
const workflowPath = valueFor("--workflow", path.join(root, "n8n_workflow_research_v3_candidate.json"));
const stablePath = valueFor("--stable", path.join(root, "n8n_workflow_research_production.json"));
const fixturePath = path.join(root, "test_data", "v3_audit_fixtures.json");
const migrationPath = path.join(root, "deploy", "migrations", "003_verificacion_adversarial.sql");
const evidenceMigrationPath = path.join(root, "deploy", "migrations", "004_evidence_support_text.sql");

const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
const stable = JSON.parse(fs.readFileSync(stablePath, "utf8"));
const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const migration = fs.readFileSync(migrationPath, "utf8");
const evidenceMigration = fs.readFileSync(evidenceMigrationPath, "utf8");
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function getNode(name) {
  assert(nodes.has(name), `Falta el nodo ${name}`);
  return nodes.get(name);
}

function targetsFrom(connection) {
  const outputs = connection?.main || [];
  return outputs.flatMap((output) => output || []).map((item) => item.node);
}

function assertConnection(from, outputIndex, to) {
  const output = workflow.connections[from]?.main?.[outputIndex] || [];
  assert(output.some((item) => item.node === to), `Falta conexión ${from}[${outputIndex}] → ${to}`);
}

function geminiResponse(content) {
  return {
    candidates: [{
      content: { parts: [{ text: typeof content === "string" ? content : JSON.stringify(content) }] },
      groundingMetadata: { groundingChunks: [] },
    }],
  };
}

async function runCode(nodeName, input, outputs = {}) {
  const code = getNode(nodeName).parameters.jsCode;
  const $input = {
    first: () => ({ json: input }),
    all: () => [{ json: input }],
  };
  const $ = (name) => ({
    first: () => ({ json: outputs[name] || {} }),
    all: () => [{ json: outputs[name] || {} }],
  });
  const $execution = { id: "fixture-execution-1" };
  const execute = new AsyncFunction("$input", "$", "$execution", code);
  const result = await execute($input, $, $execution);
  assert(Array.isArray(result) && result.length === 1 && result[0]?.json, `${nodeName} no devolvió un item`);
  return result[0].json;
}

function validateStructure() {
  assert.equal(workflow.active, false, "El workflow para importar debe permanecer inactivo");
  assert.equal(workflow.id, productionMode ? "TMQnnUSlrZxe7z5C" : "rfV3Candidate001");
  assert.equal(
    workflow.name,
    productionMode ? "ResearchFlow - Investigacion profunda V3" : "ResearchFlow - Investigacion profunda V3 (candidato)",
  );
  assert.equal(
    getNode("Webhook - Nueva investigacion").parameters.path,
    productionMode ? "researchflow" : "researchflow-v3-candidate",
  );
  assert.equal(stable.nodes.find((node) => node.name === "Webhook - Nueva investigacion").parameters.path, "researchflow");

  const names = workflow.nodes.map((node) => node.name);
  assert.equal(new Set(names).size, names.length, "Hay nombres de nodo duplicados");
  for (const [source, connection] of Object.entries(workflow.connections)) {
    assert(nodes.has(source), `Conexión desde nodo inexistente: ${source}`);
    for (const target of targetsFrom(connection)) assert(nodes.has(target), `Conexión a nodo inexistente: ${target}`);
  }

  assertConnection("Gemini - Sintesis estructurada", 0, "Preparar auditoria V3");
  assertConnection("Preparar auditoria V3", 0, "IF - Sintesis auditable");
  assertConnection("IF - Sintesis auditable", 0, "Gemini - Verificacion adversarial");
  assertConnection("IF - Sintesis auditable", 1, "Marcar verificacion no disponible");
  assertConnection("Gemini - Verificacion adversarial", 0, "Validar auditoria V3");
  assertConnection("Validar auditoria V3", 0, "IF - Auditoria valida");
  assertConnection("IF - Auditoria valida", 0, "Reconciliar auditoria V3");
  assertConnection("IF - Auditoria valida", 1, "Marcar verificacion no disponible");
  assertConnection("Reconciliar auditoria V3", 0, "Procesar resultado");
  assertConnection("Marcar verificacion no disponible", 0, "Procesar resultado");
  assertConnection("Procesar resultado", 0, "Postgres - Guardar verificacion");
  assertConnection("Postgres - Guardar verificacion", 0, "Postgres - Guardar evidencia");

  const auditor = getNode("Gemini - Verificacion adversarial");
  for (const name of [
    "Gemini - Fase base con busqueda",
    "Gemini - Profundizar con busqueda",
    "Gemini - Sintesis estructurada",
    "Gemini - Verificacion adversarial",
  ]) {
    assert.equal(getNode(name).retryOnFail, true, `${name} debe reintentar`);
    assert.equal(getNode(name).maxTries, 3, `${name} debe tener tres intentos`);
  }
  assert.equal(auditor.parameters.headerParameters.parameters[0].value, "={{ $env.GEMINI_API_KEY }}");
  assert(auditor.parameters.jsonBody.includes("google_search"));
  assert(!auditor.parameters.jsonBody.includes("responseMimeType"), "Google Search no admite responseMimeType JSON");
  assert(!JSON.stringify(workflow).includes("AIza"), "El workflow contiene una API key literal");

  for (const name of [
    "Postgres - Registrar solicitud",
    "Postgres - Cargar playbook",
    "Postgres - Guardar evidencia",
    "Postgres - Actualizar resultado",
    "Postgres - Guardar idea",
    "Postgres - Guardar verificacion",
  ]) assert(getNode(name).credentials?.postgres?.id, `${name} no tiene credencial Postgres`);
  for (const name of ["Gmail - Enviar articulo", "Gmail - Enviar preguntas"]) {
    assert(getNode(name).credentials?.gmailOAuth2?.id, `${name} no tiene credencial Gmail`);
  }
  assert(getNode("Google Sheets - Registrar datos").credentials?.googleSheetsOAuth2Api?.id, "Sheets no tiene credencial");

  if (!productionMode) {
    for (const name of ["Gmail - Enviar articulo", "Evolution API - Aviso WhatsApp", "Google Sheets - Registrar datos", "Gmail - Enviar preguntas"]) {
      assert.equal(getNode(name).disabled, true, `${name} debe estar deshabilitado en el candidato`);
    }
  }

  const verificationDb = getNode("Postgres - Guardar verificacion");
  assert.equal(verificationDb.typeVersion, 2.5);
  assert(verificationDb.parameters.query.includes("$15::text"));
  assert(verificationDb.parameters.options.queryReplacement.includes("verification_params"));
  const evidenceDb = getNode("Postgres - Guardar evidencia");
  assert(evidenceDb.parameters.query.includes("jsonb_to_recordset"));
  assert(evidenceDb.parameters.options.queryReplacement.includes("persist_payload_json"));

  const reachable = new Set();
  const queue = ["Webhook - Nueva investigacion"];
  while (queue.length) {
    const current = queue.shift();
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const target of targetsFrom(workflow.connections[current])) queue.push(target);
  }
  for (const required of [
    "Preparar auditoria V3",
    "Gemini - Verificacion adversarial",
    "Reconciliar auditoria V3",
    "Marcar verificacion no disponible",
    "Postgres - Guardar verificacion",
    "Google Sheets - Registrar datos",
  ]) assert(reachable.has(required), `${required} no es alcanzable desde el webhook`);

  assert(migration.includes("ADD COLUMN IF NOT EXISTS estado_verificacion"));
  assert(migration.includes("UNIQUE (request_id, execution_id)"));
  assert(migration.includes("puntaje IS NULL OR puntaje BETWEEN 0 AND 100"));
  assert(!/INSERT\s+INTO\s+research_requests/i.test(migration), "La migración no debe incluir semillas");
  assert(evidenceMigration.includes("ALTER COLUMN soporte TYPE TEXT"));

  for (const node of workflow.nodes.filter((item) => item.type === "n8n-nodes-base.code")) {
    assert.doesNotThrow(() => new AsyncFunction("$input", "$", "$execution", node.parameters.jsCode), `JavaScript inválido en ${node.name}`);
  }
}

async function prepareSynthesis(synthesis) {
  return runCode(
    "Preparar auditoria V3",
    geminiResponse(synthesis),
    {
      "Preparar sintesis": {
        tema: "Adopción de activos virtuales en Bolivia",
        pregunta: "¿Existe uso real o principalmente especulación?",
        email: "demo@example.invalid",
        whatsapp: "",
        citas_total: [{ titulo: "BCB", url: "https://www.bcb.gob.bo/" }],
      },
    },
  );
}

async function validateFixtures() {
  for (const fixture of fixtures.cases) {
    const prepared = await prepareSynthesis(fixtures.base_synthesis);
    assert.equal(prepared.sintesis_valida, true, `${fixture.name}: síntesis válida`);
    assert.equal(prepared.auditable, true, `${fixture.name}: debe ser auditable`);
    assert.deepEqual(prepared.hechos_esperados, ["H1", "H2"]);
    assert.deepEqual(prepared.datos_esperados, ["D1-P1", "D1-P2"]);

    const auditorInput = fixture.auditor_raw ?? fixture.auditor_response;
    const validated = await runCode(
      "Validar auditoria V3",
      geminiResponse(auditorInput),
      { "Preparar auditoria V3": prepared },
    );
    assert.equal(validated.auditoria_valida, fixture.expect.auditoria_valida, `${fixture.name}: validez del auditor`);

    const reconciled = validated.auditoria_valida
      ? await runCode("Reconciliar auditoria V3", validated)
      : await runCode("Marcar verificacion no disponible", validated);

    if (validated.auditoria_valida) {
      assert.equal(reconciled.auditoria.estado, fixture.expect.estado, `${fixture.name}: estado`);
      assert.equal(reconciled.auditoria.puntaje, fixture.expect.puntaje, `${fixture.name}: puntaje`);
      assert.equal(reconciled.auditoria.nivel, fixture.expect.nivel, `${fixture.name}: nivel`);
      if (fixture.expect.hechos_verificados != null) assert.equal(reconciled.sintesis_reconciliada.hechos.length, fixture.expect.hechos_verificados, `${fixture.name}: hechos`);
      if (fixture.expect.datasets_admitidos != null) assert.equal(reconciled.sintesis_reconciliada.datasets.length, fixture.expect.datasets_admitidos, `${fixture.name}: datasets`);
      if (fixture.expect.hipotesis_minimas != null) assert(reconciled.sintesis_reconciliada.hipotesis.length >= fixture.expect.hipotesis_minimas, `${fixture.name}: reclasificación`);
      if (fixture.expect.datos_pendientes != null) assert.equal(reconciled.datos_pendientes_verificacion.length, fixture.expect.datos_pendientes, `${fixture.name}: datos pendientes`);
      if (fixture.expect.contradicciones != null) assert.equal(reconciled.auditoria.contradicciones.length, fixture.expect.contradicciones, `${fixture.name}: contradicciones`);
    } else {
      assert.equal(reconciled.auditoria.estado, fixture.expect.estado_fallback, `${fixture.name}: fallback`);
      assert.equal(reconciled.auditoria.puntaje, fixture.expect.puntaje_fallback, `${fixture.name}: puntaje fallback`);
      assert.equal(reconciled.sintesis_reconciliada.datasets.length, 0, `${fixture.name}: fallback no grafica`);
    }

    const processed = await runCode(
      "Procesar resultado",
      reconciled,
      { "Postgres - Registrar solicitud": { request_id: 42 } },
    );
    assert.equal(processed.request_id, 42);
    assert.equal(processed.verification_params.length, 15);
    assert.equal(processed.verification_params[3], reconciled.auditoria.puntaje);
    assert.doesNotThrow(() => JSON.parse(processed.persist_payload_json));
    assert(!processed.informe_markdown.includes("undefined"), `${fixture.name}: informe contiene undefined`);
    assert.equal(processed.sheet_rows.length, processed.datasets.reduce((sum, dataset) => sum + dataset.datos.length, 0));
  }

  const noElements = await prepareSynthesis(fixtures.no_elements_synthesis);
  assert.equal(noElements.auditable, fixtures.no_elements_expect.auditable);
  const noApplicable = await runCode("Marcar verificacion no disponible", noElements);
  assert.equal(noApplicable.auditoria.estado, fixtures.no_elements_expect.estado);
  assert.equal(noApplicable.auditoria.puntaje, fixtures.no_elements_expect.puntaje);

  const invalidSynthesis = await runCode(
    "Preparar auditoria V3",
    geminiResponse("esto no es JSON"),
    { "Preparar sintesis": { tema: "Prueba", pregunta: "¿Prueba?", citas_total: [] } },
  );
  assert.equal(invalidSynthesis.sintesis_valida, false);
  assert.equal(invalidSynthesis.auditable, false);
  const unavailable = await runCode("Marcar verificacion no disponible", invalidSynthesis);
  assert.equal(unavailable.auditoria.estado, "no_disponible");
  assert.equal(unavailable.auditoria.puntaje, null);
}

validateStructure();
await validateFixtures();
console.log(`V3 ${productionMode ? "de produccion" : "candidata"} válida: ${workflow.nodes.length} nodos, ${fixtures.cases.length + 2} escenarios adversariales comprobados.`);
