-- Etapa 2.4 — Schema tasks
--
-- Tarefas e follow-ups, com próximo contacto definido por oportunidade
-- (deal), FK para deals/patients e para o utilizador responsável.

create type public.task_status as enum ('pendente', 'concluida', 'cancelada');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  deal_id uuid references public.deals (id),
  assigned_to uuid references public.users (id),
  title text not null,
  description text,
  due_at timestamptz,
  status public.task_status not null default 'pendente',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tasks is
  'Tarefas/follow-ups. Sem delete via API — ciclo de vida termina em status concluida/cancelada, não em eliminação.';

create index tasks_deal_idx on public.tasks (deal_id);
create index tasks_patient_idx on public.tasks (patient_id);
create index tasks_assigned_due_idx on public.tasks (assigned_to, due_at) where status = 'pendente';

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- Auditoria (reutiliza log_activity() da Etapa 1.3) -------------------------

create or replace function public.log_tasks_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('task.created', 'tasks', new.id, jsonb_build_object('title', new.title, 'deal_id', new.deal_id));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity('task.updated', 'tasks', new.id, jsonb_build_object('title', new.title, 'status', new.status));
  end if;
  return new;
end;
$$;

create trigger tasks_log_activity
after insert or update on public.tasks
for each row execute function public.log_tasks_activity();

-- RLS -------------------------------------------------------------------------
--
-- Leitura/escrita: administrador/gestor/comercial/recepcao — Receção fica
-- incluída desde já porque a Etapa 4.3 vai criar tarefas de confirmação
-- de consulta que lhe competem. Profissional fica de fora (não gere
-- follow-ups comerciais). Sem delete: o ciclo de vida termina em
-- status concluida/cancelada.

alter table public.tasks enable row level security;

create policy "tasks_select"
on public.tasks
for select
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao'));

create policy "tasks_insert"
on public.tasks
for insert
to authenticated
with check (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao'));

create policy "tasks_update"
on public.tasks
for update
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao'))
with check (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao'));
