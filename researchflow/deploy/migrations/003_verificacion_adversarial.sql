-- ResearchFlow V3 - auditoria adversarial
-- Migracion aditiva e idempotente. No contiene semillas ni elimina datos.

BEGIN;

ALTER TABLE research_requests
  ADD COLUMN IF NOT EXISTS estado_verificacion VARCHAR(30),
  ADD COLUMN IF NOT EXISTS puntaje_verificacion INT,
  ADD COLUMN IF NOT EXISTS nivel_verificacion VARCHAR(20),
  ADD COLUMN IF NOT EXISTS calidad_fuentes_verificacion VARCHAR(20),
  ADD COLUMN IF NOT EXISTS veredicto_verificacion TEXT,
  ADD COLUMN IF NOT EXISTS verificacion_updated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'research_requests_puntaje_verificacion_check'
      AND conrelid = 'research_requests'::regclass
  ) THEN
    ALTER TABLE research_requests
      ADD CONSTRAINT research_requests_puntaje_verificacion_check
      CHECK (puntaje_verificacion IS NULL OR puntaje_verificacion BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'research_requests_verificacion_consistente_check'
      AND conrelid = 'research_requests'::regclass
  ) THEN
    ALTER TABLE research_requests
      ADD CONSTRAINT research_requests_verificacion_consistente_check
      CHECK (
        estado_verificacion IS NULL
        OR (
          estado_verificacion IN ('completa', 'parcial')
          AND puntaje_verificacion IS NOT NULL
          AND (
            (puntaje_verificacion BETWEEN 85 AND 100 AND nivel_verificacion = 'alto')
            OR (puntaje_verificacion BETWEEN 60 AND 84 AND nivel_verificacion = 'medio')
            OR (puntaje_verificacion BETWEEN 0 AND 59 AND nivel_verificacion = 'bajo')
          )
        )
        OR (
          estado_verificacion IN ('no_disponible', 'no_aplicable')
          AND puntaje_verificacion IS NULL
          AND nivel_verificacion = estado_verificacion
        )
      );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS research_verifications (
  id BIGSERIAL PRIMARY KEY,
  request_id INT NOT NULL REFERENCES research_requests(id) ON DELETE CASCADE,
  execution_id VARCHAR(120) NOT NULL,
  estado VARCHAR(30) NOT NULL,
  puntaje INT,
  nivel VARCHAR(20) NOT NULL,
  calidad_fuentes VARCHAR(20) NOT NULL DEFAULT 'no_disponible',
  auditor_modelo VARCHAR(80),
  hechos_auditados JSONB NOT NULL DEFAULT '[]'::jsonb,
  datos_auditados JSONB NOT NULL DEFAULT '[]'::jsonb,
  fuentes_verificacion JSONB NOT NULL DEFAULT '[]'::jsonb,
  contradicciones JSONB NOT NULL DEFAULT '[]'::jsonb,
  limitaciones JSONB NOT NULL DEFAULT '[]'::jsonb,
  respuesta_cruda JSONB,
  respuesta_validada JSONB,
  veredicto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE research_verifications
  ADD COLUMN IF NOT EXISTS execution_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS calidad_fuentes VARCHAR(20) NOT NULL DEFAULT 'no_disponible',
  ADD COLUMN IF NOT EXISTS respuesta_validada JSONB,
  ADD COLUMN IF NOT EXISTS veredicto TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE research_verifications
SET execution_id = 'legacy-' || id::text
WHERE execution_id IS NULL OR execution_id = '';

ALTER TABLE research_verifications
  ALTER COLUMN execution_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'research_verifications_puntaje_check'
      AND conrelid = 'research_verifications'::regclass
  ) THEN
    ALTER TABLE research_verifications
      ADD CONSTRAINT research_verifications_puntaje_check
      CHECK (puntaje IS NULL OR puntaje BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'research_verifications_estado_check'
      AND conrelid = 'research_verifications'::regclass
  ) THEN
    ALTER TABLE research_verifications
      ADD CONSTRAINT research_verifications_estado_check
      CHECK (estado IN ('completa', 'parcial', 'no_disponible', 'no_aplicable'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'research_verifications_consistencia_check'
      AND conrelid = 'research_verifications'::regclass
  ) THEN
    ALTER TABLE research_verifications
      ADD CONSTRAINT research_verifications_consistencia_check
      CHECK (
        (
          estado IN ('completa', 'parcial')
          AND puntaje IS NOT NULL
          AND (
            (puntaje BETWEEN 85 AND 100 AND nivel = 'alto')
            OR (puntaje BETWEEN 60 AND 84 AND nivel = 'medio')
            OR (puntaje BETWEEN 0 AND 59 AND nivel = 'bajo')
          )
        )
        OR (
          estado IN ('no_disponible', 'no_aplicable')
          AND puntaje IS NULL
          AND nivel = estado
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'research_verifications_request_execution_key'
      AND conrelid = 'research_verifications'::regclass
  ) THEN
    ALTER TABLE research_verifications
      ADD CONSTRAINT research_verifications_request_execution_key
      UNIQUE (request_id, execution_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_research_verifications_request_created
  ON research_verifications (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_verifications_estado
  ON research_verifications (estado, created_at DESC);

COMMENT ON COLUMN research_requests.puntaje_verificacion IS
  'Cobertura de verificacion (0-100); no representa probabilidad de verdad.';

COMMENT ON TABLE research_verifications IS
  'Historial idempotente por ejecucion de las auditorias adversariales de ResearchFlow V3.';

COMMIT;
