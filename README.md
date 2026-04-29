# KropFeet CRM

CRM web do **KropFeet**, construído em **React + Vite + TypeScript + Tailwind CSS** e
conectado ao **Supabase** real que alimenta o negócio.

> O utilitário Node.js que faz a sincronização com o **Tiny ERP** vive isolado em
> [`tools/tiny-sync`](./tools/tiny-sync) — é um script de uso esporádico, com seu próprio
> `package.json`, `node_modules` e `.env`. O front-end, que é o produto principal, mora na
> raiz do repositório.

## Stack

- React 18 + Vite 5
- TypeScript (strict)
- Tailwind CSS 3
- React Router DOM 6
- @supabase/supabase-js 2

## Estrutura

```
kropfeet-crm/
├─ src/                    # front-end React/Vite (produto principal)
│  ├─ components/          # DataTable, FormField, StatusBadge, …
│  ├─ contexts/            # AuthContext (sessão Supabase)
│  ├─ hooks/               # useAsync, useDebounce
│  ├─ layouts/             # AppLayout, AuthLayout, Sidebar
│  ├─ lib/                 # supabase client, env
│  ├─ pages/               # páginas por entidade do banco
│  ├─ routes/              # ProtectedRoute / PublicOnlyRoute
│  ├─ services/            # acesso às tabelas (queries + mutations)
│  ├─ types/               # database.ts + entities.ts
│  └─ utils/               # cn, format, limparParaBanco, …
├─ public/
├─ index.html
├─ tailwind.config.js
├─ vite.config.ts
├─ package.json            # front-end
├─ .env.local              # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
└─ tools/
   └─ tiny-sync/           # utilitário Node de sincronização com o Tiny ERP
      ├─ src/
      ├─ scripts/
      ├─ package.json      # independente do front
      └─ .env              # usa SUPABASE_SERVICE_ROLE_KEY (nunca exposto ao browser)
```

## Configuração

1. Copie o exemplo de variáveis de ambiente:

   ```bash
   cp .env.example .env.local
   ```

2. Preencha com a URL do projeto e a **publishable/anon key** do Supabase (nunca use a
   `service_role_key` no front):

   ```env
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```

   As chaves ficam em **Project Settings → API** no painel do Supabase.

## Scripts

```bash
npm install       # instala dependências
npm run dev       # sobe o dev server (http://localhost:5173)
npm run typecheck # TypeScript em modo estrito, sem emitir
npm run build     # gera bundle de produção em dist/
npm run preview   # serve o bundle de produção para conferência
```

## Autenticação

- Login via `supabase.auth.signInWithPassword`
- Sessão persistida em `localStorage` (auto-refresh habilitado)
- Rotas protegidas por `<ProtectedRoute />` em `src/routes/ProtectedRoute.tsx`
- Recuperação de senha por e-mail (`resetPasswordForEmail`)

Crie o usuário inicial pelo painel do Supabase (**Authentication → Users → Add user**) ou
habilite signup no seu ambiente.

## Entidades mapeadas

O front-end foi construído **sobre o schema real** do Supabase (nada é mockado). Tabelas
consumidas hoje, todas definidas em `src/types/database.ts`:

| Entidade                 | Rota base            | Operações                        |
|--------------------------|----------------------|----------------------------------|
| `marcas`                 | `/marcas`            | List · Detail · Create · Edit    |
| `categorias`             | `/categorias`        | List · Detail · Create · Edit    |
| `fornecedores`           | `/fornecedores`      | List · Detail · Create · Edit    |
| `locais_estoque`         | `/locais-estoque`    | List · Detail · Create · Edit    |
| `modelos_produto`        | `/modelos-produto`   | List · Detail · Create · Edit    |
| `itens_estoque`          | `/itens-estoque`     | List · Detail · Create · Edit    |
| `clientes`               | `/clientes`          | List · Detail · Create · Edit    |
| `vendas`                 | `/vendas`            | List · Detail · Create · Edit    |
| `cambios_moeda`          | `/cambios-moeda`     | List + inline Create/Delete      |
| `movimentacoes_estoque`  | `/movimentacoes`     | Read-only (auditoria)            |
| `logs_sincronizacao_tiny`| `/logs-tiny`         | Read-only (auditoria Tiny ERP)   |
| `imagens_modelo_produto` | `/imagens`           | Galeria read-only                |

O sidebar (`src/layouts/Sidebar.tsx`) reflete diretamente essa organização.

## Identidade visual

Inspirada no logotipo da KropFeet (elegante, sóbrio, premium):

- **Primária:** `#0B3F5C` · `#082C40`
- **Accent:** `#B7D36B`
- **Superfícies:** `#F8FAF7` / `#FFFFFF`
- **Texto:** `#1F2937` / `#6B7280`
- **Bordas:** `#E5E7EB`
- **Tipografia:** Inter (UI) + Plus Jakarta Sans (dados numéricos, via `font-numeric tabular-nums`)

## Convenções

- Tudo em **português**: nomes de variáveis, rotas e strings de UI.
- Services expõem funções `listar`, `obterPorId`, `criar`, `atualizar`, `deletar`,
  baseadas no `src/services/base.ts` e especializadas por entidade.
- Listagens usam `DataTable`, `Pagination`, `SearchInput` e `PageHeader` para manter
  consistência visual.
- Formulários usam `FormInput`, `FormSelect`, `FormTextarea`, `FormCheckbox`
  (`src/components/FormField.tsx`) e `limparParaBanco` (`src/utils/format.ts`) para evitar
  gravar strings vazias no banco.

## Utilitário `tools/tiny-sync`

Pasta isolada com scripts Node.js que importam dados do **Tiny ERP** para o Supabase. Não é
parte do runtime do CRM — serve para popular/reconciliar dados quando necessário.

```bash
cd tools/tiny-sync
cp .env.example .env          # preencher SUPABASE_SERVICE_ROLE_KEY + TINY_TOKEN
npm install
npm run sync:tiny             # sincronização completa
npm run sync:tiny:pagina      # uma página específica
npm run sync:tiny:produto     # um produto específico
npm run sync:tiny:fornecedores
npm run backfill:imagens
```

Detalhes em [`tools/tiny-sync/README.md`](./tools/tiny-sync/README.md).

## Deploy no Render

A raiz já contém um blueprint [`render.yaml`](./render.yaml) que configura um **Static Site**
gratuito do Render, com cache otimizado em `/assets/*`, rewrite de SPA para o React Router e
headers de segurança básicos.

### 1. Crie o serviço

1. Faça login em [render.com](https://render.com) e conecte sua conta GitHub.
2. `New +` → **Blueprint** → aponte para `https://github.com/rafael-martins94/kropfeet-crm`.
3. O Render detecta o `render.yaml` e propõe criar o serviço **`kropfeet-crm`**.

### 2. Preencha as variáveis de ambiente

No dashboard do serviço recém-criado, vá em **Environment** e preencha:

| Chave | Valor |
|-------|-------|
| `VITE_SUPABASE_URL` | URL do seu projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Publishable / anon key (nunca a service_role) |

`NODE_VERSION` já vem fixada em `20` no blueprint.

### 3. (Supabase) Libere a URL do Render

No painel do Supabase, em **Authentication → URL Configuration**, inclua a URL
gerada pelo Render (ex.: `https://kropfeet-crm.onrender.com`) em:

- **Site URL**
- **Additional Redirect URLs** (para o fluxo de recuperação de senha)

### 4. Deploys automáticos

Qualquer push na branch `main` dispara um novo build. O `buildFilter` dentro do
`render.yaml` ignora alterações em `tools/**` e arquivos `*.md`, evitando builds
desnecessários do front quando só o script do Tiny ERP for atualizado.

## Próximos passos sugeridos

- Gerenciamento de itens de uma venda diretamente pela tela de detalhe.
- Upload de imagens de modelo via Storage do Supabase.
- Relatórios/KPIs adicionais no dashboard.
- Políticas RLS revisadas para os perfis de usuário.
