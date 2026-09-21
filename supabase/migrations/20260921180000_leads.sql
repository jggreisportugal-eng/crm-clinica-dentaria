-- Etapa 1.8 — Schema leads
--
-- Informação específica de aquisição/origem de cada contacto — distinta de
-- patients (que é o registo canónico da pessoa). Um lead é o evento de
-- entrada (formulário, WhatsApp, campanha) que deu origem (ou se associa)
-- a um paciente.

create type public.lead_status as enum ('novo', 'contactado', 'convertido', 'invalido');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  campaign_id uuid references public.campaigns (id),

  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_page text,
  referrer text,
  raw_payload jsonb not null default '{}'::jsonb,

  status public.lead_status not null default 'novo',
  received_at timestamptz not null default now(),

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.leads is
  'Evento de aquisição/origem de um contacto (dados brutos de UTM/formulário), vinculado ao paciente correspondente. Distinto de patients: um paciente pode ter vários leads ao longo do tempo.';
comment on column public.leads.raw_payload is
  'Dados brutos recebidos na captação (ex.: corpo do formulário/webhook), sem informação clínica.';

create index leads_patient_idx on public.leads (patient_id);
create index leads_campaign_idx on public.leads (campaign_id);

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

-- Auditoria (reutiliza log_activity() da Etapa 1.3) -------------------------

create or replace function public.log_leads_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('lead.created', 'leads', new.id, jsonb_build_object('patient_id', new.patient_id, 'source', new.source));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity('lead.updated', 'leads', new.id, jsonb_build_object('patient_id', new.patient_id, 'status', new.status));
  end if;
  return new;
end;
$$;

create trigger leads_log_activity
after insert or update on public.leads
for each row execute function public.log_leads_activity();

-- RLS -------------------------------------------------------------------------
--
-- Dados puramente comerciais/de aquisição — ao contrário de patients, o
-- Profissional não precisa disto para a sua operação, por isso fica de
-- fora tanto da leitura como da escrita (mesmo padrão de companies/tags/
-- campaigns). Sem delete: soft delete via active=false.

alter table public.leads enable row level security;

create policy "leads_select"
on public.leads
for select
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao'));

create policy "leads_insert"
on public.leads
for insert
to authenticated
with check (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao'));

create policy "leads_update"
on public.leads
for update
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao'))
with check (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao'));
