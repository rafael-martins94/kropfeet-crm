-- Ao criar um usuário pelo CRM, o administrador confirma o e-mail na hora.
-- Cadastros anônimos continuam pendentes até a confirmação do Supabase.

CREATE OR REPLACE FUNCTION public.confirmar_email_usuario(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text := lower(trim(coalesce(p_email, '')));
  _atualizados integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  IF _email = '' THEN
    RAISE EXCEPTION 'Informe o e-mail.';
  END IF;

  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE lower(email) = _email;

  GET DIAGNOSTICS _atualizados = ROW_COUNT;
  IF _atualizados = 0 THEN
    RAISE EXCEPTION 'Usuário não encontrado para confirmar o e-mail.';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.confirmar_email_usuario(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirmar_email_usuario(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirmar_email_usuario(text) TO authenticated;
