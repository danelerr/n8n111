import { chromatic, slotText } from "/assets/slot-text/index.js";

const chat = document.querySelector("#chat");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const announcer = document.querySelector("#announcer");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const modeLabel = slotText(document.querySelector("#modeLabel"), "Dale forma a tu idea", {
  direction: "up",
  stagger: reducedMotion ? 0 : 28,
  duration: reducedMotion ? 0 : 260,
});
const headerStatus = slotText(document.querySelector("#headerStatus"), "Disponible", {
  direction: "up",
  stagger: reducedMotion ? 0 : 24,
});
const connectionLabel = slotText(document.querySelector("#connectionLabel"), "En línea", {
  direction: "up",
  stagger: reducedMotion ? 0 : 26,
});
const backlogCount = slotText(document.querySelector("#backlogCount"), "0", {
  direction: "up",
  stagger: reducedMotion ? 0 : 34,
});
const sendLabel = slotText(document.querySelector("#sendLabel"), "Enviar", {
  direction: "up",
  stagger: reducedMotion ? 0 : 24,
});

const modePhrases = ["Dale forma a tu idea", "Ordena tus preguntas", "Investiga con evidencia"];
let modeIndex = 0;
let isBusy = false;

if (!reducedMotion) {
  window.setInterval(() => {
    if (isBusy || document.hidden) return;
    modeIndex = (modeIndex + 1) % modePhrases.length;
    modeLabel.set(modePhrases[modeIndex], {
      direction: modeIndex % 2 ? "down" : "up",
    });
  }, 4200);
}

function currentTime() {
  return new Intl.DateTimeFormat("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMessage(value) {
  return escapeHtml(value)
    .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
    .replace(/_([^_\n]+)_/g, "<i>$1</i>")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function scrollToLatest() {
  window.requestAnimationFrame(() => {
    chat.scrollTop = chat.scrollHeight;
  });
}

function createMessage(text, sender = "assistant", options = {}) {
  const row = document.createElement("article");
  row.className = `message-row ${sender === "user" ? "user" : "assistant"}`;

  if (sender !== "user") {
    const avatar = document.createElement("span");
    avatar.className = "message-avatar";
    avatar.textContent = "RF";
    avatar.setAttribute("aria-hidden", "true");
    row.append(avatar);
  }

  const body = document.createElement("div");
  body.className = "message-body";

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.innerHTML = `<strong>${sender === "user" ? "Tú" : "ResearchFlow"}</strong><span>${currentTime()}</span>`;

  const bubble = document.createElement("div");
  bubble.className = `message-bubble${options.typing ? " typing-bubble" : ""}`;
  if (options.welcome) bubble.classList.add("welcome-note");

  if (options.typing) {
    bubble.innerHTML = '<span class="typing-dots" aria-label="ResearchFlow está pensando"><i></i><i></i><i></i></span>';
  } else if (options.welcome) {
    bubble.innerHTML = `
      <span class="mini-label">Empieza sin ordenar nada</span>
      <p>Cuéntame una idea como te venga. La convertiré en un tema claro y preguntas que sí se puedan investigar.</p>
      <p>Usa los accesos de arriba para aterrizar tu idea, revisar las que guardaste o lanzar una investigación.</p>
    `;
  } else {
    bubble.innerHTML = formatMessage(text);
  }

  body.append(meta, bubble);
  row.append(body);
  chat.append(row);
  scrollToLatest();
  return { row, bubble };
}

function updateBacklog(value) {
  if (!Number.isFinite(Number(value))) return;
  backlogCount.set(String(value), {
    direction: Number(value) > Number(backlogCount.value) ? "up" : "down",
    color: reducedMotion ? undefined : chromatic(),
  });
}

function autoResize() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
}

function setBusy(busy, restoreHealthyStatus = true) {
  isBusy = busy;
  sendButton.disabled = busy;
  input.disabled = busy;

  if (busy) {
    sendLabel.set("Pensando", { direction: "up" });
    headerStatus.set("Analizando", { direction: "up", color: "#ff7458" });
    connectionLabel.set("Procesando", { direction: "up" });
    modeLabel.set("Conecta los puntos", { direction: "up" });
  } else {
    sendLabel.set("Enviar", { direction: "down" });
    if (restoreHealthyStatus) {
      headerStatus.flash("Listo", {
        revertAfter: 1300,
        enter: { direction: "up", color: reducedMotion ? undefined : chromatic() },
        exit: { direction: "down" },
      });
      connectionLabel.set("En línea", { direction: "down" });
      modeLabel.set("Dale forma a tu idea", { direction: "down" });
    }
  }
}

async function sendMessage(explicitText) {
  if (isBusy) return;
  const text = String(explicitText ?? input.value).trim();
  if (!text) return;

  createMessage(text, "user");
  input.value = "";
  autoResize();
  setBusy(true);
  const typing = createMessage("", "assistant", { typing: true });
  let requestSucceeded = false;

  try {
    const response = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No se pudo procesar el mensaje");

    typing.bubble.classList.remove("typing-bubble");
    typing.bubble.innerHTML = formatMessage(data.reply || "No recibí una respuesta.");
    updateBacklog(data.backlog_count);
    announcer.textContent = "ResearchFlow respondió";
    requestSucceeded = true;
  } catch (error) {
    typing.bubble.classList.remove("typing-bubble");
    typing.bubble.innerHTML = formatMessage(
      "No pude conectar con el asistente. Inténtalo nuevamente en unos segundos.",
    );
    headerStatus.set("Sin conexión", { direction: "down", color: "#ff7458" });
    connectionLabel.set("Reintentando", { direction: "down" });
    announcer.textContent = error.message;
  } finally {
    setBusy(false, requestSucceeded);
    scrollToLatest();
    input.focus({ preventScroll: true });
  }
}

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt || "";
    autoResize();
    input.focus();
  });
});

sendButton.addEventListener("click", () => sendMessage());
input.addEventListener("input", autoResize);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendMessage();
  }
});

async function loadHealth() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) throw new Error("healthcheck failed");
    const data = await response.json();
    updateBacklog(data.backlog_count);
    connectionLabel.set("En línea", { direction: "up" });
  } catch {
    connectionLabel.set("Sin conexión", { direction: "down", color: "#ff7458" });
    headerStatus.set("No disponible", { direction: "down", color: "#ff7458" });
  }
}

createMessage("", "assistant", { welcome: true });
autoResize();
loadHealth();
input.focus({ preventScroll: true });
