-- Etapa 4.1 — Schema appointments
--
-- Consultas e avaliações, com status (marcada, confirmada, realizada,
-- cancelada, faltou), FK para patients e users (profissional).

create type public.appointment_status as enum (
  'marcada',
  'confirmada',
  'realizada',
  'cancelada',
  'faltou'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  professional_id uuid references public.users (id),
  status public.appointment_status not null default 'marcada',
  scheduled_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.appointments is
  'Consultas/avaliações. Sem coluna active: o ciclo de vida é o próprio status (cancelada/faltou fazem esse papel). Sem delete via API.';

create index appointments_patient_idx on public.appointments (patient_id);
create index appointments_professional_scheduled_idx on public.appointments (professional_id, scheduled_at);
create index appointments_scheduled_idx on public.appointments (scheduled_at);

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

-- Auditoria (reutiliza log_activity() da Etapa 1.3) -------------------------

create or replace function public.log_appointments_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('appointment.created', 'appointments', new.id, jsonb_build_object('patient_id', new.patient_id, 'status', new.status, 'scheduled_at', new.scheduled_at));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity('appointment.updated', 'appointments', new.id, jsonb_build_object('patient_id', new.patient_id, 'status', new.status));
  end if;
  return new;
end;
$$;

create trigger appointments_log_activity
after insert or update on public.appointments
for each row execute function public.log_appointments_activity();

-- RLS -------------------------------------------------------------------------
--
-- Leitura: administrador/gestor/recepcao/profissional (todos os perfis
-- do módulo Agenda, Etapa 1.9). Escrita: administrador/gestor/recepcao
-- — a Receção gere o ciclo de vida da marcação (é quem regista
-- confirmações, faltas, etc.); o Profissional só consulta a sua agenda.
-- Sem delete: soft "delete" é status=cancelada.

alter table public.appointments enable row level security;

create policy "appointments_select"
on public.appointments
for select
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'profissional'));

create policy "appointments_insert"
on public.appointments
for insert
to authenticated
with check (public.current_user_role() in ('administrador', 'gestor', 'recepcao'));

create policy "appointments_update"
on public.appointments
for update
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'recepcao'))
with check (public.current_user_role() in ('administrador', 'gestor', 'recepcao'));
