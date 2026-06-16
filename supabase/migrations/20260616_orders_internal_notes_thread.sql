-- Internal team notes as a chat-style thread: [{ author, text, createdAt }].
-- Admin-only; never shown to the customer. Supersedes the single-text
-- internal_comments column (kept in place, unused).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS internal_notes jsonb NOT NULL DEFAULT '[]'::jsonb;
