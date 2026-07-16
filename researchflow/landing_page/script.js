// URL del webhook de ResearchFlow.
// - En Vercel con vercel.json: dejar "/api/investigar" (proxy sin CORS).
// - Sin proxy: poner la URL completa, ej. "https://n8n.TU-DOMINIO/webhook/researchflow"
//   (o ".../webhook/researchflow-demo" para el workflow demo sin credenciales).
const WEBHOOK_URL = "/api/investigar";

const form = document.querySelector("#researchForm");
const statusNode = document.querySelector("#formStatus");
const submitBtn = document.querySelector("#submitBtn");
const resultado = document.querySelector("#resultado");

function setStatus(message, type = "") {
  statusNode.textContent = message;
  statusNode.className = `form-status ${type}`.trim();
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function renderPreguntas(data) {
  const items = (data.preguntas || [])
    .map((p) => {
      const pregunta = typeof p === "string" ? p : p.pregunta;
      const razon = typeof p === "object" && p.por_que_interesa ? p.por_que_interesa : "";
      return `<li><strong>${escapeHtml(pregunta)}</strong>${razon ? `<br><em>${escapeHtml(razon)}</em>` : ""}</li>`;
    })
    .join("");
  resultado.innerHTML = `
    <h2>Preguntas propuestas</h2>
    <p>Tema: <strong>${escapeHtml(data.tema_refinado || data.tema || "")}</strong></p>
    <ol class="preguntas-list">${items}</ol>
    <p class="resultado-nota">Elige una, pegala en el campo "Pregunta central" y vuelve a enviar para lanzar la investigacion completa.${data.nota ? `<br><em>${escapeHtml(data.nota)}</em>` : ""}</p>`;
  resultado.hidden = false;
}

function renderConfianza(data) {
  const puntaje = data.puntaje_calidad;
  const nivel = String(data.nivel_confianza || "").toLowerCase();
  if (puntaje == null && !nivel) return "";
  const cls = nivel === "alto" ? "alto" : nivel === "bajo" ? "bajo" : "medio";
  const etiqueta = `Confianza ${nivel ? nivel.toUpperCase() : "MEDIA"}${puntaje != null ? ` · ${escapeHtml(puntaje)}/100` : ""}`;
  return `<div class="confianza confianza-${cls}"><span class="confianza-badge">${etiqueta}</span>${
    data.veredicto ? `<span class="confianza-veredicto">${escapeHtml(data.veredicto)}</span>` : ""
  }</div>`;
}

function renderInvestigacion(data) {
  if (data.informe_markdown || data.grafico_url) {
    resultado.innerHTML = `
      <h2>Resultado</h2>
      ${renderConfianza(data)}
      ${data.respuesta_corta ? `<p><strong>${escapeHtml(data.respuesta_corta)}</strong></p>` : ""}
      ${data.resumen ? `<p>${escapeHtml(data.resumen)}</p>` : ""}
      ${data.grafico_url ? `<img class="resultado-grafico" src="${encodeURI(data.grafico_url)}" alt="Grafico generado" />` : ""}
      ${data.informe_markdown ? `<pre class="resultado-informe">${escapeHtml(data.informe_markdown)}</pre>` : ""}
      ${data.nota ? `<p class="resultado-nota"><em>${escapeHtml(data.nota)}</em></p>` : ""}`;
  } else {
    resultado.innerHTML = `
      <h2>Investigacion en curso</h2>
      <p>${escapeHtml(data.mensaje || "Tu investigacion esta en proceso.")}</p>
      ${data.request_id ? `<p>Numero de solicitud: <strong>#${escapeHtml(data.request_id)}</strong></p>` : ""}
      <p class="resultado-nota">Pasa por 4 fases (base, profundizacion, sintesis y verificacion adversarial). El articulo con graficos, fuentes y su <strong>puntaje de confianza</strong> llegara a tu correo${form.elements.whatsapp.value ? " y un aviso a tu WhatsApp" : ""}.</p>`;
  }
  resultado.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.submitted_at = new Date().toISOString();

  const generaPreguntas = !String(payload.pregunta || "").trim();
  resultado.hidden = true;
  submitBtn.disabled = true;
  setStatus(generaPreguntas ? "Generando preguntas interesantes..." : "Lanzando investigacion profunda...");

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json().catch(() => ({}));

    if (data.modo === "preguntas_generadas") {
      setStatus("Listo: preguntas generadas (tambien enviadas a tu correo).", "success");
      renderPreguntas(data);
    } else {
      setStatus(generaPreguntas ? "Solicitud procesada." : "Investigacion iniciada correctamente.", "success");
      renderInvestigacion(data);
    }
  } catch (error) {
    setStatus("No se pudo enviar. Verifica la URL del webhook y que n8n este activo.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});
