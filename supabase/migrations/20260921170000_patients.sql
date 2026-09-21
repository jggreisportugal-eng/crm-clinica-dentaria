-- Etapa 1.7 — Schema patients
--
-- Tabela central de pacientes, com os grupos de campos do documento:
-- Identificação, Comercial, Agenda (preenchida na Fase 4), Tratamento
-- (preenchido na Fase 5), Comunicação (preenchida na Fase 3) e
-- Consentimentos (obrigatórios desde já, por RGPD).

-- Etapas do funil comercial (Etapa 2.1) — criado já aqui porque o campo
-- "etapa do funil" faz parte da ficha do paciente; reutilizado por
-- public.deals quando a Fase 2 for implementada.
create type public.funnel_stage as enum (
  'novo_lead',
  'contactado',
  'avaliacao_marcada',
  'avaliacao_realizada',
  'orcamento_enviado',
  'em_negociacao',
  'tratamento_iniciado',
  'concluido',
  'perdido'
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),

  -- Identificação
  full_name text not null,
  phone text,
  email text,
  birth_date date,
  preferred_contact_channel text,

  -- Comercial
  company_id uuid references public.companies (id),
  campaign_id uuid references public.campaigns (id),
  source text,
  responsible_user_id uuid references public.users (id),
  interest text,
  estimated_value numeric(12, 2),
  funnel_stage public.funnel_stage not null default 'novo_lead',

  -- Agenda (preenchido a partir da Fase 4)
  next_appointment_at timestamptz,
  last_appointment_at timestamptz,
  appointment_confirmation_status text,

  -- Tratamento (referência simples; ligação plena em treatments na Fase 5)
  treatment_interest text,

  -- Comunicação (preenchido a partir da Fase 3)
  last_interaction_at timestamptz,
  last_interaction_channel text,
  chatwoot_conversation_link text,

  -- Consentimentos (RGPD — obrigatório desde a criação do schema)
  consent_marketing boolean not null default false,
  consent_communication boolean not null default false,
  communication_preferences jsonb not null default '{}'::jsonb,
  consent_recorded_at timestamptz,
  data_retention_until date,

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.patients is
  'Pacientes: identificação, dados comerciais, referências de agenda/tratamento/comunicação (preenchidas nas fases correspondentes) e consentimentos RGPD. Sem dados clínicos.';
comment on column public.patients.communication_preferences is
  'Preferências por canal, ex.: {"email": true, "sms": false, "whatsapp": true}.';
comment on column public.patients.data_retention_until is
  'Data-limite de retenção dos dados pessoais (RGPD) — revisão/eliminação a partir desta data.';

create trigger patients_set_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

-- Etiquetas (Etapa 1.5) aplicadas a pacientes ------------------------------

create table public.patient_tags (
  patient_id uuid not null references public.patients (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (patient_id, tag_id)
);

comment on table public.patient_tags is
  'Associação muitos-para-muitos entre patients e tags.';

-- Auditoria (reutiliza log_activity() da Etapa 1.3) -------------------------

create or replace function public.log_patients_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('patient.created', 'patients', new.id, jsonb_build_object('full_name', new.full_name));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity('patient.updated', 'patients', new.id, jsonb_build_object('full_name', new.full_name));
  end if;
  return new;
end;
$$;

create trigger patients_log_activity
after insert or update on public.patients
for each row execute function public.log_patients_activity();

-- RLS -------------------------------------------------------------------------
--
-- Leitura: todos os perfis autenticados (Receção e Profissional precisam
-- de ver a ficha do paciente para a sua operação; Comercial/Gestor para o
-- funil; Administrador tudo).
-- Escrita: administrador/gestor/recepcao/comercial (Profissional não edita
-- a ficha comercial do paciente nesta fase — a Fase 4/Agenda trata do que
-- lhe compete).
-- Sem delete: soft delete via active=false, preserva histórico e FKs.

alter table public.patients enable row level security;

create policy "patients_select"
on public.patients
for select
to authenticated
using (true);

create policy "patients_insert"
on public.patients
for insert
to authenticated
with check (public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial'));

create policy "patients_update"
on public.patients
for update
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial'))
with check (public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial'));

-- patient_tags: mesmo padrão, mas com delete (é uma associação, não um
-- registo de negócio — remover uma etiqueta de um paciente não apaga
-- histórico nem precisa de soft delete).

alter table public.patient_tags enable row level security;

create policy "patient_tags_select"
on public.patient_tags
for select
to authenticated
using (true);

create policy "patient_tags_insert"
on public.patient_tags
for insert
to authenticated
with check (public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial'));

create policy "patient_tags_delete"
on public.patient_tags
for delete
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial'));
