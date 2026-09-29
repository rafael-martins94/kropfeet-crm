-- Excluir um usuário tira o acesso e o perfil da lista.
-- Vitrines e conferências continuam, atribuídas a quem excluiu,
-- porque essas tabelas exigem um usuário.

CREATE OR REPLACE FUNCTION public.excluir_usuario_sistema(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Informe o usuário.';
  END IF;

  IF p_id = _admin THEN
    RAISE EXCEPTION 'Você não pode excluir o próprio usuário.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  UPDATE public.vitrines
  SET id_usuario = _admin
  WHERE id_usuario = p_id;

  UPDATE public.conferencias
  SET id_usuario = _admin
  WHERE id_usuario = p_id;

  UPDATE public.conferencias_estoque
  SET id_usuario = _admin
  WHERE id_usuario = p_id;

  DELETE FROM auth.users
  WHERE id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.excluir_usuario_sistema(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_usuario_sistema(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.excluir_usuario_sistema(uuid) TO authenticated;
