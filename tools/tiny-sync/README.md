# tiny-sync

Utilitário Node.js de **uso esporádico** para sincronizar dados do **Tiny ERP** com o
Supabase do KropFeet CRM. Não é parte do runtime do produto — são scripts que você roda
quando precisa popular/reconciliar o banco.

> Este diretório é completamente independente do front-end (que vive na raiz do
> repositório). Tem seu próprio `package.json`, `node_modules` e `.env`.

## Requisitos

- Node.js 20+
- Uma chave `SUPABASE_SERVICE_ROLE_KEY` válida (sensível — nunca deve vazar para o front)
- Um `TINY_TOKEN` da API v2 do Tiny

## Configuração

```bash
cd tools/tiny-sync
cp .env.example .env
```

Preencha `.env` com:

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
TINY_TOKEN=...
```

```bash
npm install
```

## Scripts disponíveis

```bash
npm run sync:tiny              # roda a sincronização completa
npm run sync:tiny:pagina       # sincroniza uma página específica
npm run sync:tiny:produto      # sincroniza um único produto
npm run sync:tiny:fornecedores # sincroniza somente fornecedores
npm run backfill:imagens       # popula imagens dos modelos de produto
npm run typecheck              # verifica tipagem
```

## Estrutura

```
tools/tiny-sync/
├─ src/
│  ├─ config/      # carregamento do .env, clientes HTTP, etc.
│  ├─ services/    # integrações com Tiny e Supabase
│  ├─ tipos/       # types do banco (snapshot do schema)
│  └─ utils/
├─ scripts/        # pontos de entrada CLI (tsx)
├─ package.json
├─ tsconfig.json
└─ .env            # NÃO commitar
```

## Segurança

- A chave **`SUPABASE_SERVICE_ROLE_KEY` dá acesso total ao banco**. Ela só pode existir
  aqui, nunca na raiz nem em nenhum arquivo lido pelo Vite.
- O front-end usa **publishable/anon key** (`VITE_SUPABASE_ANON_KEY`), configurada em
  `/.env.local` na raiz. As duas nunca se misturam.
