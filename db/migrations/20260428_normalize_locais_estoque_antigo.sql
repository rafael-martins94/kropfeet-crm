-- Normaliza locais de estoque: apenas Brasil (Rio, Rio 2) e Portugal (Marina, Cais, Estúdio).
-- Demais locais consolidados em um único local "Antigo".
-- Unifica duplicata RIO2 / RIO 2 no registro canônico Rio 2 (codigo rio-2).
-- Aplicado ao projeto CRM via Supabase MCP (apply_migration).

INSERT INTO locais_estoque (codigo, nome, tipo_regiao, pais, ativo)
VALUES ('antigo', 'Antigo', 'outros', NULL, true)
ON CONFLICT (codigo) DO NOTHING;

UPDATE itens_estoque
SET id_local_estoque = (SELECT id FROM locais_estoque WHERE codigo = 'antigo' LIMIT 1)
WHERE id_local_estoque IN (
  'f51a87c7-484a-4b34-9a5f-562ef56b6e73'::uuid,
  '28aed4e4-d9be-4226-a1b0-a76b718cd9ee'::uuid,
  '40d89197-be87-4698-a035-a514443f0aa9'::uuid,
  '7d0e7cf2-1d90-4a1d-a291-65f6aa8fe9a8'::uuid,
  '1b2c03ac-f722-4855-a68d-7819f0d275b1'::uuid,
  '7282526e-c686-49b7-b8df-75b04ae49076'::uuid,
  '787e1709-693f-4579-bd8e-7af572599b49'::uuid,
  '28e884c7-7ad0-421f-9119-29e07f99baa8'::uuid,
  'c612ea5b-e59c-423b-95d4-800a742f34d0'::uuid
);

UPDATE itens_estoque
SET id_local_estoque = 'c3f8c4ea-62c5-4475-b709-04ffbe84cc2e'::uuid
WHERE id_local_estoque = 'ea441a39-c165-4ee2-a396-344f3a8a15a2'::uuid;

UPDATE locais_estoque SET
  nome = 'Rio',
  codigo = 'rio',
  tipo_regiao = 'brasil'::tipo_regiao_enum,
  pais = 'Brasil'
WHERE id = '4678b45c-4211-4d02-9829-694cab5d21b2'::uuid;

UPDATE locais_estoque SET
  nome = 'Rio 2',
  codigo = 'rio-2',
  tipo_regiao = 'brasil'::tipo_regiao_enum,
  pais = 'Brasil'
WHERE id = 'c3f8c4ea-62c5-4475-b709-04ffbe84cc2e'::uuid;

UPDATE locais_estoque SET
  nome = 'Marina',
  codigo = 'marina',
  tipo_regiao = 'europa'::tipo_regiao_enum,
  pais = 'Portugal'
WHERE id = 'b98bea0e-f458-4f67-8704-3d41ab77e2ea'::uuid;

UPDATE locais_estoque SET
  nome = 'Cais',
  codigo = 'cais',
  tipo_regiao = 'europa'::tipo_regiao_enum,
  pais = 'Portugal'
WHERE id = '063b928c-1959-4b2a-a643-f2940bfb65a7'::uuid;

UPDATE locais_estoque SET
  nome = 'Estúdio',
  codigo = 'estudio',
  tipo_regiao = 'europa'::tipo_regiao_enum,
  pais = 'Portugal'
WHERE id = 'e39fcd51-2a10-42c7-8af6-c43084240556'::uuid;

DELETE FROM locais_estoque
WHERE id IN (
  'ea441a39-c165-4ee2-a396-344f3a8a15a2'::uuid,
  'f51a87c7-484a-4b34-9a5f-562ef56b6e73'::uuid,
  '28aed4e4-d9be-4226-a1b0-a76b718cd9ee'::uuid,
  '40d89197-be87-4698-a035-a514443f0aa9'::uuid,
  '7d0e7cf2-1d90-4a1d-a291-65f6aa8fe9a8'::uuid,
  '1b2c03ac-f722-4855-a68d-7819f0d275b1'::uuid,
  '7282526e-c686-49b7-b8df-75b04ae49076'::uuid,
  '787e1709-693f-4579-bd8e-7af572599b49'::uuid,
  '28e884c7-7ad0-421f-9119-29e07f99baa8'::uuid,
  'c612ea5b-e59c-423b-95d4-800a742f34d0'::uuid
);
