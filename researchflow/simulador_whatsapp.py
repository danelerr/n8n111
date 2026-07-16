#!/usr/bin/env python3
"""
Simulador de chat WhatsApp para ResearchFlow.
Reproduce el bot "Ideas por WhatsApp" (mismo system prompt y modelo Gemini)
sin depender de WhatsApp/Evolution. El comando "investigar N" dispara la
investigacion REAL contra el webhook de produccion (llega articulo por correo).

Uso:
    python3 simulador_whatsapp.py
    -> abre http://localhost:8777 en tu navegador
"""
import http.server
import socketserver
import json
import re
import urllib.request

# ----------------- Config (misma que el .env de produccion) -----------------
GEMINI_API_KEY = "AIzaSyCyZwhONciJzsx4gnfAslIrznT46kSKzqI"
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY
)
RESEARCH_WEBHOOK = "https://n8n.camba.tech/webhook/researchflow"
OWNER_NAME = "Daniel Cueto Torrico"
OWNER_EMAIL = "danielcuetorrico@gmail.com"
OWNER_WHATSAPP = "59177667376"
PORT = 8777

# System prompt IDENTICO al del nodo "AI Agent - Refinar idea"
SYSTEM_PROMPT = (
    "Eres ResearchFlow Ideas, el asistente de WhatsApp de Daniel para capturar y "
    "refinar ideas de investigacion. El usuario suele mandar ideas vagas; tu trabajo "
    "es convertirlas en material investigable, NO investigar todavia. En cada respuesta: "
    "1) reformula la idea como un tema claro (linea que empiece con 'Tema:'), "
    "2) propone 3 a 5 preguntas investigables numeradas (1. 2. 3.), especificas, "
    "comprobables con evidencia e interesantes para compartir, mezclando angulos "
    "(datos, causas, mitos, impacto, futuro), 3) si la idea es demasiado vaga, haz UNA "
    "pregunta aclaratoria y aun asi propone 2 preguntas tentativas. Se breve (mensaje de "
    "WhatsApp, maximo ~900 caracteres), tono cercano, espanol. No inventes datos ni cifras: "
    "aqui solo se formulan preguntas. Toda idea queda guardada automaticamente en el backlog; "
    "recuerda al usuario que puede escribir 'ideas' para ver su backlog e 'investigar N' para "
    "lanzar la investigacion completa de la idea N."
)

# Backlog en memoria (equivalente a research_ideas)
backlog = []


def call_gemini(user_text):
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
    }
    req = urllib.request.Request(
        GEMINI_URL,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.loads(r.read())
    return d["candidates"][0]["content"]["parts"][0]["text"].strip()


def _clean(s):
    # quita marcas markdown y puntuacion sobrante
    return re.sub(r"^\**\s*", "", s.strip()).strip().strip("*").strip()


def parse_tema_pregunta(text):
    tema = ""
    m = re.search(r"Tema:\**\s*(.+)", text)
    if m:
        tema = _clean(m.group(1))
    pregunta = ""
    mq = re.search(r"^\s*\**\s*1[\).\.\-]\s*(.+)", text, re.M)
    if mq:
        pregunta = _clean(mq.group(1))
    return tema, pregunta


def lanzar_investigacion(idea):
    payload = {
        "nombre": OWNER_NAME,
        "email": OWNER_EMAIL,
        "whatsapp": OWNER_WHATSAPP,
        "tema": idea["tema"] or idea["idea_original"],
        "pregunta": idea["pregunta"] or "",
        "tipo_entregable": "articulo",
        "prioridad": "media",
        "origen": "simulador_whatsapp",
    }
    req = urllib.request.Request(
        RESEARCH_WEBHOOK,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def handle_message(text):
    t = (text or "").strip()
    low = t.lower()

    if not t:
        return "Mandame una idea de investigacion y la refino."

    if low == "ideas":
        if not backlog:
            return "Tu backlog esta vacio. Mandame una idea y la refino automaticamente."
        lines = ["*Tu backlog de ideas:*"]
        for i, it in enumerate(backlog, 1):
            lines.append(f"{i}. {it['tema'] or it['idea_original']}")
        lines.append("\n_Escribe 'investigar N' para lanzar la investigacion de la idea N._")
        return "\n".join(lines)

    # "investigar N" -> investigacion profunda de la idea N del backlog
    m = re.match(r"investigar\s+(\d+)\s*$", low)
    if m:
        n = int(m.group(1))
        if n < 1 or n > len(backlog):
            return f"No encontre la idea #{n}. Escribe 'ideas' para ver tu backlog."
        idea = backlog[n - 1]
        try:
            resp = lanzar_investigacion(idea)
            rid = resp.get("request_id", "?")
            return (
                f"Investigacion profunda #{rid} lanzada para la idea #{n} "
                f"(\"{idea['tema'] or idea['idea_original']}\").\n\n"
                f"El articulo con graficos y fuentes llegara a *{OWNER_EMAIL}* en unos minutos."
            )
        except Exception as e:
            return f"No pude lanzar la investigacion: {e}"

    # Investigacion profunda DIRECTA (sin pasar por el backlog):
    #   "investigar: <pregunta>"  /  "investiga a fondo <tema>"  /  "profundo <tema>"
    md = re.match(r"(?:investigar|investiga(?:\s+a\s+fondo)?|profund[ao]|investigacion\s+profunda)\s*[:\-]?\s+(.+)", t, re.I)
    if md:
        query = md.group(1).strip()
        idea = {"tema": query, "pregunta": query, "idea_original": query}
        try:
            resp = lanzar_investigacion(idea)
            rid = resp.get("request_id", "?")
            return (
                f"Investigacion profunda #{rid} lanzada sobre: \"{query}\".\n\n"
                f"En unos minutos llega el articulo con graficos, hechos citados y "
                f"fuentes a *{OWNER_EMAIL}*."
            )
        except Exception as e:
            return f"No pude lanzar la investigacion: {e}"

    # Refinar idea con Gemini (comportamiento del AI Agent)
    try:
        reply = call_gemini(t)
    except Exception as e:
        return f"(Error al contactar Gemini: {e})"
    tema, pregunta = parse_tema_pregunta(reply)
    backlog.append(
        {"idea_original": t, "tema": tema, "pregunta": pregunta, "respuesta": reply}
    )
    return reply


HTML = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ResearchFlow - Simulador WhatsApp</title>
<style>
  :root { --wa-green:#25D366; --wa-dark:#075E54; --wa-bg:#ECE5DD; --out:#DCF8C6; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
         background:#111; display:flex; justify-content:center; align-items:center; height:100vh; }
  .phone { width:420px; max-width:100%; height:92vh; background:var(--wa-bg);
           display:flex; flex-direction:column; border-radius:14px; overflow:hidden;
           box-shadow:0 10px 40px rgba(0,0,0,.5); }
  .header { background:var(--wa-dark); color:#fff; padding:12px 16px; display:flex; align-items:center; gap:12px; }
  .avatar { width:40px; height:40px; border-radius:50%; background:var(--wa-green);
            display:flex; align-items:center; justify-content:center; font-weight:700; }
  .header .name { font-weight:600; }
  .header .sub { font-size:12px; opacity:.8; }
  .chat { flex:1; overflow-y:auto; padding:16px;
          background-image:linear-gradient(rgba(229,221,213,.6),rgba(229,221,213,.6)); }
  .msg { max-width:78%; padding:8px 12px; border-radius:8px; margin:6px 0; white-space:pre-wrap;
         word-wrap:break-word; font-size:14px; line-height:1.35; box-shadow:0 1px 1px rgba(0,0,0,.1); }
  .bot { background:#fff; align-self:flex-start; border-top-left-radius:0; }
  .me  { background:var(--out); margin-left:auto; border-top-right-radius:0; }
  .row { display:flex; }
  .time { font-size:10px; color:#888; text-align:right; margin-top:2px; }
  .typing { font-style:italic; color:#555; }
  .inputbar { display:flex; padding:10px; gap:8px; background:#f0f0f0; }
  .inputbar input { flex:1; padding:11px 14px; border:none; border-radius:22px; font-size:14px; outline:none; }
  .inputbar button { background:var(--wa-green); color:#fff; border:none; width:46px; height:46px;
                     border-radius:50%; font-size:20px; cursor:pointer; }
  .hint { text-align:center; font-size:11px; color:#667; padding:4px; }
  b { font-weight:600; }
</style>
</head>
<body>
  <div class="phone">
    <div class="header">
      <div class="avatar">RF</div>
      <div>
        <div class="name">ResearchFlow Ideas</div>
        <div class="sub" id="sub">en linea (simulador)</div>
      </div>
    </div>
    <div class="chat" id="chat"></div>
    <div class="hint">Idea &middot; <b>ideas</b> &middot; <b>investigar 1</b> &middot; <b>investigar: tu pregunta</b></div>
    <div class="inputbar">
      <input id="inp" placeholder="Escribe una idea..." autocomplete="off">
      <button id="send">&#10148;</button>
    </div>
  </div>
<script>
const chat = document.getElementById('chat');
const inp = document.getElementById('inp');
const btn = document.getElementById('send');
function now(){ const d=new Date(); return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0'); }
function fmt(t){ return t.replace(/\\*(.+?)\\*/g,'<b>$1</b>').replace(/_(.+?)_/g,'<i>$1</i>'); }
function bubble(text, who){
  const row=document.createElement('div'); row.className='row';
  const b=document.createElement('div'); b.className='msg '+(who==='me'?'me':'bot');
  b.innerHTML=fmt(text)+'<div class="time">'+now()+'</div>';
  if(who==='me') row.style.justifyContent='flex-end';
  row.appendChild(b); chat.appendChild(row); chat.scrollTop=chat.scrollHeight;
  return b;
}
async function send(){
  const text=inp.value.trim(); if(!text) return;
  bubble(text,'me'); inp.value=''; btn.disabled=true;
  const t=bubble('escribiendo...','bot'); t.classList.add('typing');
  try{
    const r=await fetch('/api/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
    const d=await r.json();
    t.classList.remove('typing'); t.innerHTML=fmt(d.reply)+'<div class="time">'+now()+'</div>';
  }catch(e){ t.classList.remove('typing'); t.textContent='(error de conexion)'; }
  chat.scrollTop=chat.scrollHeight; btn.disabled=false; inp.focus();
}
btn.onclick=send;
inp.addEventListener('keydown',e=>{ if(e.key==='Enter') send(); });
bubble('Hola! Soy tu asistente de investigacion.\\n\\n1) Mandame una *idea vaga* y la refino en un tema con preguntas.\\n2) Escribe *ideas* para ver tu backlog.\\n3) *investigar N* lanza la investigacion profunda de la idea N.\\n\\nO pide una investigacion profunda directa asi:\\n*investigar: tu pregunta concreta*\\n(llega un articulo con graficos y fuentes a tu correo)','bot');
inp.focus();
</script>
</body>
</html>"""


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(HTML.encode("utf-8"))

    def do_POST(self):
        if self.path != "/api/send":
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(length) or b"{}")
        reply = handle_message(data.get("text", ""))
        out = json.dumps({"reply": reply}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(out)


if __name__ == "__main__":
    print(f"\n  ResearchFlow - Simulador WhatsApp")
    print(f"  Abre en tu navegador:  http://localhost:{PORT}\n")
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Simulador detenido.")
