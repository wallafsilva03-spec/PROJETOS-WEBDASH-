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
| 8 | `20250201000000_stages_and_viability.sql` | Etapas do projeto, viabilidade econômica e conclusão por tempo |
| 9 | `seed.sql` | Departamentos, clientes e tags do Grupo Moreno |

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
| **Analista** | Enxerga e gerencia todo o portfólio. É o perfil de quem se cadastra pela tela de criar conta |
| **Líder** | Gerencia os projetos em que participa |
| **Colaborador** | Enxerga apenas seus projetos; edita as tarefas que lhe pertencem |

### Telas

- **Dashboard** — 12 KPIs (ativos, atrasados, em risco, próximos do vencimento, tarefas, horas
  planejadas × realizadas, eficiência, indicador geral, usuários online), projetos que exigem
  atenção, minhas tarefas e centro de atividades ao vivo.
- **Projetos** — portfólio em cards ou tabela, filtros por status/saúde/departamento, ordenação e
  exportação. Os estados do portfólio (em atraso, em risco, dentro do previsto, vencendo em 7 dias
  e cada um dos status) são cartões e etiquetas clicáveis: um clique abre a lista só daquele
  estado. Os filtros ficam na URL, então o endereço pode ser guardado ou compartilhado — é para lá
  que apontam os indicadores do dashboard e a gestão por analista. O código do projeto novo é
  gerado sozinho no formato **ano-data-hora** do cadastro (`2026-0811-143207`), único e já em ordem
  cronológica. A exclusão do projeto fica no cabeçalho do detalhe, restrita a administradores e
  protegida por confirmação com o código do projeto.
- **Detalhe do projeto** — 6 cartões de inteligência (execução, prazo, **conclusão por tempo**,
  esforço, escopo e **viabilidade econômica**) e 14 abas: **Kanban** (etapas por data de término,
  drag & drop), Kanban de tarefas, Lista (agrupamentos e ordenação), **Etapas** (roadmap das
  etapas, organograma + linha do tempo), Gantt, Timeline, Calendário, Indicadores (Burn Down / Burn Up / Curva S +
  marcos), Riscos, Checklist, Horas, Arquivos, Equipe e Comentários.
- **Kanban** — etapas de todo o portfólio em colunas calculadas pela data de término (atrasadas,
  esta semana, próxima semana, próximos 30 dias, depois e concluídas), com alternância para
  agrupar por situação. Arrastar um card replaneja as datas da etapa — preservando a duração
  planejada — ou a conclui. Cada card tem botão de excluir (com confirmação), disponível para a
  gestão do projeto e para quem cadastrou a etapa.
- **Cronograma** — Gantt consolidado do portfólio, com filtro de caminho crítico.
- **Roadmap executivo** — projetos por linha, meses na horizontal, marcos e conclusão. Dá para
  visualizar por **atividade (status)**, **saúde do projeto**, departamento ou responsável, e os
  cartões de saúde e as etiquetas de status filtram o quadro em um clique. A seta ao lado do nome
  abre as **etapas do projeto na mesma linha do tempo**, com a cor da situação de cada uma.
- **Calendário** — visões diária, semanal e mensal.
- **Workload** — capacidade × alocação, disponibilidade e sobrecarga por analista, com busca e
  filtro de departamento.
- **Arquivos** — só dentro do projeto: botão **Anexar arquivo** no cabeçalho, que abre a aba de
  anexos. Quando o envio é recusado, o motivo fica escrito na própria aba (bucket ausente, falta de
  permissão ou sessão expirada), em vez de sumir num aviso passageiro.
- **Gestão por analista** — projetos agrupados por responsável, com todos os status, o que está em
  atraso e há quantos dias, execução média, desvio e horas estimadas × realizadas. Filtros de
  busca, status e **departamento** (campo suspenso), e cada linha abre a lista de projetos da
  pessoa. **Restrita ao administrador.**
- **Dashboard Executivo** — Lead Time, Cycle Time, velocidade, saúde do portfólio, distribuição por
  status/departamento/prioridade/gestor, projetos críticos, orçamento e **retorno financeiro do
  portfólio** (investimento × retorno esperado, benefício líquido e ROI por departamento).
  Restrito à gestão.
- **Riscos** — heatmap corporativo 5 × 5 (probabilidade × impacto).
- **Relatórios** — portfólio (com ROI, payback e conclusão projetada), cronograma de tarefas,
  **etapas dos projetos** e capacidade da equipe, em Excel, CSV e PDF com cabeçalho institucional.
- **Atividades** — feed em tempo real + trilha de auditoria (valor antigo × novo).
- **Configurações** — perfil, capacidade semanal, permissões e paleta da marca.
- **Leitura gerencial (Diretoria)** — no dashboard, na aba Projetos, no executivo e no topo do
  Kanban: **percentual de
  projetos concluídos** e a distribuição em cinco situações — concluído, em andamento, paralisado,
  não iniciado e cancelado —, com barra empilhada e o número absoluto abaixo. Ao lado, o **gráfico
  por área** (Agrícola, Administrativo, Industrial), mostrando quanto cada área pesa no portfólio e
  como ela se distribui por dentro. Um terceiro bloco traz **aprovação da Diretoria** (aprovados,
  em aprovação, não aprovados) e **lançamento no Redmine** (lançados × não lançados), também em
  percentual. Na aba Projetos os três blocos seguem os filtros da tela: filtrar por departamento
  mostra o percentual daquele departamento.
- **Governança do projeto** — no formulário: **área**, **aprovado pela Diretoria** (sim / não / em
  aprovação), **lançado no Redmine** (sim / não), **prazo para medir aderência** e **Melhoria
  Contínua** (sim / não / em avaliação). Todos entram também na exportação do portfólio. Na seção
  **Execução real**, o início e a conclusão de fato são editáveis — é delas que sai o tempo de
  realização do projeto encerrado, com a prévia em dias aparecendo enquanto se digita.
- **Prazo** — projeto encerrado deixa de acumular atraso e passa a mostrar **quanto levou** (do
  início real à entrega). Os que estavam atrasados hoje ganharam a marca **prazo a definir**: a tela
  mostra "A definir", eles saem da conta de atrasados, e a data antiga continua guardada — a marca
  cai sozinha quando um prazo novo é salvo, e há uma chave no formulário para ligar ou desligar
  projeto a projeto.
- **Analistas responsáveis** — o campo antes chamado "dono no sistema" virou **Analistas
  responsáveis** e aceita até 8 pessoas. Todas podem editar o projeto; a primeira é a principal e
  fica em `projects.owner_id`, de onde saem `owner_name` e os relatórios. As demais são gravadas
  como gestoras em `project_members`, sem tocar em quem foi somado pela aba Equipe.
- **Alertas** — o sino já reunia comentário, menção e tarefa atribuída; agora os alertas de **prazo
  hoje**, **prazo amanhã** e **projeto atrasado** são gerados sozinhos todo dia às 08:00 de Brasília
  (`pg_cron` chamando `generate_deadline_alerts()`). Com a permissão concedida no sino, o alerta
  vira um **balão do navegador** quando a aba está escondida — em outra aba ou com a janela
  minimizada —, e continua como aviso dentro do app quando ela está à vista.
- **Lembretes programados** — botão **Lembrete** no cabeçalho do projeto: você escreve o aviso,
  marca dia e hora e escolhe se repete (uma vez, a cada hora, a cada 4 horas, todo dia ou toda
  semana). A hora fica no banco, e não num timer do navegador, então o lembrete sobrevive a
  recarregar a página e a trocar de máquina; se ninguém estava com o sistema aberto na hora
  marcada, ele aparece na abertura seguinte. Com várias abas abertas, só uma avisa.
- **Mural de indicadores (modo TV)** — botão **Modo TV** no rodapé da barra lateral (e no dashboard)
  abre `/tv` e a tela passa a ser só o mural. Seis lâminas girando sozinhas a cada 11s: panorama do
  portfólio em números grandes, saúde por situação, projetos que exigem atenção, próximas entregas,
  gestão por analista e a marca. Relógio, barra de tempo da lâmina, tela cheia, cursor que some
  sozinho, setas do teclado ou do controle da TV para passar as lâminas, botão de sair e dados que
  se atualizam pelo Realtime — feita para ficar ligada o dia inteiro sem ninguém tocar.
- **Manifesto da marca em movimento** — FORTALECER, CONECTAR e CRESCER entram um por vez e a
  assinatura **JEITO MORENO DE SER** fecha o ciclo, que recomeça sozinho. Em painel na tela de
  login e como letreiro de uma linha no rodapé da barra lateral. É CSS puro: os elementos dividem
  o mesmo laço de 9s e só mudam de atraso, então nunca saem de compasso.

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
- **Conclusão por tempo**: percentual do prazo consumido, índice de ritmo (executado ÷ previsto),
  data de conclusão projetada no ritmo atual e desvio dessa projeção em dias.
- **Viabilidade econômica**: retorno esperado e realizado, benefício líquido, ROI planejado e
  realizado, payback em meses e classificação automática (inviável, atenção, viável, alto retorno).
- **Etapas do projeto**: início e término planejados × reais, avanço ponderado por peso, etapas
  atrasadas e o texto de andamento escrito pelo responsável — desenhados no organograma de etapas e
  distribuídos no kanban pela data de término.

### Tempo real

Um canal Supabase Realtime por contexto invalida o cache do TanStack Query quando qualquer usuário
altera projetos, tarefas, comentários, checklist, arquivos, horas, riscos, marcos, etapas, equipe ou
notificações. Presença por heartbeat alimenta o indicador de usuários online.

### Auditoria

Trigger genérico registra em `audit_log` quem alterou, quando, valor antigo, valor novo e a lista de
campos modificados — para projetos, tarefas, equipe, checklist, marcos, etapas, riscos,
apontamentos, arquivos e perfis.

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
│   ├── views/             Kanban de etapas e de tarefas, Lista, Gantt, Timeline, Calendário
│   ├── projects/          painéis do projeto (riscos, arquivos, equipe, …)
│   ├── charts/            Burn Down, Burn Up, Curva S, organograma de etapas
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
