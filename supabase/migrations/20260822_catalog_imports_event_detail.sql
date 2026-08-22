-- Traza de imports: la fila debe ser autocontenida para soporte.
-- `event` = evento crudo del hub (pdf-ia-error, excel-parse-error, …);
-- `status` sigue siendo el resumen success|partial|failed del check original.
-- Aplicada en prod vía MCP el 2026-08-22 (junto con notify-import-event v15,
-- que es quien inserta las filas).
ALTER TABLE public.catalog_imports
  ADD COLUMN IF NOT EXISTS event text,
  ADD COLUMN IF NOT EXISTS detail text;
