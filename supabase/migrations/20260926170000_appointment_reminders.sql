-- Lembretes de consulta (n8n → CRM → fazer.ai → WhatsApp)
--
-- O lembrete é entregue pela própria assistente (fazer.ai, integração
-- "Generic webhook"): o CRM envia {event_id, conversation_ref, text} e o
-- agente escreve-o na conversa — fica no histórico dele e sabe tratar a
-- resposta. conversation_ref é criado pelo fazer.ai quando uma ferramenta do
-- CRM é usada numa conversa; o CRM guarda-o em conversations. Paciente sem
-- conversa com a assistente => tarefa para a receção telefonar.
--
-- Também corrige o fuso horário: current_date/to_char corriam em UTC, por
-- isso "amanhã" e a hora escrita na tarefa de confirmação vinham desviados
-- da hora de Lisboa.

alter table public.conversations add column fazer_conversation_ref text;

alter table public.appointments
  add column reminder_sent_at timestamptz,
  add column reminder_channel text;

comment on column public.appointments.reminder_channel is
  'Como o lembrete foi feito: whatsapp (pela assistente) ou tarefa (receção telefona).';

-- Destino dos eventos para a assistente de cada organização. O segredo HMAC
-- fica em claro porque é preciso para assinar; só service_role.
create table public.agent_webhooks (
  organization_id uuid primary key references public.organizations (id),
  inbound_url text not null,
  secret text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.agent_webhooks is
  'Webhook "Generic" do fazer.ai de cada organização (lembretes). Só service_role.';

alter table public.agent_webhooks enable row level security;

revoke all on public.agent_webhooks from anon, authenticated;
grant select, insert, update, delete on public.agent_webhooks to service_role;

-- Consultas de amanhã (Lisboa) ainda sem lembrete, com o conversation_ref
-- mais recente do paciente.
create or replace function public.appointments_due_reminder(p_organization_id uuid)
returns table (
  appointment_id uuid,
  patient_id uuid,
  patient_name text,
  patient_phone text,
  scheduled_at timestamptz,
  professional_name text,
  conversation_ref text
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
    (
      select c.fazer_conversation_ref from public.conversations c
      where c.organization_id = a.organization_id
        and c.patient_id = p.id
        and c.fazer_conversation_ref is not null
      order by c.last_message_at desc nulls last
      limit 1
    )
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  left join public.users u on u.id = a.professional_id
  where a.organization_id = p_organization_id
    and a.status in ('marcada', 'confirmada')
    and a.reminder_sent_at is null
    and (a.scheduled_at at time zone 'Europe/Lisbon')::date
        = (now() at time zone 'Europe/Lisbon')::date + 1
  order by a.scheduled_at;
$$;

revoke execute on function public.appointments_due_reminder(uuid) from public, anon, authenticated;
grant execute on function public.appointments_due_reminder(uuid) to service_role;

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
  select a.id, p.id, p.full_name, p.phone, a.scheduled_at, u.full_name, a.status
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  left join public.users u on u.id = a.professional_id
  where a.organization_id = p_organization_id
    and (a.scheduled_at at time zone 'Europe/Lisbon')::date
        = (now() at time zone 'Europe/Lisbon')::date + 1
    and a.status in ('marcada', 'confirmada')
  order by a.scheduled_at;
$$;

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
      format('Confirmar a consulta agendada para %s.',
        to_char(new.scheduled_at at time zone 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI')),
      greatest(now(), new.scheduled_at - interval '1 day'),
      'pendente'
    );
  end if;
  return new;
end;
$$;
