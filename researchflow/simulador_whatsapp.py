#!/usr/bin/env python3
"""Servidor del ResearchFlow Idea Lab.

Sirve el frontend compilado de ``chat/dist`` y expone dos endpoints:
``GET /api/health`` y ``POST /api/send``. La configuracion sensible se obtiene
exclusivamente desde variables de entorno inyectadas por Docker Compose.
"""

from __future__ import annotations

import http.server
import json
import mimetypes
import os
from pathlib import Path
import re
import sys
import threading
import urllib.parse
import urllib.request


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "chat" / "dist"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)
RESEARCH_WEBHOOK = os.environ.get(
    "RESEARCH_WEBHOOK_URL",
    "https://n8n.camba.tech/webhook/researchflow",
)
OWNER_NAME = os.environ.get("OWNER_NAME", "ResearchFlow")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "")
OWNER_WHATSAPP = os.environ.get("OWNER_WHATSAPP", "")
PORT = int(os.environ.get("PORT", "8777"))


SYSTEM_PROMPT = (
    "Eres ResearchFlow Ideas, el asistente de Daniel para capturar y refinar ideas "
    "de investigacion. El usuario suele mandar ideas vagas; tu trabajo es convertirlas "
    "en material investigable, NO investigar todavia. En cada respuesta: 1) reformula "
    "la idea como un tema claro (linea que empiece con 'Tema:'), 2) propone 3 a 5 "
    "preguntas investigables numeradas (1. 2. 3.), especificas, comprobables con "
    "evidencia e interesantes para compartir, mezclando angulos (datos, causas, mitos, "
    "impacto, futuro), 3) si la idea es demasiado vaga, haz UNA pregunta aclaratoria y "
    "aun asi propone 2 preguntas tentativas. Se breve (maximo 900 caracteres), tono "
    "cercano y espanol. No inventes datos ni cifras: aqui solo se formulan preguntas. "
    "Toda idea queda guardada automaticamente en el backlog; recuerda que el usuario "
    "puede escribir 'ideas' e 'investigar N'."
)


backlog: list[dict[str, str]] = []
backlog_lock = threading.Lock()


def backlog_size() -> int:
    with backlog_lock:
        return len(backlog)


def call_gemini(user_text: str) -> str:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY no configurada")

    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
    }
    request = urllib.request.Request(
        GEMINI_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.loads(response.read())

    try:
        return payload["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError) as error:
        raise RuntimeError("Respuesta inesperada de Gemini") from error


def _clean(value: str) -> str:
    return re.sub(r"^\**\s*", "", value.strip()).strip().strip("*").strip()


def parse_tema_pregunta(text: str) -> tuple[str, str]:
    tema = ""
    match_tema = re.search(r"Tema:\**\s*(.+)", text)
    if match_tema:
        tema = _clean(match_tema.group(1))

    pregunta = ""
    match_question = re.search(r"^\s*\**\s*1[).\-]\s*(.+)", text, re.MULTILINE)
    if match_question:
        pregunta = _clean(match_question.group(1))
    return tema, pregunta


def lanzar_investigacion(idea: dict[str, str]) -> dict:
    payload = {
        "nombre": OWNER_NAME,
        "email": OWNER_EMAIL,
        "whatsapp": OWNER_WHATSAPP,
        "tema": idea.get("tema") or idea.get("idea_original", ""),
        "pregunta": idea.get("pregunta", ""),
        "tipo_entregable": "articulo",
        "prioridad": "media",
        "origen": "simulador_whatsapp",
    }
    request = urllib.request.Request(
        RESEARCH_WEBHOOK,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read())


def delivery_destination() -> str:
    return f"*{OWNER_EMAIL}*" if OWNER_EMAIL else "el correo configurado"


def handle_message(text: str) -> str:
    message = (text or "").strip()
    normalized = message.lower()

    if not message:
        return "Mandame una idea de investigacion y la convierto en preguntas claras."

    if normalized == "ideas":
        with backlog_lock:
            current_backlog = list(backlog)
        if not current_backlog:
            return "Tu backlog esta vacio. Mandame una idea y la refino automaticamente."
        lines = ["*Tu backlog de ideas:*"]
        for index, item in enumerate(current_backlog, 1):
            lines.append(f"{index}. {item['tema'] or item['idea_original']}")
        lines.append("\n_Escribe 'investigar N' para profundizar la idea N._")
        return "\n".join(lines)

    numbered_command = re.match(r"investigar\s+(\d+)\s*$", normalized)
    if numbered_command:
        number = int(numbered_command.group(1))
        with backlog_lock:
            idea = dict(backlog[number - 1]) if 0 < number <= len(backlog) else None
        if idea is None:
            return f"No encontre la idea #{number}. Escribe 'ideas' para ver tu backlog."
        try:
            response = lanzar_investigacion(idea)
            request_id = response.get("request_id", "?")
            return (
                f"Investigacion profunda #{request_id} lanzada para la idea #{number} "
                f"(\"{idea['tema'] or idea['idea_original']}\").\n\n"
                f"El articulo con graficos y fuentes llegara a {delivery_destination()} "
                "en unos minutos."
            )
        except Exception as error:  # noqa: BLE001 - frontera HTTP
            print(f"No se pudo lanzar una investigacion: {type(error).__name__}", file=sys.stderr)
            return "No pude lanzar la investigacion. Intentalo nuevamente en unos minutos."

    direct_command = re.match(
        r"(?:investigar|investiga(?:\s+a\s+fondo)?|profund[ao]|investigacion\s+profunda)"
        r"\s*[:\-]?\s+(.+)",
        message,
        re.IGNORECASE,
    )
    if direct_command:
        query = direct_command.group(1).strip()
        idea = {"tema": query, "pregunta": query, "idea_original": query}
        try:
            response = lanzar_investigacion(idea)
            request_id = response.get("request_id", "?")
            return (
                f"Investigacion profunda #{request_id} lanzada sobre: \"{query}\".\n\n"
                "En unos minutos llegara el articulo con graficos, hechos citados y "
                f"fuentes a {delivery_destination()}."
            )
        except Exception as error:  # noqa: BLE001 - frontera HTTP
            print(f"No se pudo lanzar una investigacion: {type(error).__name__}", file=sys.stderr)
            return "No pude lanzar la investigacion. Intentalo nuevamente en unos minutos."

    try:
        reply = call_gemini(message)
    except Exception as error:  # noqa: BLE001 - frontera HTTP
        print(f"No se pudo contactar Gemini: {type(error).__name__}", file=sys.stderr)
        return "No pude contactar al motor de ideas. Intentalo nuevamente en unos segundos."

    tema, pregunta = parse_tema_pregunta(reply)
    with backlog_lock:
        backlog.append(
            {
                "idea_original": message,
                "tema": tema,
                "pregunta": pregunta,
                "respuesta": reply,
            }
        )
    return reply


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "ResearchFlow/3"

    def log_message(self, *_args) -> None:
        return

    def _security_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; connect-src 'self'; base-uri 'none'; "
            "frame-ancestors 'none'",
        )

    def _send_json(self, payload: dict, status: int = 200, head_only: bool = False) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._security_headers()
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def _send_static(self, head_only: bool = False) -> None:
        request_path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        relative_path = "index.html" if request_path == "/" else request_path.lstrip("/")
        static_root = STATIC_DIR.resolve()
        candidate = (static_root / relative_path).resolve()

        try:
            candidate.relative_to(static_root)
        except ValueError:
            self.send_error(404)
            return

        if not candidate.is_file():
            self.send_error(404)
            return

        body = candidate.read_bytes()
        content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        if candidate.suffix == ".js":
            content_type = "application/javascript"

        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header(
            "Cache-Control",
            "no-cache" if candidate.name == "index.html" else "public, max-age=3600",
        )
        self._security_headers()
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - API de BaseHTTPRequestHandler
        if urllib.parse.urlsplit(self.path).path == "/api/health":
            self._send_json({"status": "ok", "backlog_count": backlog_size()})
            return
        self._send_static()

    def do_HEAD(self) -> None:  # noqa: N802 - API de BaseHTTPRequestHandler
        if urllib.parse.urlsplit(self.path).path == "/api/health":
            self._send_json(
                {"status": "ok", "backlog_count": backlog_size()},
                head_only=True,
            )
            return
        self._send_static(head_only=True)

    def do_POST(self) -> None:  # noqa: N802 - API de BaseHTTPRequestHandler
        if urllib.parse.urlsplit(self.path).path != "/api/send":
            self._send_json({"error": "Ruta no encontrada"}, 404)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length > 65536:
                self._send_json({"error": "Mensaje demasiado grande"}, 413)
                return
            data = json.loads(self.rfile.read(content_length) or b"{}")
            text = data.get("text", "")
            if not isinstance(text, str):
                raise ValueError("text debe ser string")
        except (ValueError, json.JSONDecodeError):
            self._send_json({"error": "Solicitud invalida"}, 400)
            return

        reply = handle_message(text)
        self._send_json({"reply": reply, "backlog_count": backlog_size()})


if __name__ == "__main__":
    if not (STATIC_DIR / "index.html").is_file():
        raise SystemExit("Falta chat/dist. Ejecuta: cd chat && pnpm build")

    print(f"ResearchFlow Idea Lab disponible en http://localhost:{PORT}")
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("ResearchFlow Idea Lab detenido")
