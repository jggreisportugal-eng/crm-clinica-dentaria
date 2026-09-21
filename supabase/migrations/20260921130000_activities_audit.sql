-- Etapa 1.3 — Schema activities (auditoria)
--
-- Tabela activities: timeline de ações no CRM e, simultaneamente, log de
-- auditoria (quem fez o quê, quando). Nasce agora, na Fase 1, para ser
-- reutilizada por todas as fases seguintes (função log_activity).

-- 1. Tabela ---------------------------------------------------------------

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.activities is
  'Timeline de ações do CRM / log de auditoria. Escrita apenas via public.log_activity(); registo append-only (sem update/delete).';
comment on column public.activities.actor_id is
  'Utilizador que executou a ação. NULL = ação de sistema (ex.: trigger de registo automático).';
comment on column public.activities.entity_type is
  'Nome lógico da entidade afetada (ex.: users, patients, deals). Sem FK — referência polimórfica.';

create index activities_entity_idx on public.activities (entity_type, entity_id);
create index activities_actor_idx on public.activities (actor_id);
create index activities_created_at_idx on public.activities (created_at desc);

-- 2. Função reutilizável de registo ----------------------------------------
--
-- Qualquer módulo futuro (trigger de outra tabela, ou chamada RPC a partir
-- do backend) usa esta função para gravar uma entrada em activities.
-- security definer: nenhum perfil tem INSERT direto sobre a tabela — o
-- log só é escrito por este caminho único, controlado.

create or replace function public.log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.activities (actor_id, action, entity_type, entity_id, metadata)
  values (coalesce(p_actor_id, auth.uid()), p_action, p_entity_type, p_entity_id, p_metadata)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.log_activity is
  'Ponto único de escrita em activities. p_actor_id opcional (default: auth.uid(), NULL em contexto de sistema/trigger sem sessão).';

-- 3. RLS --------------------------------------------------------------------

alter table public.activities enable row level security;

-- Cada utilizador vê as ações que ele próprio executou.
create policy "activities_select_own"
on public.activities
for select
to authenticated
using (actor_id = auth.uid());

-- Administrador vê a timeline/auditoria completa.
create policy "activities_select_admin"
on public.activities
for select
to authenticated
using (public.current_user_role() = 'administrador');

-- Sem policies de insert/update/delete para 'authenticated': escrita
-- apenas via log_activity() (security definer), leitura nunca alterável —
-- log de auditoria append-only, mesmo o Administrador não pode editar ou
-- apagar registos pela API.

-- 4. Liga a criação de utilizador (Etapa 1.2) ao log de auditoria ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  v_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    'recepcao'
  );

  insert into public.users (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', v_role);

  perform public.log_activity(
    'user.created',
    'users',
    new.id,
    jsonb_build_object('email', new.email, 'role', v_role)
  );

  return new;
end;
$$;
