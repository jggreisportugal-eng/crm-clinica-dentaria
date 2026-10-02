-- Histórico na ficha do paciente
--
-- Cronologia do paciente para a ficha: registo, entrada no funil e
-- mudanças de fase, follow-ups de fim de semana, consultas e lembretes,
-- tarefas. activities é um log de auditoria (só o administrador o lê
-- todo), por isso o histórico sai desta função, que devolve apenas os
-- eventos deste paciente e respeita o que cada perfil já vê nas tabelas:
--   funil (fases)           — administrador, gestor, comercial
--   consultas e lembretes   — administrador, gestor, recepcao
--   tarefas e follow-ups    — administrador, gestor, comercial, recepcao

create or replace function public.patient_history(p_patient_id uuid)
returns table (
  occurred_at timestamptz,
  kind text,
  actor_name text,
  details jsonb
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_org uuid := public.current_user_organization_id();
  v_funnel boolean;
  v_agenda boolean;
begin
  if v_org is null
     or coalesce(v_role::text, '') not in ('administrador', 'gestor', 'recepcao', 'comercial')
     or not exists (
       select 1 from public.patients
       where id = p_patient_id and organization_id = v_org
     ) then
    return;
  end if;

  v_funnel := v_role in ('administrador', 'gestor', 'comercial');
  v_agenda := v_role in ('administrador', 'gestor', 'recepcao');

  return query
  with deal_ids as (
    select d.id from public.deals d
    where d.patient_id = p_patient_id and d.organization_id = v_org
  ),
  deal_log as (
    select
      a.created_at,
      a.action,
      a.actor_id,
      a.metadata,
      lag(a.metadata ->> 'funnel_stage') over (partition by a.entity_id order by a.created_at) as prev_stage
    from public.activities a
    where a.organization_id = v_org
      and a.entity_type = 'deals'
      and a.entity_id in (select id from deal_ids)
      and a.action in ('deal.created', 'deal.updated')
  ),
  events as (
    select p.created_at as at, 'patient.created' as kind,
      (select a.actor_id from public.activities a
       where a.entity_type = 'patients' and a.entity_id = p.id and a.action = 'patient.created'
       order by a.created_at limit 1) as actor_id,
      '{}'::jsonb as details
    from public.patients p
    where p.id = p_patient_id

    union all
    -- Entrada no funil e cada mudança de fase (deal.updated é registado
    -- em qualquer edição do negócio; fica só quando a fase muda).
    select l.created_at, 'deal.stage', l.actor_id,
      jsonb_build_object(
        'funnel_stage', l.metadata ->> 'funnel_stage',
        'created', l.action = 'deal.created'
      )
    from deal_log l
    where v_funnel
      and (l.action = 'deal.created' or l.metadata ->> 'funnel_stage' is distinct from l.prev_stage)

    union all
    select a.created_at, a.action, a.actor_id,
      jsonb_build_object('channel', a.metadata ->> 'channel', 'count', a.metadata -> 'count')
    from public.activities a
    where a.organization_id = v_org
      and a.entity_type = 'deals'
      and a.entity_id in (select id from deal_ids)
      and a.action in ('deal.weekend_followup', 'deal.weekend_followup_stopped')

    union all
    select ap.created_at, 'appointment',
      (select a.actor_id from public.activities a
       where a.entity_type = 'appointments' and a.entity_id = ap.id and a.action = 'appointment.created'
       order by a.created_at limit 1),
      jsonb_build_object(
        'scheduled_at', ap.scheduled_at,
        'status', ap.status,
        'professional', u.full_name
      )
    from public.appointments ap
    left join public.users u on u.id = ap.professional_id
    where v_agenda and ap.patient_id = p_patient_id and ap.organization_id = v_org

    union all
    select ap.reminder_sent_at, 'appointment.reminder', null::uuid,
      jsonb_build_object('scheduled_at', ap.scheduled_at, 'channel', ap.reminder_channel)
    from public.appointments ap
    where v_agenda and ap.patient_id = p_patient_id and ap.organization_id = v_org
      and ap.reminder_sent_at is not null

    union all
    select t.created_at, 'task.created',
      (select a.actor_id from public.activities a
       where a.entity_type = 'tasks' and a.entity_id = t.id and a.action = 'task.created'
       order by a.created_at limit 1),
      jsonb_build_object('title', t.title, 'status', t.status)
    from public.tasks t
    where t.patient_id = p_patient_id and t.organization_id = v_org

    union all
    select t.completed_at, 'task.completed', null::uuid,
      jsonb_build_object('title', t.title)
    from public.tasks t
    where t.patient_id = p_patient_id and t.organization_id = v_org
      and t.status = 'concluida' and t.completed_at is not null
  )
  select e.at, e.kind, u.full_name, e.details
  from events e
  left join public.users u on u.id = e.actor_id
  order by e.at desc
  limit 200;
end;
$$;

comment on function public.patient_history(uuid) is
  'Cronologia do paciente para a ficha (registo, funil, follow-ups, consultas, lembretes, tarefas), filtrada pela organização e pelo perfil de quem consulta.';

revoke execute on function public.patient_history(uuid) from public, anon;
grant execute on function public.patient_history(uuid) to authenticated;
