-- Etapa 8.2 — Isolamento de dados por organização (RLS multi-tenant)
--
-- Toda policy de toda tabela passa a filtrar também por organization_id,
-- garantindo isolamento total entre clínicas. Usa ALTER POLICY (não
-- drop+create) para trocar cirurgicamente só a condição, mantendo nome/
-- perfis/comando de cada policy como já estavam.

-- Helper equivalente ao current_user_role() da Etapa 1.2.
create or replace function public.current_user_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.users where id = auth.uid();
$$;

comment on function public.current_user_organization_id() is
  'Devolve a organização do utilizador autenticado. security definer para evitar recursão de RLS em public.users.';

-- organizations: cada utilizador só vê a própria organização (gestão de
-- organizações em si — criar, editar — fica para a Etapa 8.4, onboarding).
alter table public.organizations enable row level security;

create policy "organizations_select_own"
on public.organizations
for select
to authenticated
using (id = public.current_user_organization_id());

-- users --------------------------------------------------------------------

alter policy "users_select_admin"
on public.users
using (
  public.current_user_role() = 'administrador'
  and organization_id = public.current_user_organization_id()
);

alter policy "users_update_admin"
on public.users
using (
  public.current_user_role() = 'administrador'
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() = 'administrador'
  and organization_id = public.current_user_organization_id()
);

-- activities -----------------------------------------------------------------

alter policy "activities_select_own"
on public.activities
using (
  actor_id = auth.uid()
  and organization_id = public.current_user_organization_id()
);

alter policy "activities_select_admin"
on public.activities
using (
  public.current_user_role() = 'administrador'
  and organization_id = public.current_user_organization_id()
);

-- companies --------------------------------------------------------------------

alter policy "companies_select"
on public.companies
using (
  public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao')
  and organization_id = public.current_user_organization_id()
);

alter policy "companies_insert"
on public.companies
with check (
  public.current_user_role() in ('administrador', 'gestor', 'comercial')
  and organization_id = public.current_user_organization_id()
);

alter policy "companies_update"
on public.companies
using (
  public.current_user_role() in ('administrador', 'gestor', 'comercial')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('administrador', 'gestor', 'comercial')
  and organization_id = public.current_user_organization_id()
);

-- tags -------------------------------------------------------------------------

alter policy "tags_select"
on public.tags
using (organization_id = public.current_user_organization_id());

alter policy "tags_insert"
on public.tags
with check (
  public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao')
  and organization_id = public.current_user_organization_id()
);

alter policy "tags_update"
on public.tags
using (
  public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao')
  and organization_id = public.current_user_organization_id()
);

-- campaigns --------------------------------------------------------------------

alter policy "campaigns_select"
on public.campaigns
using (
  public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao')
  and organization_id = public.current_user_organization_id()
);

alter policy "campaigns_insert"
on public.campaigns
with check (
  public.current_user_role() in ('administrador', 'gestor', 'comercial')
  and organization_id = public.current_user_organization_id()
);

alter policy "campaigns_update"
on public.campaigns
using (
  public.current_user_role() in ('administrador', 'gestor', 'comercial')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('administrador', 'gestor', 'comercial')
  and organization_id = public.current_user_organization_id()
);

-- patients -----------------------------------------------------------------

alter policy "patients_select"
on public.patients
using (organization_id = public.current_user_organization_id());

alter policy "patients_insert"
on public.patients
with check (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial')
  and organization_id = public.current_user_organization_id()
);

alter policy "patients_update"
on public.patients
using (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial')
  and organization_id = public.current_user_organization_id()
);

-- patient_tags -----------------------------------------------------------------

alter policy "patient_tags_select"
on public.patient_tags
using (organization_id = public.current_user_organization_id());

alter policy "patient_tags_insert"
on public.patient_tags
with check (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial')
  and organization_id = public.current_user_organization_id()
);

alter policy "patient_tags_delete"
on public.patient_tags
using (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial')
  and organization_id = public.current_user_organization_id()
);

-- leads --------------------------------------------------------------------

alter policy "leads_select"
on public.leads
using (
  public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao')
  and organization_id = public.current_user_organization_id()
);

alter policy "leads_insert"
on public.leads
with check (
  public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao')
  and organization_id = public.current_user_organization_id()
);

alter policy "leads_update"
on public.leads
using (
  public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao')
  and organization_id = public.current_user_organization_id()
);

-- pipelines --------------------------------------------------------------------

alter policy "pipelines_select"
on public.pipelines
using (
  public.current_user_role() in ('administrador', 'gestor', 'comercial')
  and organization_id = public.current_user_organization_id()
);

alter policy "pipelines_insert"
on public.pipelines
with check (
  public.current_user_role() in ('administrador', 'gestor')
  and organization_id = public.current_user_organization_id()
);

alter policy "pipelines_update"
on public.pipelines
using (
  public.current_user_role() in ('administrador', 'gestor')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('administrador', 'gestor')
  and organization_id = public.current_user_organization_id()
);

-- deals --------------------------------------------------------------------

alter policy "deals_select"
on public.deals
using (
  public.current_user_role() in ('administrador', 'gestor', 'comercial')
  and organization_id = public.current_user_organization_id()
);

alter policy "deals_insert"
on public.deals
with check (
  public.current_user_role() in ('administrador', 'gestor', 'comercial')
  and organization_id = public.current_user_organization_id()
);

alter policy "deals_update"
on public.deals
using (
  public.current_user_role() in ('administrador', 'gestor', 'comercial')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('administrador', 'gestor', 'comercial')
  and organization_id = public.current_user_organization_id()
);

-- tasks --------------------------------------------------------------------

alter policy "tasks_select"
on public.tasks
using (
  public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao')
  and organization_id = public.current_user_organization_id()
);

alter policy "tasks_insert"
on public.tasks
with check (
  public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao')
  and organization_id = public.current_user_organization_id()
);

alter policy "tasks_update"
on public.tasks
using (
  public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao')
  and organization_id = public.current_user_organization_id()
);

-- conversations --------------------------------------------------------------------

alter policy "conversations_select"
on public.conversations
using (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial')
  and organization_id = public.current_user_organization_id()
);

alter policy "conversations_insert"
on public.conversations
with check (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial')
  and organization_id = public.current_user_organization_id()
);

alter policy "conversations_update"
on public.conversations
using (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial')
  and organization_id = public.current_user_organization_id()
);

-- messages --------------------------------------------------------------------

alter policy "messages_select"
on public.messages
using (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial')
  and organization_id = public.current_user_organization_id()
);

alter policy "messages_insert"
on public.messages
with check (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial')
  and organization_id = public.current_user_organization_id()
);

-- appointments -----------------------------------------------------------------

alter policy "appointments_select"
on public.appointments
using (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'profissional')
  and organization_id = public.current_user_organization_id()
);

alter policy "appointments_insert"
on public.appointments
with check (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao')
  and organization_id = public.current_user_organization_id()
);

alter policy "appointments_update"
on public.appointments
using (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('administrador', 'gestor', 'recepcao')
  and organization_id = public.current_user_organization_id()
);

-- treatments (mantém o scoping por professional_id da Etapa 5.3, só
-- acrescenta a organização) ---------------------------------------------------

alter policy "treatments_select"
on public.treatments
using (
  organization_id = public.current_user_organization_id()
  and (
    public.current_user_role() in ('administrador', 'gestor', 'comercial')
    or (
      public.current_user_role() = 'profissional'
      and professional_id = auth.uid()
    )
  )
);

alter policy "treatments_insert"
on public.treatments
with check (
  public.current_user_role() in ('administrador', 'gestor')
  and organization_id = public.current_user_organization_id()
);

alter policy "treatments_update"
on public.treatments
using (
  organization_id = public.current_user_organization_id()
  and (
    public.current_user_role() in ('administrador', 'gestor')
    or (
      public.current_user_role() = 'profissional'
      and professional_id = auth.uid()
    )
  )
)
with check (
  organization_id = public.current_user_organization_id()
  and (
    public.current_user_role() in ('administrador', 'gestor')
    or (
      public.current_user_role() = 'profissional'
      and professional_id = auth.uid()
    )
  )
);

-- Funções security definer que fazem bypass a RLS (Etapas 2.5, 4.5, 7.3,
-- 7.4) precisam de scoping explícito por organização — não herdam a RLS
-- das tabelas por serem security definer. As duas chamadas a partir de
-- um utilizador autenticado (7.3/7.4) usam current_user_organization_id();
-- as invocadas por service_role/automação (2.5/4.5) não têm "utilizador
-- atual", por isso ganham um parâmetro p_organization_id explícito.

create or replace function public.get_team_performance()
returns table (
  user_id uuid,
  full_name text,
  role public.user_role,
  deals_closed bigint,
  appointments_done bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_org_id uuid;
begin
  if public.current_user_role() not in ('administrador', 'gestor') then
    return;
  end if;

  v_org_id := public.current_user_organization_id();

  return query
  select
    u.id,
    u.full_name,
    u.role,
    coalesce(d.deals_closed, 0),
    coalesce(a.appointments_done, 0)
  from public.users u
  left join (
    select responsible_user_id, count(*) as deals_closed
    from public.deals
    where funnel_stage = 'concluido' and responsible_user_id is not null and organization_id = v_org_id
    group by responsible_user_id
  ) d on d.responsible_user_id = u.id
  left join (
    select professional_id, count(*) as appointments_done
    from public.appointments
    where status = 'realizada' and professional_id is not null and organization_id = v_org_id
    group by professional_id
  ) a on a.professional_id = u.id
  where u.active and u.organization_id = v_org_id
  order by u.full_name;
end;
$$;

create or replace function public.get_deals_health(p_stalled_days integer default 7)
returns table (
  deal_id uuid,
  patient_name text,
  funnel_stage public.funnel_stage,
  lost_reason text,
  estimated_value numeric,
  responsible_name text,
  days_since_update integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_org_id uuid;
begin
  if public.current_user_role() not in ('administrador', 'gestor') then
    return;
  end if;

  v_org_id := public.current_user_organization_id();

  return query
  select
    d.id,
    p.full_name,
    d.funnel_stage,
    d.lost_reason,
    d.estimated_value,
    u.full_name,
    extract(day from now() - d.updated_at)::int
  from public.deals d
  join public.patients p on p.id = d.patient_id
  left join public.users u on u.id = d.responsible_user_id
  where d.active
    and d.organization_id = v_org_id
    and (
      d.funnel_stage = 'perdido'
      or (
        d.funnel_stage not in ('concluido', 'perdido')
        and d.updated_at < now() - (p_stalled_days || ' days')::interval
      )
    )
  order by d.updated_at asc;
end;
$$;

-- get_tomorrow_appointments e as rotinas de follow-up (2.5) são chamadas
-- por service_role (N8N/pg_cron), sem sessão de utilizador — passam a
-- exigir p_organization_id explícito. Ver PENDENCIAS.md, o contrato para
-- o N8N muda.

create or replace function public.get_tomorrow_appointments(p_organization_id uuid)
returns table (
  appointment_id uuid,
  patient_id uuid,
  patient_name text,
  patient_phone text,
  scheduled_at timestamptz,
  professional_name text,
  status public.appointment_status
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    p.id,
    p.full_name,
    p.phone,
    a.scheduled_at,
    u.full_name,
    a.status
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  left join public.users u on u.id = a.professional_id
  where a.organization_id = p_organization_id
    and a.scheduled_at >= (current_date + 1)::timestamptz
    and a.scheduled_at < (current_date + 2)::timestamptz
    and a.status in ('marcada', 'confirmada')
  order by a.scheduled_at;
$$;

drop function if exists public.get_tomorrow_appointments();

revoke execute on function public.get_tomorrow_appointments(uuid) from public, anon, authenticated;
grant execute on function public.get_tomorrow_appointments(uuid) to service_role;

create or replace function public.create_followup_tasks_unanswered_leads(p_organization_id uuid, p_days integer default 3)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_lead record;
begin
  for v_lead in
    select l.id, l.patient_id, l.organization_id
    from public.leads l
    where l.status in ('novo', 'contactado')
      and l.active
      and l.organization_id = p_organization_id
      and l.updated_at < now() - (p_days || ' days')::interval
      and not exists (
        select 1 from public.tasks t
        where t.lead_id = l.id and t.status = 'pendente'
      )
  loop
    insert into public.tasks (organization_id, patient_id, lead_id, title, description, due_at, status)
    values (
      v_lead.organization_id,
      v_lead.patient_id,
      v_lead.id,
      'Follow-up: lead sem resposta',
      format('Lead sem interação há mais de %s dias. Retomar contacto.', p_days),
      now(),
      'pendente'
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.create_followup_tasks_stalled_budget(p_organization_id uuid, p_days integer default 5)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_deal record;
begin
  for v_deal in
    select d.id, d.patient_id, d.organization_id
    from public.deals d
    where d.funnel_stage = 'orcamento_enviado'
      and d.active
      and d.organization_id = p_organization_id
      and d.updated_at < now() - (p_days || ' days')::interval
      and not exists (
        select 1 from public.tasks t
        where t.deal_id = d.id and t.status = 'pendente'
      )
  loop
    insert into public.tasks (organization_id, patient_id, deal_id, title, description, due_at, status)
    values (
      v_deal.organization_id,
      v_deal.patient_id,
      v_deal.id,
      'Follow-up: orçamento parado',
      format('Orçamento enviado há mais de %s dias sem resposta. Retomar contacto.', p_days),
      now(),
      'pendente'
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.run_followup_checks(
  p_organization_id uuid,
  p_days_unanswered_lead integer default 3,
  p_days_stalled_budget integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leads integer;
  v_deals integer;
begin
  v_leads := public.create_followup_tasks_unanswered_leads(p_organization_id, p_days_unanswered_lead);
  v_deals := public.create_followup_tasks_stalled_budget(p_organization_id, p_days_stalled_budget);

  return jsonb_build_object(
    'unanswered_leads_tasks_created', v_leads,
    'stalled_budget_tasks_created', v_deals
  );
end;
$$;

drop function if exists public.create_followup_tasks_unanswered_leads(integer);
drop function if exists public.create_followup_tasks_stalled_budget(integer);
drop function if exists public.run_followup_checks(integer, integer);

revoke execute on function public.create_followup_tasks_unanswered_leads(uuid, integer) from public, anon, authenticated;
revoke execute on function public.create_followup_tasks_stalled_budget(uuid, integer) from public, anon, authenticated;
revoke execute on function public.run_followup_checks(uuid, integer, integer) from public, anon, authenticated;

grant execute on function public.create_followup_tasks_unanswered_leads(uuid, integer) to service_role;
grant execute on function public.create_followup_tasks_stalled_budget(uuid, integer) to service_role;
grant execute on function public.run_followup_checks(uuid, integer, integer) to service_role;
