# Como colocar para rodar e testar

Guia direto do zero até o primeiro login. Leva cerca de 10 minutos, quase tudo
esperando o Supabase criar o projeto.

**Pré-requisito:** Node 20 ou superior (`node -v` para conferir).

---

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e entre com sua conta.
2. **New project**. Dê um nome (ex.: `webdash-grupo-moreno`), defina a senha do
   banco e escolha a região **South America (São Paulo)** — menor latência.
3. Aguarde o provisionamento (1 a 2 minutos).

---

## 2. Criar as tabelas

No painel do Supabase, abra **SQL Editor** → **New query**.

Cole **todo** o conteúdo do arquivo [`supabase/setup.sql`](../supabase/setup.sql)
e clique em **Run**.

Esse arquivo único reúne as 7 migrations mais os cadastros básicos: cria as 20
tabelas, os tipos, as views, as functions, os triggers, as políticas de acesso,
a publicação de tempo real e os buckets de arquivos. Rodar mais de uma vez é
seguro — tudo usa `if not exists` / `or replace`.

Ao final você deve ver `Success. No rows returned`.

> **Alternativa pelo CLI**, se preferir versionar as migrations:
> ```bash
> supabase link --project-ref SEU-PROJECT-REF
> supabase db push
> ```

### Conferir se deu certo

Ainda no SQL Editor, rode:

```sql
select count(*) as tabelas from information_schema.tables
 where table_schema = 'public' and table_type = 'BASE TABLE';
```

Deve retornar **20**.

---

## 3. Desligar a confirmação de e-mail

**Este passo é o que mais trava quem está testando.** Por padrão o Supabase
exige confirmar o e-mail antes do primeiro login, e sem um servidor de e-mail
configurado a mensagem não chega — você cria a conta e não consegue entrar.

Vá em **Authentication → Sign In / Providers → Email** e desative
**Confirm email**. Salve.

Em produção, deixe ligado e configure o SMTP.

---

## 4. Pegar as credenciais

Em **Project Settings → API**, copie:

- **Project URL** — algo como `https://abcdefgh.supabase.co`
- **anon public** — a chave pública (a `service_role` **não** deve ser usada aqui)

Na raiz do projeto:

```bash
cp .env.example .env.local
```

Edite o `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 5. Subir a aplicação

```bash
npm install
npm run dev
```

Abra **http://localhost:3000**. Você cai na tela de login.

---

## 6. Criar sua conta

Clique em **Criar conta** e cadastre-se.

**O primeiro usuário cadastrado vira administrador automaticamente** — isso é
feito por um trigger no banco, não pelo frontend. Os próximos entram como
colaboradores, e você pode promovê-los depois em **Configurações → Acessos**.

---

## 7. Criar dados de demonstração

O sistema começa vazio. Para ver as telas com conteúdo, volte ao **SQL Editor**
do Supabase — já logado na aplicação — e rode:

```sql
select public.seed_demo_projects();
```

Isso cria dois projetos com tarefas, dependências, marcos, riscos e checklist,
todos vinculados a você. Recarregue a aplicação.

---

## Roteiro de teste

Depois do seed, vale conferir o que cada parte faz:

| Onde | O que testar | O que deve acontecer |
| ---- | ------------ | -------------------- |
| **Dashboard** | Abrir | Cards preenchidos: projetos ativos, tarefas, horas, indicador geral |
| **Projetos → PRJ-001 → Kanban** | Arrastar um card entre colunas | Move na hora; o progresso do projeto se recalcula sozinho |
| **Aba Gantt** | Observar as barras | "Arquitetura e modelagem" aparece em vermelho — está no caminho crítico |
| **Aba Gantt** | Abrir uma tarefa e adiar a data fim | As tarefas dependentes se deslocam junto, mantendo a duração |
| **Aba Lista** | Marcar uma tarefa como concluída | Progresso do projeto sobe; a saúde pode mudar de cor |
| **Aba Indicadores** | Alternar Burn Down / Burn Up / Curva S | Os três gráficos com a série de horas |
| **Aba Riscos** | Ver a matriz 5 × 5 | Dois riscos posicionados; severidade = probabilidade × impacto |
| **Aba Comentários** | Escrever com `@Wallaf` | A menção fica destacada e gera notificação |
| **Aba Horas** | Apontar 4 horas | Eficiência e workload se atualizam |
| **Workload** | Abrir | Sua ocupação calculada sobre a capacidade semanal |
| **Executivo** | Abrir | Lead Time, Cycle Time, gráficos de portfólio |
| **Relatórios** | Exportar em PDF | Arquivo com o cabeçalho institucional Grupo Moreno |
| **Topo da tela** | `Ctrl+K` (ou `⌘K`) | Busca global em projetos, tarefas, comentários e pessoas |
| **Menu do usuário** | Alternar tema | Claro e escuro |

### Testar o tempo real

Abra a aplicação em **duas janelas** lado a lado (pode ser a mesma conta, ou
uma janela anônima com outra conta). Mova um card no Kanban de uma janela: ele
se move na outra em menos de um segundo, sem recarregar.

### Testar as permissões

Crie uma segunda conta pelo cadastro. Ela entra como colaborador e **não
enxerga nenhum projeto** — porque não pertence a nenhuma equipe. Volte na
primeira conta, vá em **Projetos → PRJ-001 → Equipe**, adicione a segunda
pessoa, e recarregue a outra janela: o projeto aparece.

Isso não é regra de interface. É Row Level Security dentro do Postgres — o
banco simplesmente não devolve aquelas linhas.

---

## Problemas comuns

**"Variáveis NEXT_PUBLIC_SUPABASE_URL e ... não configuradas"**
O `.env.local` não existe ou está com nome errado. Confirme que está na raiz do
projeto e reinicie o `npm run dev` — variáveis de ambiente só são lidas na
inicialização.

**Cadastro feito mas não consigo entrar**
A confirmação de e-mail está ligada. Volte ao passo 3.

**Login funciona mas o dashboard fica zerado**
Normal num banco novo. Rode o `seed_demo_projects()` do passo 7, ou crie um
projeto pelo botão **Novo projeto**.

**"relation public.v_project_overview does not exist"**
O `setup.sql` não foi executado por inteiro. Rode novamente — é seguro repetir.

**O Kanban não atualiza em outra aba**
Confirme que o passo 2 rodou até o fim: a última parte é justamente a que
publica as tabelas no Realtime.

**Quero recomeçar do zero**
No SQL Editor: `drop schema public cascade; create schema public;` e rode o
`setup.sql` de novo. Isso apaga todos os dados, mas mantém os usuários — para
limpar também as contas, use **Authentication → Users**.

---

## Publicar para a equipe usar

Para sair do `localhost`, o caminho natural é a Vercel:

1. Suba o repositório no GitHub (já está).
2. Em [vercel.com](https://vercel.com), **Add New → Project** e importe o repositório.
3. Em **Environment Variables**, adicione as mesmas três variáveis do `.env.local`,
   trocando `NEXT_PUBLIC_SITE_URL` pela URL que a Vercel gerar.
4. **Deploy**.
5. Volte ao Supabase em **Authentication → URL Configuration** e adicione a URL
   da Vercel em **Site URL** e em **Redirect URLs**.

O GitHub Pages não serve para a aplicação em si — ele só hospeda arquivos
estáticos, e o sistema depende de sessão no servidor e de rotas dinâmicas. O que
está publicado lá é a apresentação e a documentação do banco.
