-- Internal team notes on an order (separate from the customer's `comments`).
-- Visible/editable only in the admin order detail; never shown to the customer.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS internal_comments text;
