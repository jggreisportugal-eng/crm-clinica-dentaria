-- Etapa 1.6 — Schema campaigns
--
-- Campanhas e origem de leads. Necessária já na Fase 1 porque o campo
-- "origem/campanha" faz parte da ficha do paciente/lead (Etapa 1.7/1.8) e,
-- mais adiante (Etapa 6.3), o fluxo N8N associa um lead à campanha certa
-- via UTM.

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  start_date date,
  end_date date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.campaigns is
  'Campanhas de marketing / origem de leads (com dados UTM para associação automática pelo N8N na Etapa 6.3). Sem delete via API — usar active=false.';

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

-- Auditoria (reutiliza log_activity() da Etapa 1.3) -------------------------

create or replace function public.log_campaigns_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('campaign.created', 'campaigns', new.id, jsonb_build_object('name', new.name));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity('campaign.updated', 'campaigns', new.id, jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

create trigger campaigns_log_activity
after insert or update on public.campaigns
for each row execute function public.log_campaigns_activity();

-- RLS -------------------------------------------------------------------------
--
-- Mesmo padrão de companies: leitura para administrador/gestor/comercial/
-- recepcao (esta última vê a origem ao consultar a ficha do paciente),
-- escrita para administrador/gestor/comercial. Profissional sem acesso.
-- Sem delete: soft delete.

alter table public.campaigns enable row level security;

create policy "campaigns_select"
on public.campaigns
for select
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao'));

create policy "campaigns_insert"
on public.campaigns
for insert
to authenticated
with check (public.current_user_role() in ('administrador', 'gestor', 'comercial'));

create policy "campaigns_update"
on public.campaigns
for update
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'comercial'))
with check (public.current_user_role() in ('administrador', 'gestor', 'comercial'));
