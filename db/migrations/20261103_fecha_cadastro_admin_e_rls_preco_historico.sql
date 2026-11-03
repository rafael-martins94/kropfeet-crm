-- Duas brechas de segurança.
--
-- 1. O cadastro público (auth.signUp com a anon key) aceitava o papel enviado
--    em raw_user_meta_data, então qualquer pessoa podia criar uma conta admin.
--    Agora todo cadastro nasce como vendedor inativo. Só o administrador, pelo
--    CRM (garantir_perfil_usuario), define o papel e ativa o usuário.
--
-- 2. itens_estoque_preco_historico estava sem RLS e com todos os privilégios
--    para anon. Passa a seguir a mesma regra das demais tabelas do CRM.

CREATE OR REPLACE FUNCTION public.handle_novo_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _nome text;
BEGIN
  _nome := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'nome'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.perfis_usuario (id, nome, email, papel, ativo)
  VALUES (NEW.id, _nome, lower(NEW.email), 'vendedor', false)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_novo_usuario() FROM PUBLIC, anon, authenticated;

-- O trigger já cria o perfil (inativo); o administrador aplica papel e ativa.
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

  INSERT INTO public.perfis_usuario (id, nome, email, papel, ativo)
  VALUES (
    _id,
    COALESCE(NULLIF(_nome, ''), split_part(_email, '@', 1)),
    _email,
    _papel,
    true
  )
  ON CONFLICT (id) DO UPDATE
    SET nome = EXCLUDED.nome,
        papel = EXCLUDED.papel,
        ativo = true;
END;
$function$;

REVOKE ALL ON FUNCTION public.garantir_perfil_usuario(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.garantir_perfil_usuario(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.garantir_perfil_usuario(text, text, text) TO authenticated;

ALTER TABLE public.itens_estoque_preco_historico ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.itens_estoque_preco_historico FROM anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'itens_estoque_preco_historico'
      AND policyname = 'crm_authenticated_all'
  ) THEN
    CREATE POLICY crm_authenticated_all ON public.itens_estoque_preco_historico
      FOR ALL TO authenticated
      USING (public.is_equipe_crm())
      WITH CHECK (public.is_equipe_crm());
  END IF;
END $$;
