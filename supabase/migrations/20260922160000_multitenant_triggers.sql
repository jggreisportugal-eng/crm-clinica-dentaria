-- Etapa 8.1 (parte 2) — propagação de organization_id nas funções
--
-- Toda função que insere linhas (log_activity e as automações das Fases
-- 2-5) precisa de saber a que organização a linha pertence, agora que
-- organization_id é not null em todo o lado. log_activity() ganha um
-- parâmetro obrigatório novo, o que só por si obriga a recriar (e
-- valida em tempo de criação) todos os pontos de chamada.

create or replace function public.log_activity(
  p_organization_id uuid,
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
  insert into public.activities (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_organization_id, coalesce(p_actor_id, auth.uid()), p_action, p_entity_type, p_entity_id, p_metadata)
  returning id into v_id;

  return v_id;
end;
$$;

-- handle_new_user: organization_id vem de auth metadata (definido pelo
-- admin ao criar o utilizador, mesmo espírito do role), com fallback
-- para a organização default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_org_id uuid;
begin
  v_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    'recepcao'
  );
  v_org_id := coalesce(
    (new.raw_user_meta_data ->> 'organization_id')::uuid,
    '00000000-0000-0000-0000-000000000001'
  );

  insert into public.users (id, email, full_name, role, organization_id)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', v_role, v_org_id);

  perform public.log_activity(
    v_org_id,
    'user.created',
    'users',
    new.id,
    jsonb_build_object('email', new.email, 'role', v_role)
  );

  return new;
end;
$$;

-- log_<table>_activity: mesmo padrão em todas, só acrescenta
-- new.organization_id como primeiro argumento.

create or replace function public.log_companies_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'company.created', 'companies', new.id, jsonb_build_object('name', new.name));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(new.organization_id, 'company.updated', 'companies', new.id, jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

create or replace function public.log_tags_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'tag.created', 'tags', new.id, jsonb_build_object('name', new.name));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(new.organization_id, 'tag.updated', 'tags', new.id, jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

create or replace function public.log_campaigns_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'campaign.created', 'campaigns', new.id, jsonb_build_object('name', new.name));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(new.organization_id, 'campaign.updated', 'campaigns', new.id, jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

create or replace function public.log_patients_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'patient.created', 'patients', new.id, jsonb_build_object('full_name', new.full_name));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(new.organization_id, 'patient.updated', 'patients', new.id, jsonb_build_object('full_name', new.full_name));
  end if;
  return new;
end;
$$;

create or replace function public.log_leads_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'lead.created', 'leads', new.id, jsonb_build_object('patient_id', new.patient_id, 'source', new.source));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(new.organization_id, 'lead.updated', 'leads', new.id, jsonb_build_object('patient_id', new.patient_id, 'status', new.status));
  end if;
  return new;
end;
$$;

create or replace function public.log_pipelines_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'pipeline.created', 'pipelines', new.id, jsonb_build_object('name', new.name));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(new.organization_id, 'pipeline.updated', 'pipelines', new.id, jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

create or replace function public.log_deals_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'deal.created', 'deals', new.id, jsonb_build_object('patient_id', new.patient_id, 'funnel_stage', new.funnel_stage));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(new.organization_id, 'deal.updated', 'deals', new.id, jsonb_build_object('patient_id', new.patient_id, 'funnel_stage', new.funnel_stage));
  end if;
  return new;
end;
$$;

create or replace function public.log_tasks_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'task.created', 'tasks', new.id, jsonb_build_object('title', new.title, 'deal_id', new.deal_id));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(new.organization_id, 'task.updated', 'tasks', new.id, jsonb_build_object('title', new.title, 'status', new.status));
  end if;
  return new;
end;
$$;

create or replace function public.log_conversations_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'conversation.created', 'conversations', new.id, jsonb_build_object('patient_id', new.patient_id, 'crm_id', new.crm_id));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(new.organization_id, 'conversation.updated', 'conversations', new.id, jsonb_build_object('patient_id', new.patient_id, 'status', new.status));
  end if;
  return new;
end;
$$;

create or replace function public.log_messages_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_activity(new.organization_id, 'message.created', 'messages', new.id, jsonb_build_object('conversation_id', new.conversation_id, 'direction', new.direction));
  return new;
end;
$$;

create or replace function public.log_appointments_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'appointment.created', 'appointments', new.id, jsonb_build_object('patient_id', new.patient_id, 'status', new.status, 'scheduled_at', new.scheduled_at));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(new.organization_id, 'appointment.updated', 'appointments', new.id, jsonb_build_object('patient_id', new.patient_id, 'status', new.status));
  end if;
  return new;
end;
$$;

create or replace function public.log_treatments_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'treatment.created', 'treatments', new.id, jsonb_build_object('patient_id', new.patient_id, 'treatment_type', new.treatment_type));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity(new.organization_id, 'treatment.updated', 'treatments', new.id, jsonb_build_object('patient_id', new.patient_id, 'status', new.status));
  end if;
  return new;
end;
$$;

-- create_confirmation_task (Etapa 4.3): a tarefa herda a organização da
-- consulta que a originou.
create or replace function public.create_confirmation_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'marcada' then
    insert into public.tasks (organization_id, patient_id, appointment_id, title, description, due_at, status)
    values (
      new.organization_id,
      new.patient_id,
      new.id,
      'Confirmar consulta',
      format('Confirmar a consulta agendada para %s.', to_char(new.scheduled_at, 'DD/MM/YYYY HH24:MI')),
      greatest(now(), new.scheduled_at - interval '1 day'),
      'pendente'
    );
  end if;
  return new;
end;
$$;

-- advance_deal_on_appointment_done (Etapa 4.4): só procura o deal
-- dentro da mesma organização, e a tarefa criada herda a organização
-- da consulta.
create or replace function public.advance_deal_on_appointment_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deal record;
begin
  if new.status = 'realizada' and old.status is distinct from 'realizada' then
    select *
    into v_deal
    from public.deals
    where patient_id = new.patient_id
      and organization_id = new.organization_id
      and active
      and funnel_stage not in ('concluido', 'perdido')
    order by created_at desc
    limit 1;

    if found then
      if v_deal.funnel_stage = 'avaliacao_marcada' then
        update public.deals
        set funnel_stage = 'avaliacao_realizada'
        where id = v_deal.id;
      end if;

      insert into public.tasks (organization_id, patient_id, deal_id, appointment_id, title, description, due_at, status)
      values (
        new.organization_id,
        new.patient_id,
        v_deal.id,
        new.id,
        'Acompanhamento pós-consulta',
        'Consulta realizada — fazer o acompanhamento comercial (orçamento/próximos passos).',
        now() + interval '1 day',
        'pendente'
      );
    end if;
  end if;

  return new;
end;
$$;

-- advance_deal_on_treatment_started (Etapa 5.3): só atualiza o deal se
-- for da mesma organização do tratamento (defesa extra; o deal_id já é
-- específico, mas não custa).
create or replace function public.advance_deal_on_treatment_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'em_andamento'
     and old.status is distinct from 'em_andamento'
     and new.deal_id is not null
  then
    update public.deals
    set funnel_stage = 'tratamento_iniciado'
    where id = new.deal_id
      and organization_id = new.organization_id
      and funnel_stage not in ('tratamento_iniciado', 'concluido', 'perdido');
  end if;

  return new;
end;
$$;

-- Rotinas de follow-up automático (Etapa 2.5): a tarefa criada herda a
-- organização do lead/deal que a originou.
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
    select l.id, l.patient_id, l.organization_id
    from public.leads l
    where l.status in ('novo', 'contactado')
      and l.active
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
    select d.id, d.patient_id, d.organization_id
    from public.deals d
    where d.funnel_stage = 'orcamento_enviado'
      and d.active
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
