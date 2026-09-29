-- A lista de usuários lê perfis_usuario. O cadastro em auth.users nem sempre
-- cria essa linha (e um novo envio do mesmo e-mail não cria de novo).
-- O administrador garante o perfil depois do cadastro.

CREATE OR REPLACE FUNCTION public.garantir_perfil_usuario(
  p_email text,
  p_nome text,
  p_papel text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text := lower(trim(coalesce(p_email, '')));
  _nome text := trim(coalesce(p_nome, ''));
  _papel text := coalesce(nullif(trim(p_papel), ''), 'operador');
  _id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  IF _email = '' THEN
    RAISE EXCEPTION 'Informe o e-mail.';
  END IF;

  IF _papel NOT IN ('admin', 'operador', 'vendedor') THEN
    _papel := 'operador';
  END IF;

  SELECT u.id
    INTO _id
  FROM auth.users u
  WHERE lower(u.email) = _email;

  IF _id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado para incluir na lista.';
  END IF;

  INSERT INTO public.perfis_usuario (id, nome, email, papel)
  VALUES (
    _id,
    COALESCE(NULLIF(_nome, ''), split_part(_email, '@', 1)),
    _email,
    _papel
  )
  ON CONFLICT (id) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.garantir_perfil_usuario(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.garantir_perfil_usuario(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.garantir_perfil_usuario(text, text, text) TO authenticated;

INSERT INTO public.perfis_usuario (id, nome, email, papel)
SELECT
  u.id,
  COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'nome'), ''),
    split_part(u.email, '@', 1)
  ),
  lower(u.email),
  CASE
    WHEN u.raw_user_meta_data->>'papel' IN ('admin', 'operador', 'vendedor')
      THEN u.raw_user_meta_data->>'papel'
    ELSE 'operador'
  END
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.perfis_usuario p WHERE p.id = u.id
  );
