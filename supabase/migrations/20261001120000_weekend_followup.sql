-- Follow-up semanal de "bom fim de semana" (n8n → CRM → fazer.ai → WhatsApp)
--
-- Às sextas, os negócios em avaliação realizada / orçamento enviado / em
-- negociação parados há 3+ dias (sem mensagem do paciente nem mudança de
-- fase) recebem uma mensagem da assistente, pelo mesmo caminho dos
-- lembretes de consulta (webhook "Generic" do fazer.ai). No máximo uma por
-- semana e três seguidas sem resposta; à 4.ª sexta sem resposta deixa de
-- enviar e cria uma tarefa para a receção decidir (ligar ou dar como perdido).
-- O contador volta a 0 quando o paciente escreve ou o negócio muda de fase.

alter table public.deals
  add column stage_changed_at timestamptz not null default now(),
  add column weekend_followup_last_at timestamptz,
  add column weekend_followup_count integer not null default 0;

-- Sem histórico de fases fiável, a última alteração do negócio é a melhor
-- aproximação de "desde quando está nesta fase".
update public.deals set stage_changed_at = updated_at;

comment on column public.deals.stage_changed_at is
  'Quando o negócio entrou na fase atual (funnel_stage).';
comment on column public.deals.weekend_followup_last_at is
  'Último follow-up de fim de semana (WhatsApp pela assistente ou tarefa para a receção).';
comment on column public.deals.weekend_followup_count is
  'Follow-ups de fim de semana seguidos sem resposta. Volta a 0 quando o paciente escreve ou o negócio muda de fase.';

create or replace function public.deals_track_stage_change()
returns trigger
language plpgsql
as $$
begin
  new.stage_changed_at := now();
  new.weekend_followup_count := 0;
  return new;
end;
$$;

create trigger deals_track_stage_change
before update of funnel_stage on public.deals
for each row
when (old.funnel_stage is distinct from new.funnel_stage)
execute function public.deals_track_stage_change();

-- Registar um follow-up não é editar o negócio: não mexe em updated_at (que
-- create_followup_tasks_stalled_budget usa para "orçamento parado") nem gera
-- um deal.updated na auditoria — o follow-up tem a sua própria activity.
drop trigger deals_set_updated_at on public.deals;
create trigger deals_set_updated_at
before update on public.deals
for each row
when (
  (to_jsonb(old) - array['weekend_followup_last_at', 'weekend_followup_count', 'updated_at'])
  is distinct from
  (to_jsonb(new) - array['weekend_followup_last_at', 'weekend_followup_count', 'updated_at'])
)
execute function public.set_updated_at();

drop trigger deals_log_activity on public.deals;
create trigger deals_log_activity
after insert on public.deals
for each row execute function public.log_deals_activity();

create trigger deals_log_activity_update
after update on public.deals
for each row
when (
  (to_jsonb(old) - array['weekend_followup_last_at', 'weekend_followup_count', 'updated_at'])
  is distinct from
  (to_jsonb(new) - array['weekend_followup_last_at', 'weekend_followup_count', 'updated_at'])
)
execute function public.log_deals_activity();

-- O paciente escreveu => recomeça a contagem dos follow-ups sem resposta.
create or replace function public.messages_reset_weekend_followup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.deals d
  set weekend_followup_count = 0
  from public.conversations c
  where c.id = new.conversation_id
    and d.organization_id = c.organization_id
    and d.patient_id = c.patient_id
    and d.weekend_followup_count > 0;
  return new;
end;
$$;

create trigger messages_reset_weekend_followup
after insert on public.messages
for each row
when (new.direction = 'inbound')
execute function public.messages_reset_weekend_followup();

-- Título das tarefas de decisão (é por ele que se sabe se já foi criada).
create or replace function public.weekend_followup_decision_title(p_patient_name text)
returns text
language sql
immutable
as $$
  select left('Decidir follow-up sem resposta — ' || p_patient_name, 200);
$$;

-- Negócios com follow-up devido hoje (Lisboa). exhausted = já levou 3
-- follow-ups seguidos sem resposta: em vez de enviar, cria-se a tarefa de
-- decisão (uma vez por ciclo).
create or replace function public.deals_due_weekend_followup(p_organization_id uuid)
returns table (
  deal_id uuid,
  patient_id uuid,
  patient_name text,
  patient_phone text,
  funnel_stage public.funnel_stage,
  stage_changed_at timestamptz,
  followup_count integer,
  last_followup_at timestamptz,
  conversation_ref text,
  exhausted boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with today as (select (now() at time zone 'Europe/Lisbon')::date as d)
  select
    dl.id,
    p.id,
    p.full_name,
    p.phone,
    dl.funnel_stage,
    dl.stage_changed_at,
    dl.weekend_followup_count,
    dl.weekend_followup_last_at,
    (
      select c.fazer_conversation_ref from public.conversations c
      where c.organization_id = dl.organization_id
        and c.patient_id = p.id
        and c.fazer_conversation_ref is not null
      order by c.last_message_at desc nulls last
      limit 1
    ),
    dl.weekend_followup_count >= 3
  from public.deals dl
  join public.patients p on p.id = dl.patient_id
  cross join today
  where dl.organization_id = p_organization_id
    and dl.active
    and p.active
    and dl.funnel_stage in ('avaliacao_realizada', 'orcamento_enviado', 'em_negociacao')
    and p.consent_communication
    and nullif(btrim(p.phone), '') is not null
    and (dl.stage_changed_at at time zone 'Europe/Lisbon')::date <= today.d - 3
    and not exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where c.organization_id = dl.organization_id
        and c.patient_id = p.id
        and m.direction = 'inbound'
        and (m.sent_at at time zone 'Europe/Lisbon')::date > today.d - 3
    )
    and (
      dl.weekend_followup_last_at is null
      or (dl.weekend_followup_last_at at time zone 'Europe/Lisbon')::date <= today.d - 7
    )
    and (
      dl.weekend_followup_count < 3
      or not exists (
        select 1 from public.tasks t
        where t.organization_id = dl.organization_id
          and t.deal_id = dl.id
          and t.title = public.weekend_followup_decision_title(p.full_name)
          and t.created_at >= dl.weekend_followup_last_at
      )
    )
  order by dl.stage_changed_at;
$$;

-- Reserva o follow-up de um negócio (com o negócio bloqueado, para duas
-- chamadas em simultâneo não enviarem duas vezes) e devolve o que fazer:
--   'enviar'  => follow-up registado (count + 1); a rota envia/cria a tarefa;
--   'decidir' => 3 sem resposta: tarefa de decisão criada aqui;
--   null      => já não está devido (outra chamada tratou dele).
create or replace function public.claim_weekend_followup(p_organization_id uuid, p_deal_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due record;
begin
  perform 1 from public.deals
  where id = p_deal_id and organization_id = p_organization_id
  for update;

  select * into v_due
  from public.deals_due_weekend_followup(p_organization_id) d
  where d.deal_id = p_deal_id;

  if not found then
    return null;
  end if;

  if v_due.exhausted then
    insert into public.tasks (organization_id, patient_id, deal_id, title, description, due_at)
    values (
      p_organization_id,
      v_due.patient_id,
      p_deal_id,
      public.weekend_followup_decision_title(v_due.patient_name),
      format(
        E'O paciente não respondeu a %s follow-ups de fim de semana seguidos (o último a %s).\n'
        'Telemóvel: %s\nDecidir: ligar ao paciente ou marcar o negócio como "perdido".',
        v_due.followup_count,
        to_char(v_due.last_followup_at at time zone 'Europe/Lisbon', 'DD/MM/YYYY'),
        v_due.patient_phone
      ),
      now()
    );
    perform public.log_activity(
      p_organization_id, 'deal.weekend_followup_stopped', 'deals', p_deal_id,
      jsonb_build_object('patient_id', v_due.patient_id, 'count', v_due.followup_count)
    );
    return 'decidir';
  end if;

  update public.deals
  set weekend_followup_last_at = now(),
      weekend_followup_count = weekend_followup_count + 1
  where id = p_deal_id;

  return 'enviar';
end;
$$;

-- Desfaz a reserva quando o envio falhou (para tentar de novo na próxima
-- chamada), desde que nada a tenha alterado entretanto.
create or replace function public.release_weekend_followup(
  p_organization_id uuid,
  p_deal_id uuid,
  p_previous_last_at timestamptz,
  p_previous_count integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.deals
  set weekend_followup_last_at = p_previous_last_at,
      weekend_followup_count = p_previous_count
  where id = p_deal_id
    and organization_id = p_organization_id
    and weekend_followup_count = p_previous_count + 1;
$$;

-- Fica no histórico do negócio (activities) com o canal usado.
create or replace function public.log_weekend_followup(
  p_organization_id uuid,
  p_deal_id uuid,
  p_channel text
)
returns void
language sql
security definer
set search_path = public
as $$
  select public.log_activity(
    p_organization_id, 'deal.weekend_followup', 'deals', d.id,
    jsonb_build_object(
      'patient_id', d.patient_id,
      'channel', p_channel,
      'count', d.weekend_followup_count,
      'funnel_stage', d.funnel_stage
    )
  )
  from public.deals d
  where d.id = p_deal_id and d.organization_id = p_organization_id;
$$;

revoke execute on function public.deals_due_weekend_followup(uuid) from public, anon, authenticated;
revoke execute on function public.claim_weekend_followup(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.release_weekend_followup(uuid, uuid, timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.log_weekend_followup(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.deals_due_weekend_followup(uuid) to service_role;
grant execute on function public.claim_weekend_followup(uuid, uuid) to service_role;
grant execute on function public.release_weekend_followup(uuid, uuid, timestamptz, integer) to service_role;
grant execute on function public.log_weekend_followup(uuid, uuid, text) to service_role;
