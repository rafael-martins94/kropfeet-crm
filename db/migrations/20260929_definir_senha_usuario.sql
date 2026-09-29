-- O administrador define a senha no CRM, sem e-mail de redefinição.

CREATE OR REPLACE FUNCTION public.definir_senha_usuario(p_id uuid, p_senha text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _senha text := coalesce(p_senha, '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Informe o usuário.';
  END IF;

  IF char_length(_senha) < 8 THEN
    RAISE EXCEPTION 'A senha deve ter pelo menos 8 caracteres.';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(_senha, extensions.gen_salt('bf', 10)),
    updated_at = now(),
    recovery_token = '',
    recovery_sent_at = NULL
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  DELETE FROM auth.one_time_tokens
  WHERE user_id = p_id
    AND token_type::text ILIKE '%recovery%';

  IF p_id IS DISTINCT FROM auth.uid() THEN
    DELETE FROM auth.sessions
    WHERE user_id = p_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.definir_senha_usuario(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.definir_senha_usuario(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.definir_senha_usuario(uuid, text) TO authenticated;
