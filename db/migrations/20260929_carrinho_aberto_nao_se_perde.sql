-- Sem ordem de venda, o carrinho não pode ser apagado, esvaziado nem finalizado.

ALTER TABLE public.carrinhos_galeria
  DROP CONSTRAINT IF EXISTS carrinhos_galeria_finalizado_exige_venda;

ALTER TABLE public.carrinhos_galeria
  ADD CONSTRAINT carrinhos_galeria_finalizado_exige_venda
  CHECK (status <> 'finalizado' OR id_venda IS NOT NULL);

CREATE OR REPLACE FUNCTION public.carrinho_galeria_nao_perder_aberto()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.id_venda IS NULL THEN
      RAISE EXCEPTION 'O carrinho fica guardado até existir a ordem de venda.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.id_venda IS NULL AND NEW.id_venda IS NULL THEN
    IF NEW.status = 'finalizado' THEN
      RAISE EXCEPTION 'O carrinho só é finalizado quando a ordem de venda existir.';
    END IF;
    IF NEW.itens IS NULL
      OR jsonb_typeof(NEW.itens) <> 'array'
      OR jsonb_array_length(NEW.itens) < 1 THEN
      RAISE EXCEPTION 'O carrinho fica guardado até existir a ordem de venda.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS carrinho_galeria_nao_perder_aberto ON public.carrinhos_galeria;

CREATE TRIGGER carrinho_galeria_nao_perder_aberto
  BEFORE UPDATE OR DELETE ON public.carrinhos_galeria
  FOR EACH ROW
  EXECUTE FUNCTION public.carrinho_galeria_nao_perder_aberto();
