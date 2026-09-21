-- Etapa 1.4 — Schema companies
--
-- Empresas para atendimento corporativo (pacientes/leads vinculados a uma
-- empresa-cliente, ex.: planos odontológicos corporativos).

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  email text,
  phone text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.companies is
  'Empresas para atendimento corporativo. Sem delete via API — usar active=false (soft delete) para preservar integridade referencial e histórico de auditoria.';

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- Auditoria (reutiliza log_activity() da Etapa 1.3) -------------------------

create or replace function public.log_companies_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('company.created', 'companies', new.id, jsonb_build_object('name', new.name));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity('company.updated', 'companies', new.id, jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

create trigger companies_log_activity
after insert or update on public.companies
for each row execute function public.log_companies_activity();

-- RLS -------------------------------------------------------------------------
--
-- Leitura: perfis que lidam com pacientes/leads corporativos (não inclui
-- Profissional, que não precisa de dados de faturação/empresa-cliente).
-- Escrita: perfis com responsabilidade comercial/gestão.
-- Sem policy de delete: eliminação não é permitida pela API (soft delete).

alter table public.companies enable row level security;

create policy "companies_select"
on public.companies
for select
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao'));

create policy "companies_insert"
on public.companies
for insert
to authenticated
with check (public.current_user_role() in ('administrador', 'gestor', 'comercial'));

create policy "companies_update"
on public.companies
for update
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'comercial'))
with check (public.current_user_role() in ('administrador', 'gestor', 'comercial'));
