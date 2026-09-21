-- Etapa 2.2 — Schema deals
--
-- Oportunidades comerciais: valor estimado do tratamento, responsável
-- pelo atendimento, etapa atual do funil, ligadas a patients/leads/pipelines.

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  lead_id uuid references public.leads (id),
  pipeline_id uuid references public.pipelines (id),
  responsible_user_id uuid references public.users (id),
  funnel_stage public.funnel_stage not null default 'novo_lead',
  estimated_value numeric(12, 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.deals is
  'Oportunidades comerciais (funil/Kanban). pipeline_id assume o pipeline default se não for indicado (trigger deals_set_default_pipeline). Sem delete via API — usar active=false.';

create index deals_patient_idx on public.deals (patient_id);
create index deals_lead_idx on public.deals (lead_id);
create index deals_pipeline_stage_idx on public.deals (pipeline_id, funnel_stage);

-- Postgres não permite subquery em DEFAULT, por isso o pipeline default
-- é resolvido num trigger BEFORE INSERT (corre antes da constraint
-- not null, por isso pipeline_id pode ficar not null a partir daqui).
create or replace function public.set_default_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pipeline_id is null then
    select id into new.pipeline_id
    from public.pipelines
    where is_default
    limit 1;
  end if;
  return new;
end;
$$;

create trigger deals_set_default_pipeline
before insert on public.deals
for each row execute function public.set_default_pipeline();

alter table public.deals
  alter column pipeline_id set not null;

create trigger deals_set_updated_at
before update on public.deals
for each row execute function public.set_updated_at();

-- Auditoria (reutiliza log_activity() da Etapa 1.3) -------------------------

create or replace function public.log_deals_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('deal.created', 'deals', new.id, jsonb_build_object('patient_id', new.patient_id, 'funnel_stage', new.funnel_stage));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity('deal.updated', 'deals', new.id, jsonb_build_object('patient_id', new.patient_id, 'funnel_stage', new.funnel_stage));
  end if;
  return new;
end;
$$;

create trigger deals_log_activity
after insert or update on public.deals
for each row execute function public.log_deals_activity();

-- RLS -------------------------------------------------------------------------
--
-- Mesmo conjunto de perfis do módulo Funil (Etapa 1.9): administrador/
-- gestor/comercial. Receção e Profissional não gerem oportunidades.
-- Sem delete: soft delete via active=false.

alter table public.deals enable row level security;

create policy "deals_select"
on public.deals
for select
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'comercial'));

create policy "deals_insert"
on public.deals
for insert
to authenticated
with check (public.current_user_role() in ('administrador', 'gestor', 'comercial'));

create policy "deals_update"
on public.deals
for update
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'comercial'))
with check (public.current_user_role() in ('administrador', 'gestor', 'comercial'));
