-- Frete oferecido sem cobrança.

ALTER TYPE public.frete_status_enum ADD VALUE IF NOT EXISTS 'cortesia';
