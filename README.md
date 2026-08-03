# WebDash · Gestão de Projetos Corporativos — Grupo Moreno

Plataforma web de gestão de projetos (estilo Monday/ClickUp/Jira) construída **exclusivamente sobre
Supabase** no backend: PostgreSQL, Auth, Realtime, Storage, RLS, Functions, Triggers e Views. Não há
servidor Node/Nest/Express — o frontend Next.js fala direto com o Supabase.

Identidade visual aplicada em toda a aplicação, gráficos e relatórios exportados:

| Cor | Hex | Uso |
| --- | --- | --- |
| Verde institucional — **FORTALECER** | `#0E8F46` | Sucesso, saúde no prazo, conclusão |
| Verde-limão — **CONECTAR** | `#8CC63F` | Destaques, execução em andamento |
| Azul institucional — **CRESCER** | `#1B3F94` | Cor primária, navegação, gráficos |

---

## Stack

**Frontend:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · shadcn/ui (Radix) ·
Framer Motion · TanStack Query · React Hook Form · Zod · dnd-kit · Recharts · date-fns

**Backend (100% Supabase):** PostgreSQL · Authentication · Realtime · Storage · Row Level Security ·
Database Functions · Triggers · Views

---

## Instalação

> **Primeira vez?** O passo a passo completo, com roteiro de teste e solução dos
> problemas mais comuns, está em **[docs/COMO-RODAR.md](docs/COMO-RODAR.md)**.

### 1. Dependências

```bash
npm install
```

### 2. Projeto Supabase

Crie um projeto em [supabase.com](https://supabase.com) e copie as credenciais:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Banco de dados

**Caminho mais rápido:** abra o **SQL Editor** do Supabase, cole todo o conteúdo de
[`supabase/setup.sql`](supabase/setup.sql) e execute. Esse arquivo único reúne as 7
migrations e os cadastros básicos, e é seguro executar mais de uma vez.

Ou aplique as migrations separadamente, na ordem numérica, com o Supabase CLI:

```bash
supabase link --project-ref SEU-PROJECT-REF
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql   # cadastros básicos (opcional)
```

Ou, pelo **SQL Editor** do painel, cole e execute na sequência:

| # | Arquivo | Conteúdo |
| - | ------- | -------- |
| 1 | `20250101000000_extensions_and_enums.sql` | Extensões e tipos enumerados |
| 2 | `20250101000100_tables.sql` | 20 tabelas, FKs, constraints e índices |
| 3 | `20250101000200_functions.sql` | Helpers de RLS, inteligência do projeto, cronograma, busca |
| 4 | `20250101000300_triggers.sql` | Auditoria, notificações, recálculo automático |
| 5 | `20250101000400_views.sql` | Views analíticas (dashboard, workload, Gantt, executivo) |
| 6 | `20250101000500_rls_policies.sql` | Row Level Security por perfil |
| 7 | `20250101000600_realtime_storage.sql` | Publicação Realtime e buckets do Storage |
| 8 | `seed.sql` | Departamentos, clientes e tags do Grupo Moreno |

### 4. Executar

```bash
npm run dev     # http://localhost:3000
```

**O primeiro usuário cadastrado vira administrador automaticamente.** Depois de entrar, rode
`select public.seed_demo_projects();` no SQL Editor para criar uma massa de demonstração.

---

## O que está implementado

### Autenticação e permissões

Quatro perfis aplicados via **Row Level Security**, não no frontend:

| Perfil | Alcance |
| ------ | ------- |
| **Administrador** | Acesso total, gerencia perfis de acesso |
| **Gerente** | Enxerga e gerencia todo o portfólio |
| **Líder** | Gerencia os projetos em que participa |
| **Colaborador** | Enxerga apenas seus projetos; edita as tarefas que lhe pertencem |

### Telas

- **Dashboard** — 12 KPIs (ativos, atrasados, em risco, próximos do vencimento, tarefas, horas
  planejadas × realizadas, eficiência, indicador geral, usuários online), projetos que exigem
  atenção, minhas tarefas e centro de atividades ao vivo.
- **Projetos** — portfólio em cards ou tabela, filtros por status/saúde/departamento, ordenação e
  exportação.
- **Detalhe do projeto** — 12 abas: Kanban (drag & drop), Lista (agrupamentos e ordenação), Gantt,
  Timeline, Calendário, Indicadores (Burn Down / Burn Up / Curva S + marcos), Riscos, Checklist,
  Horas, Arquivos, Equipe e Comentários.
- **Cronograma** — Gantt consolidado do portfólio, com filtro de caminho crítico.
- **Roadmap executivo** — projetos por linha, meses na horizontal, marcos e conclusão.
- **Calendário** — visões diária, semanal e mensal.
- **Workload** — capacidade × alocação, disponibilidade e sobrecarga por pessoa.
- **Dashboard Executivo** — Lead Time, Cycle Time, velocidade, saúde do portfólio, distribuição por
  status/departamento/prioridade/gestor, projetos críticos e orçamento. Restrito à gestão.
- **Riscos** — heatmap corporativo 5 × 5 (probabilidade × impacto).
- **Relatórios** — exportação em Excel, CSV e PDF com cabeçalho institucional.
- **Atividades** — feed em tempo real + trilha de auditoria (valor antigo × novo).
- **Configurações** — perfil, capacidade semanal, permissões e paleta da marca.

### Inteligência do projeto (calculada no banco)

- **Progresso executado** recalculado por trigger a cada mudança de tarefa, ponderado por horas
  estimadas.
- **Progresso previsto** para a data de hoje, medido em **dias úteis** do cronograma.
- **Saúde automática**: adiantado, no prazo, em risco, atrasado ou crítico, derivada do desvio entre
  executado e previsto e dos dias de atraso.
- **Recálculo de cronograma**: ao mover uma tarefa, as sucessoras são empurradas conforme o tipo de
  dependência (FS, SS, FF, SF) e o lag, preservando a duração.
- **Caminho crítico** via CTE recursiva sobre o grafo de dependências.
- **Dias úteis**, dias restantes, dias de atraso, eficiência (estimado ÷ apontado) e severidade de
  risco (probabilidade × impacto) como colunas calculadas.

### Tempo real

Um canal Supabase Realtime por contexto invalida o cache do TanStack Query quando qualquer usuário
altera projetos, tarefas, comentários, checklist, arquivos, horas, riscos, marcos, equipe ou
notificações. Presença por heartbeat alimenta o indicador de usuários online.

### Auditoria

Trigger genérico registra em `audit_log` quem alterou, quando, valor antigo, valor novo e a lista de
campos modificados — para projetos, tarefas, equipe, checklist, marcos, riscos, apontamentos,
arquivos e perfis.

---

## Estrutura

```
src/
├── app/
│   ├── (auth)/            login e cadastro
│   ├── (app)/             área autenticada (dashboard, projetos, executivo, …)
│   └── auth/callback/     troca do code PKCE por sessão
├── components/
│   ├── ui/                primitivos shadcn/ui
│   ├── layout/            sidebar, topbar, busca global, notificações
│   ├── views/             Kanban, Lista, Gantt, Timeline, Calendário
│   ├── projects/          painéis do projeto (riscos, arquivos, equipe, …)
│   ├── charts/            Burn Down, Burn Up, Curva S
│   └── brand/             logotipo e selos institucionais
├── hooks/                 camada de dados (TanStack Query + Realtime)
├── lib/                   supabase, formatação, validações Zod, exportação
└── types/                 tipagem do banco
supabase/
├── migrations/            SQL versionado (aplicado pelo CLI)
├── setup.sql              tudo em um arquivo, para colar no SQL Editor
└── seed.sql               cadastros básicos
docs/
├── COMO-RODAR.md          passo a passo e roteiro de teste
└── SCHEMA.md              referência completa das tabelas
site/                      página publicada no GitHub Pages
```

---

## Scripts

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção
npm run start      # servir o build
npm run lint       # ESLint
npm run typecheck  # TypeScript sem emitir

npm run db:setup-sql  # regera supabase/setup.sql a partir das migrations
npm run docs:schema   # regera docs/SCHEMA.md a partir de site/schema-data.js
```

---

## Automação de alertas (opcional)

`public.generate_deadline_alerts()` cria notificações de prazo hoje/amanhã, projetos atrasados e
reavalia a saúde de todo o portfólio. Agende uma execução diária com `pg_cron`:

```sql
select cron.schedule('alertas-diarios', '0 8 * * *', $$select public.generate_deadline_alerts()$$);
```

---

## Qualidade

- TypeScript estrito, sem `any` (regra ESLint).
- Validação com Zod compartilhada entre formulários e payloads.
- Skeleton loading, empty states e error states em todas as consultas.
- Acessibilidade: navegação por teclado, `aria-*`, foco visível, contraste, `prefers-reduced-motion`
  e link "pular para o conteúdo".
- Dark mode e light mode com tokens de cor da marca.
- Code splitting: `exceljs`, `jspdf` e `recharts` carregados sob demanda.
