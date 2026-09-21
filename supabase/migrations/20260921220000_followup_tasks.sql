-- Etapa 2.5 — Alertas de leads sem resposta e rotinas de retorno
--
-- Funções que identificam leads sem resposta e orçamentos parados,
-- criando tarefas automáticas de follow-up. O "retorno após consulta"
-- mencionado no documento depende da Fase 4 (appointments ainda não
-- existe) e fica, como o próprio documento pede, para a Etapa 4.4
-- (onde a consulta muda para "realizada" e já é criada a tarefa de
-- acompanhamento) — não há o que "preparar" aqui sem a tabela.
--
-- Estas funções destinam-se a ser chamadas por um agendador externo
-- (pg_cron, ou o N8N na Etapa 6.5) — por isso o EXECUTE é revogado de
-- PUBLIC/authenticated e concedido só a service_role (menor privilégio:
-- nenhum utilizador comum dispara isto via RPC).

-- tasks.lead_id: a Etapa 2.4 só previa FK para deals/patients, mas para
-- rastrear "já existe uma tarefa de follow-up pendente para este lead"
-- (idempotência — não criar tarefas duplicadas a cada execução) é
-- necessária uma referência direta ao lead.
alter table public.tasks
  add column lead_id uuid references public.leads (id);

create index tasks_lead_idx on public.tasks (lead_id);

-- 1. Leads sem resposta -------------------------------------------------------

create or replace function public.create_followup_tasks_unanswered_leads(p_days integer default 3)
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
    select l.id, l.patient_id
    from public.leads l
    where l.status in ('novo', 'contactado')
      and l.active
      and l.updated_at < now() - (p_days || ' days')::interval
      and not exists (
        select 1 from public.tasks t
        where t.lead_id = l.id and t.status = 'pendente'
      )
  loop
    insert into public.tasks (patient_id, lead_id, title, description, due_at, status)
    values (
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

comment on function public.create_followup_tasks_unanswered_leads is
  'Cria uma tarefa pendente para cada lead novo/contactado sem interação há mais de p_days dias (idempotente: não duplica se já houver tarefa pendente ligada ao lead).';

-- 2. Orçamento enviado sem resposta -------------------------------------------

create or replace function public.create_followup_tasks_stalled_budget(p_days integer default 5)
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
    select d.id, d.patient_id
    from public.deals d
    where d.funnel_stage = 'orcamento_enviado'
      and d.active
      and d.updated_at < now() - (p_days || ' days')::interval
      and not exists (
        select 1 from public.tasks t
        where t.deal_id = d.id and t.status = 'pendente'
      )
  loop
    insert into public.tasks (patient_id, deal_id, title, description, due_at, status)
    values (
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

comment on function public.create_followup_tasks_stalled_budget is
  'Cria uma tarefa pendente para cada deal em orcamento_enviado há mais de p_days dias sem resposta (idempotente).';

-- 3. Entrypoint único para o agendador -----------------------------------------

create or replace function public.run_followup_checks(
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
  v_leads := public.create_followup_tasks_unanswered_leads(p_days_unanswered_lead);
  v_deals := public.create_followup_tasks_stalled_budget(p_days_stalled_budget);

  return jsonb_build_object(
    'unanswered_leads_tasks_created', v_leads,
    'stalled_budget_tasks_created', v_deals
  );
end;
$$;

comment on function public.run_followup_checks is
  'Entrypoint único para o agendador externo (pg_cron ou N8N na Etapa 6.5) disparar todas as rotinas de follow-up automático da Etapa 2.5.';

revoke execute on function public.create_followup_tasks_unanswered_leads(integer) from public, anon, authenticated;
revoke execute on function public.create_followup_tasks_stalled_budget(integer) from public, anon, authenticated;
revoke execute on function public.run_followup_checks(integer, integer) from public, anon, authenticated;

grant execute on function public.create_followup_tasks_unanswered_leads(integer) to service_role;
grant execute on function public.create_followup_tasks_stalled_budget(integer) to service_role;
grant execute on function public.run_followup_checks(integer, integer) to service_role;
