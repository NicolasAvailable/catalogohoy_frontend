-- Transcripción IA de notas de voz del chat (generada on-demand por la edge
-- function wa-transcribe con Whisper vía fal.ai; cuesta 1 crédito de IA).
-- Aplicada a prod el 2026-07-21 vía MCP.
alter table chat_messages add column if not exists transcript text;
