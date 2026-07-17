-- ResearchFlow V3 - conservar URLs completas de soporte en la evidencia.
-- Idempotente: repetir el ALTER cuando la columna ya es TEXT no pierde datos.

BEGIN;

ALTER TABLE research_evidence
  ALTER COLUMN soporte TYPE TEXT USING soporte::text;

COMMENT ON COLUMN research_evidence.soporte IS
  'Referencia o URL completa que respalda la evidencia; no debe truncarse.';

COMMIT;
