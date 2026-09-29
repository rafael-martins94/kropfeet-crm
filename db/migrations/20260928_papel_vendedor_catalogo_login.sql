-- Papel vendedor: entra só no catálogo. O catálogo deixa de ser anônimo.

ALTER TABLE public.perfis_usuario
  DROP CONSTRAINT perfis_usuario_papel_check;

ALTER TABLE public.perfis_usuario
  ADD CONSTRAINT perfis_usuario_papel_check
  CHECK (papel = ANY (ARRAY['admin'::text, 'operador'::text, 'vendedor'::text]));

CREATE OR REPLACE FUNCTION public.handle_novo_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _nome text;
  _papel text;
  _existe_admin boolean;
BEGIN
  _nome := COALESCE(
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  _papel := COALESCE(NEW.raw_user_meta_data->>'papel', 'operador');
  IF _papel NOT IN ('admin', 'operador', 'vendedor') THEN
    _papel := 'operador';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.perfis_usuario WHERE papel = 'admin')
    INTO _existe_admin;

  IF NOT _existe_admin THEN
    _papel := 'admin';
  END IF;

  INSERT INTO public.perfis_usuario (id, nome, email, papel)
  VALUES (NEW.id, _nome, NEW.email, _papel)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_equipe_crm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis_usuario
    WHERE id = auth.uid()
      AND ativo = true
      AND papel IN ('admin', 'operador')
  );
$$;

REVOKE ALL ON FUNCTION public.is_equipe_crm() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_equipe_crm() TO authenticated, service_role;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname, pol.polname, pol.polcmd
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND pol.polname IN ('crm_authenticated_all', 'crm_authenticated_select')
  LOOP
    IF r.polcmd = 'r' THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (public.is_equipe_crm())',
        r.polname, r.nspname, r.relname
      );
    ELSE
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (public.is_equipe_crm()) WITH CHECK (public.is_equipe_crm())',
        r.polname, r.nspname, r.relname
      );
    END IF;
  END LOOP;
END $$;

ALTER POLICY perfis_select_authenticated ON public.perfis_usuario
  USING (id = auth.uid() OR public.is_equipe_crm());

ALTER POLICY conferencias_insert_own_user ON public.conferencias_estoque
  WITH CHECK (id_usuario = auth.uid() AND public.is_equipe_crm());

-- Funções SECURITY DEFINER do CRM passam a recusar o papel vendedor.
-- O catálogo marca a transação antes de chamar sincronizar_efeitos_venda.
DO $$
DECLARE
  r record;
  def text;
  marca integer;
  inicio_begin integer;
  guarda text := E'\n  IF pg_trigger_depth() = 0 AND NOT public.is_equipe_crm() AND coalesce(current_setting(''kropfeet.bypass_equipe'', true), '''') <> ''1'' THEN\n    RAISE EXCEPTION ''Acesso restrito.'';\n  END IF;';
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND l.lanname = 'plpgsql'
      AND p.proname NOT IN ('is_admin', 'is_equipe_crm', 'handle_novo_usuario')
      AND p.proname NOT LIKE 'catalogo%'
  LOOP
    def := pg_get_functiondef(r.oid);
    IF position('kropfeet.bypass_equipe' in def) > 0 THEN
      CONTINUE;
    END IF;

    marca := position('$function$' in def);
    IF marca = 0 THEN
      RAISE EXCEPTION 'Função sem corpo plpgsql: %', r.oid::regprocedure;
    END IF;

    inicio_begin := marca + position('BEGIN' in substring(def from marca)) - 1;
    IF inicio_begin < marca THEN
      RAISE EXCEPTION 'Função sem BEGIN: %', r.oid::regprocedure;
    END IF;

    def :=
      substring(def from 1 for inicio_begin + 4)
      || guarda
      || substring(def from inicio_begin + 5);

    EXECUTE def;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.vitrine_contar_alertas_atual()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_equipe_crm() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  RETURN (
    SELECT COALESCE(COUNT(*)::integer, 0)
    FROM public.vitrine_itens vi
    JOIN public.vitrines v ON v.id = vi.id_vitrine
    WHERE v.status = 'publicada'
      AND vi.estado_caixa = 'vendida'
  );
END;
$$;

DO $$
DECLARE
  def text;
  marca integer;
  inicio_begin integer;
  bypass text := E'\n  PERFORM set_config(''kropfeet.bypass_equipe'', ''1'', true);';
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'catalogo_kropcafe_salvar_selecao';

  IF def IS NULL THEN
    RAISE EXCEPTION 'catalogo_kropcafe_salvar_selecao não encontrada';
  END IF;

  IF position('kropfeet.bypass_equipe' in def) = 0 THEN
    marca := position('$function$' in def);
    inicio_begin := marca + position('BEGIN' in substring(def from marca)) - 1;
    def :=
      substring(def from 1 for inicio_begin + 4)
      || bypass
      || substring(def from inicio_begin + 5);
    EXECUTE def;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.catalogo_kropcafe_buscar(text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.catalogo_kropcafe_fotos(uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.catalogo_kropcafe_listar_vendedores() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.catalogo_kropcafe_salvar_selecao(text, text, text, text, text, jsonb, boolean, text) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_buscar(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_fotos(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_listar_vendedores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalogo_kropcafe_salvar_selecao(text, text, text, text, text, jsonb, boolean, text) TO authenticated;
