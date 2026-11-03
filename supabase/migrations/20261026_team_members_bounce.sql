-- Invitaciones de equipo rebotadas: ses-events marca la invitación cuando SES
-- reporta un rebote permanente (el correo no existe) y avisa por email a quien
-- invitó. invited_by guarda quién mandó la invitación (users.id).
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS invited_by bigint REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounce_reason text;
