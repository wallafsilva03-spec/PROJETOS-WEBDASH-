-- =====================================================================
-- Fase 5 · Migration 13 — Lembretes programados pela própria pessoa
-- =====================================================================
--
-- Os alertas que já existiam nascem de regra: prazo chegando, projeto
-- atrasado, alguém te mencionou. Este é o contrário — a pessoa marca a hora
-- que quiser, para o projeto que quiser, e o navegador avisa.
--
-- Só cria tabela nova. Nada existente é alterado ou removido.
-- =====================================================================

create table if not exists public.reminders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  project_id     uuid references public.projects (id) on delete cascade,
  title          text not null,
  body           text,

  -- Quando avisar da próxima vez. É esta coluna que a tela consulta.
  next_at        timestamptz not null,

  -- Minutos entre um aviso e o seguinte. Nulo = avisa uma vez e encerra.
  -- O piso de 5 minutos evita que um erro de digitação vire um aviso por
  -- segundo na cara de quem cadastrou.
  repeat_minutes integer,

  is_active      boolean not null default true,
  last_fired_at  timestamptz,
  created_at     timestamptz not null default now(),

  constraint reminders_title_chk check (char_length(btrim(title)) between 2 and 120),
  constraint reminders_repeat_chk check (repeat_minutes is null or repeat_minutes >= 5)
);

-- A consulta da tela é sempre "meus lembretes vencidos, do mais antigo".
create index if not exists idx_reminders_due
  on public.reminders (user_id, is_active, next_at);

alter table public.reminders enable row level security;

-- Lembrete é assunto de quem criou: ninguém mais lê, edita ou apaga.
drop policy if exists reminders_select_own on public.reminders;
create policy reminders_select_own on public.reminders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists reminders_insert_own on public.reminders;
create policy reminders_insert_own on public.reminders
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists reminders_update_own on public.reminders;
create policy reminders_update_own on public.reminders
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reminders_delete_own on public.reminders;
create policy reminders_delete_own on public.reminders
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.reminders to authenticated;

-- ---------------------------------------------------------------------
-- O lembrete disparado também vira linha no sino, para ficar no histórico
-- junto com os outros alertas. Para isso falta uma policy de insert em
-- `notifications`: até aqui só as funções `security definer` escreviam lá.
--
-- A permissão é a mais estreita possível — criar notificação **para si
-- mesmo**. Quem já podia ler, marcar como lida e apagar as próprias agora
-- pode criar as próprias; não abre nada sobre as de mais ninguém.
-- ---------------------------------------------------------------------
drop policy if exists notifications_insert_self on public.notifications;
create policy notifications_insert_self on public.notifications
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Realtime: a tela escuta a própria fila de lembretes.
-- ---------------------------------------------------------------------
do $$
begin
  alter table public.reminders replica identity full;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reminders'
  ) then
    alter publication supabase_realtime add table public.reminders;
  end if;
end $$;
