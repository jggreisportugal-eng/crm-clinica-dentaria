-- Etapa 5.1 — Schema treatments
--
-- Acompanhamento COMERCIAL de tratamentos: tipo, profissional responsável,
-- plano (descrição comercial), orçamento e status. Nunca dados clínicos
-- (histórico clínico, diagnósticos, notas médicas ficam fora do CRM, por
-- definição do documento) — a tabela abaixo contém deliberadamente só os
-- campos que o documento lista, nada mais.

create type public.treatment_status as enum (
  'proposto',
  'aceite',
  'em_andamento',
  'concluido',
  'cancelado'
);

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  deal_id uuid references public.deals (id),
  professional_id uuid references public.users (id),

  treatment_type text not null,
  treatment_plan text,
  budget numeric(12, 2),
  status public.treatment_status not null default 'proposto',

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.treatments is
  'Acompanhamento comercial de tratamentos (tipo, plano, orçamento, status). NUNCA dados clínicos detalhados — histórico clínico, diagnósticos e notas médicas ficam fora do CRM por definição do documento. Sem delete via API — usar active=false.';
comment on column public.treatments.treatment_plan is
  'Descrição comercial do plano (ex.: "3 sessões de implante + coroa"), não um plano de tratamento clínico.';

create index treatments_patient_idx on public.treatments (patient_id);
create index treatments_deal_idx on public.treatments (deal_id);
create index treatments_professional_idx on public.treatments (professional_id);

create trigger treatments_set_updated_at
before update on public.treatments
for each row execute function public.set_updated_at();

-- Auditoria (reutiliza log_activity() da Etapa 1.3) -------------------------

create or replace function public.log_treatments_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('treatment.created', 'treatments', new.id, jsonb_build_object('patient_id', new.patient_id, 'treatment_type', new.treatment_type));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity('treatment.updated', 'treatments', new.id, jsonb_build_object('patient_id', new.patient_id, 'status', new.status));
  end if;
  return new;
end;
$$;

create trigger treatments_log_activity
after insert or update on public.treatments
for each row execute function public.log_treatments_activity();

-- RLS -------------------------------------------------------------------------
--
-- Baseline desta etapa (a Etapa 5.3 refina especificamente o acesso do
-- Profissional, restringindo-o aos tratamentos em que é o responsável —
-- aqui fica só o acesso por perfil, amplo).
--
-- Leitura: administrador/gestor/comercial (acompanham o negócio) e
-- profissional (vê os tratamentos, refinado na 5.3). Receção fica de
-- fora — não gere tratamentos.
-- Escrita: administrador/gestor criam e editam o plano/orçamento;
-- profissional só atualiza (ex.: avançar status), nunca cria.
-- Sem delete: soft delete via active=false.

alter table public.treatments enable row level security;

create policy "treatments_select"
on public.treatments
for select
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'profissional'));

create policy "treatments_insert"
on public.treatments
for insert
to authenticated
with check (public.current_user_role() in ('administrador', 'gestor'));

create policy "treatments_update"
on public.treatments
for update
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'profissional'))
with check (public.current_user_role() in ('administrador', 'gestor', 'profissional'));
