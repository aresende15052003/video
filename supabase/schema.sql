-- ─────────────────────────────────────────────────────────────
-- Ana Clara Resende — banco do formulário de orçamento + painel /admin
-- Rode este arquivo inteiro em: Supabase → SQL Editor → New query → Run
-- Pode ser executado mais de uma vez com segurança (não apaga dados).
-- ─────────────────────────────────────────────────────────────

-- ── 1. Tabela de leads ───────────────────────────────────────
create table if not exists public.leads (
  id                          uuid primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),
  nome                        text not null check (char_length(nome) between 3 and 120),
  whatsapp                    text not null check (whatsapp ~ '^55[1-9]{2}[0-9]{8,9}$'),
  email                       text check (email is null or char_length(email) <= 254),
  estilo_video                text not null check (char_length(estilo_video) <= 120),
  objetivo                    text not null check (char_length(objetivo) <= 120),
  quantidade                  text not null check (char_length(quantidade) <= 120),
  submission_id               uuid not null unique,         -- impede envios duplicados
  consentimento_rastreamento  boolean not null default false,
  user_agent                  text
);

-- Status do atendimento (adicionado também em tabelas já existentes)
alter table public.leads add column if not exists status text not null default 'novo';
alter table public.leads add column if not exists status_atualizado_em timestamptz;

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('novo', 'em_contato', 'proposta_enviada', 'negociacao', 'fechado', 'perdido'));

comment on table  public.leads is 'Contatos do formulário de orçamento (edição de vídeo e motion).';
comment on column public.leads.whatsapp is 'Formato 55 + DDD + número, só dígitos.';
comment on column public.leads.status is 'novo | em_contato | proposta_enviada | negociacao | fechado | perdido';
comment on column public.leads.submission_id is 'ID gerado no navegador por preenchimento; garante idempotência.';

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);

-- Atualiza a data da mudança de status automaticamente
create or replace function public.leads_touch_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_atualizado_em := now();
  end if;
  return new;
end;
$$;

drop trigger if exists leads_touch_status on public.leads;
create trigger leads_touch_status
  before update on public.leads
  for each row execute function public.leads_touch_status();

-- ── 2. Administradores ───────────────────────────────────────
-- Só quem estiver nesta tabela acessa o painel. Ter uma conta no
-- Supabase Auth NÃO basta: é preciso ser incluído aqui manualmente.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

-- ── 3. Segurança (RLS + permissões) ──────────────────────────
alter table public.leads  enable row level security;
alter table public.leads  force row level security;
alter table public.admins enable row level security;
alter table public.admins force row level security;

-- Visitantes (anon) não têm NENHUM acesso. O formulário grava pela
-- rota de API do servidor, com a chave secreta (service_role).
revoke all on table public.leads  from anon, authenticated;
revoke all on table public.admins from anon, authenticated;

-- Usuários logados: podem ler leads e alterar SOMENTE a coluna status.
-- As policies abaixo restringem isso a quem é administrador.
grant select          on table public.leads  to authenticated;
grant update (status) on table public.leads  to authenticated;
grant select          on table public.admins to authenticated;

drop policy if exists leads_admin_select on public.leads;
create policy leads_admin_select on public.leads
  for select to authenticated
  using (public.is_admin());

drop policy if exists leads_admin_update on public.leads;
create policy leads_admin_update on public.leads
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admins_self_select on public.admins;
create policy admins_self_select on public.admins
  for select to authenticated
  using (user_id = auth.uid());

-- Sem policies de INSERT/DELETE: ninguém além do servidor cria leads,
-- e ninguém apaga leads pela API (exclusão só pelo painel do Supabase).

-- ── 4. Visualização com horário de Brasília (Table Editor) ──
drop view if exists public.leads_brasilia;
create view public.leads_brasilia
with (security_invoker = true) as
select
  to_char(created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as enviado_em,
  nome,
  whatsapp,
  'https://wa.me/' || whatsapp as link_whatsapp,
  email,
  estilo_video,
  objetivo,
  quantidade,
  status,
  consentimento_rastreamento,
  created_at,
  id
from public.leads
order by created_at desc;

revoke all on public.leads_brasilia from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. CADASTRAR VOCÊ COMO ADMINISTRADORA (rode DEPOIS de criar o
--    usuário em Authentication → Users). Troque o e-mail abaixo:
--
-- insert into public.admins (user_id, email)
-- select id, email from auth.users where email = 'seu-email@dominio.com'
-- on conflict (user_id) do nothing;
-- ─────────────────────────────────────────────────────────────
