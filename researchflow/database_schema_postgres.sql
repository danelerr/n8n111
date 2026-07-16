-- ResearchFlow - Esquema PostgreSQL (produccion: droplet DigitalOcean o Supabase)
-- Ejecutar sobre la base "researchflow" antes de activar los workflows.

CREATE TABLE IF NOT EXISTS research_requests (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(180),
  whatsapp VARCHAR(40),
  tema VARCHAR(220) NOT NULL,
  pregunta TEXT NOT NULL DEFAULT '',
  url_fuente TEXT,
  texto_fuente TEXT,
  tipo_entregable VARCHAR(80) DEFAULT 'informe breve',
  prioridad VARCHAR(30) DEFAULT 'media',
  canal_origen VARCHAR(60) DEFAULT 'web',
  modo VARCHAR(40) DEFAULT 'investigar',
  estado VARCHAR(40) DEFAULT 'nuevo',
  resumen TEXT,
  informe_markdown TEXT,
  puntaje_calidad INT,               -- confianza 0-100 asignada por la fase 4 (verificacion adversarial)
  nivel_confianza VARCHAR(20),       -- alto | medio | bajo
  veredicto TEXT,                    -- juicio en 1-2 frases de la auditoria
  error_detalle TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS research_sources (
  id SERIAL PRIMARY KEY,
  request_id INT REFERENCES research_requests(id),
  titulo VARCHAR(220),
  url TEXT,
  tipo VARCHAR(80) DEFAULT 'web',
  texto_extraido TEXT,
  calidad VARCHAR(40) DEFAULT 'pendiente',
  confianza VARCHAR(40) DEFAULT 'pendiente',
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_evidence (
  id SERIAL PRIMARY KEY,
  request_id INT REFERENCES research_requests(id),
  source_id INT NULL REFERENCES research_sources(id),
  tipo VARCHAR(60) NOT NULL,
  afirmacion TEXT NOT NULL,
  soporte VARCHAR(80) DEFAULT 'requiere_verificacion',
  confianza VARCHAR(40) DEFAULT 'media',
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_artifacts (
  id SERIAL PRIMARY KEY,
  request_id INT REFERENCES research_requests(id),
  tipo VARCHAR(80) NOT NULL,
  titulo VARCHAR(220),
  contenido TEXT,
  drive_url TEXT,
  estado VARCHAR(40) DEFAULT 'borrador',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backlog de ideas capturadas por WhatsApp (o web) antes de convertirse en investigacion.
-- Flujo de estados: idea -> refinada -> en_cola -> investigada | descartada
CREATE TABLE IF NOT EXISTS research_ideas (
  id SERIAL PRIMARY KEY,
  origen VARCHAR(60) DEFAULT 'whatsapp',
  idea_original TEXT NOT NULL,
  tema_refinado VARCHAR(220),
  preguntas_sugeridas TEXT,
  notas_conversacion TEXT,
  estado VARCHAR(40) DEFAULT 'idea',
  request_id INT NULL REFERENCES research_requests(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL
);

-- Datasets numericos extraidos durante la investigacion. Cada punto lleva su fuente.
-- datos_json: [{"etiqueta":..., "valor":..., "unidad":..., "periodo":..., "fuente_url":...}]
CREATE TABLE IF NOT EXISTS research_datasets (
  id SERIAL PRIMARY KEY,
  request_id INT REFERENCES research_requests(id),
  titulo VARCHAR(220) NOT NULL,
  descripcion TEXT,
  datos_json TEXT NOT NULL,
  fuente_principal TEXT,
  tipo_grafico VARCHAR(40) DEFAULT 'barras',
  quickchart_url TEXT,
  sheets_url TEXT,
  estado VARCHAR(40) DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auditoria adversarial (Fase 4). Una fila por investigacion: puntaje de confianza,
-- veredicto y banderas rojas producidas por el nodo "Gemini - Verificacion".
CREATE TABLE IF NOT EXISTS research_verifications (
  id SERIAL PRIMARY KEY,
  request_id INT REFERENCES research_requests(id),
  puntaje_calidad INT,          -- 0-100
  nivel_confianza VARCHAR(20),  -- alto | medio | bajo
  veredicto TEXT,
  senales_alerta TEXT,          -- JSON array de banderas rojas
  contradicciones TEXT,         -- JSON array
  limitaciones TEXT,            -- JSON array
  hechos_auditados TEXT,        -- JSON array [{afirmacion, estado, nota}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upgrade idempotente para bases existentes (v2 -> v3): agrega las columnas de confianza
-- a research_requests si aun no existen. En instalaciones nuevas no hace nada.
ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS puntaje_calidad INT;
ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS nivel_confianza VARCHAR(20);
ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS veredicto TEXT;

-- Configuracion editable sin tocar los workflows (playbook, numeros, flags).
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(80) PRIMARY KEY,
  value TEXT NOT NULL,
  descripcion TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playbook de investigacion (version condensada de playbook_investigacion.md).
-- Editar este registro cambia el estilo de investigacion SIN tocar los workflows.
INSERT INTO app_settings (key, value, descripcion) VALUES (
  'playbook_investigacion',
  $pb$METODOLOGIA PREFERIDA DEL USUARIO (guia adaptable, NO camisa de fuerza; si una fase no aplica al tema, saltala y di por que):

FASE 0 - ENCARGO: si solo hay TEMA, genera 3-5 preguntas investigables, especificas y sorprendentes. Si hay PREGUNTA vaga, reformulala registrando ambas versiones.
FASE 1 - BASE: entiende la verdad basica antes de opinar. Usa Wikipedia como punto de partida (intro del articulo, seccion de referencias para fuentes primarias, pagina de discusion para detectar controversias), nunca como fuente final. Descubre el vocabulario tecnico del tema (espanol e ingles) y usalo en las busquedas.
FASE 2 - FUENTES con jerarquia: (1) datos primarios, papers, estadisticas oficiales; Our World in Data preferido para estadisticas; (2) medios de investigacion original (Reuters, AP, Bloomberg, BBC, The Economist, NYT, WSJ); (3) medios de analisis, marcados como analisis; (4) opinion/redes solo para mapear percepciones; (5) propaganda: NUNCA como evidencia. Evalua el incentivo de cada medio y registra su sesgo probable. "Escuchar ambas partes" NO produce neutralidad: pondera por evidencia.
FASE 3 - PROFUNDIZAR: aplica los 5 porques hasta la causa estructural. Clasifica cada afirmacion como HECHO (evidencia verificable con fuente), HIPOTESIS (marcar requiere_verificacion) u OPINION (atribuida). Cambiar de conclusion ante nueva evidencia es rigor, no error.
FASE 4 - DATOS: solo se grafican cifras reales encontradas en fuentes, con fuente pegada a cada dato. Sin cifras confiables NO hay grafico y el informe lo dice. Evolucion temporal=lineas; comparacion=barras; composicion de un total=pastel.
FASE 5 - SINTESIS: estructura del articulo: la pregunta y por que importa; respuesta corta; hechos con fuentes; el porque (5 porques); lo que no se sabe; conclusiones; 2-3 preguntas abiertas nuevas.
FASE 6 - VERIFICACION ADVERSARIAL: antes de dar por buena la investigacion, audita el informe como un revisor hostil. Comprueba en la web las cifras y hechos clave; marca cada hecho como verificado, dudoso, sin_fuente o reclasificar_hipotesis; detecta contradicciones internas; asigna un puntaje de confianza 0-100 (alto/medio/bajo) y un veredicto honesto. Un informe que reconoce lo que no sabe puede tener buen puntaje; uno que sobre-afirma sin fuente, no.
ADAPTACION: cientifico/salud=papers y consenso; actualidad=medios de investigacion original e incentivos; economia/datos=OWID y organismos oficiales; local/nicho (ej. Bolivia)=prensa local seria, ONG, datos oficiales del pais, triangular mas; tecnico=documentacion oficial.
REGLAS DURAS (sin excepcion): 1) NUNCA inventar cifras, citas ni fuentes. 2) Toda afirmacion factual lleva fuente o se marca requiere_verificacion. 3) No presentar hipotesis u opiniones como hechos. 4) No usar propaganda como evidencia. 5) Si la evidencia es insuficiente, decirlo con claridad. 6) Toda investigacion pasa por la verificacion adversarial y publica su puntaje de confianza.$pb$,
  'Metodologia inyectada en los prompts de investigacion. Version larga: playbook_investigacion.md'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO research_requests
(nombre, email, whatsapp, tema, pregunta, url_fuente, tipo_entregable, prioridad, canal_origen, estado)
VALUES
('Daniel', 'prueba@example.com', '59170000000', 'Adopcion de criptomonedas en Bolivia', 'Se usan realmente las criptomonedas en Bolivia o solo se especula?', 'https://www.bcb.gob.bo/', 'articulo', 'alta', 'seed', 'nuevo')
ON CONFLICT DO NOTHING;
