-- Etapa 1.5 — Schema tags
--
-- Etiquetas de segmentação, reutilizáveis por patients/leads/deals (essas
-- tabelas ainda não existem — a associação a cada entidade é adicionada
-- quando essa entidade for criada nas etapas seguintes).

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tags is
  'Etiquetas de segmentação reutilizáveis. Sem delete via API — usar active=false (soft delete) para preservar referências existentes.';

create trigger tags_set_updated_at
before update on public.tags
for each row execute function public.set_updated_at();

-- Auditoria (reutiliza log_activity() da Etapa 1.3) -------------------------

create or replace function public.log_tags_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('tag.created', 'tags', new.id, jsonb_build_object('name', new.name));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity('tag.updated', 'tags', new.id, jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

create trigger tags_log_activity
after insert or update on public.tags
for each row execute function public.log_tags_activity();

-- RLS -------------------------------------------------------------------------
--
-- Leitura: todos os perfis autenticados (etiquetas são metadados de baixo
-- risco, úteis em qualquer ecrã que liste patients/leads/deals).
-- Escrita: perfis que gerem esses registos (exclui Profissional, que só
-- opera a sua agenda, não a taxonomia do CRM). Sem delete: soft delete.

alter table public.tags enable row level security;

create policy "tags_select"
on public.tags
for select
to authenticated
using (true);

create policy "tags_insert"
on public.tags
for insert
to authenticated
with check (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao'));

create policy "tags_update"
on public.tags
for update
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao'))
with check (public.current_user_role() in ('administrador', 'gestor', 'comercial', 'recepcao'));
