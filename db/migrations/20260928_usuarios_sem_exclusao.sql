-- Usuário com histórico não é excluído. Só perde o acesso.

DROP FUNCTION IF EXISTS public.excluir_usuario_sistema(uuid);

DROP POLICY IF EXISTS perfis_delete_admin ON public.perfis_usuario;
