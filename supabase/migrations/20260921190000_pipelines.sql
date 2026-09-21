-- Etapa 2.1 — Schema pipelines
--
-- Funis configuráveis (pode existir mais de um pipeline nomeado). As
-- etapas em si são fixas e já foram modeladas como enum na Etapa 1.7
-- (public.funnel_stage, usado por patients.funnel_stage e, a partir da
-- Etapa 2.2, por deals.funnel_stage) — decisão técnica tomada então,
-- conforme o documento permite ("tabela própria de etapas ou enum").

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pipelines is
  'Funis comerciais configuráveis. As etapas de cada pipeline são as do enum public.funnel_stage (fixas, definidas no documento). Sem delete via API — usar active=false.';

-- Garante no máximo um pipeline default.
create unique index pipelines_single_default_idx
on public.pipelines (is_default)
where is_default;

create trigger pipelines_set_updated_at
before update on public.pipelines
for each row execute function public.set_updated_at();

-- Auditoria (reutiliza log_activity() da Etapa 1.3) -------------------------

create or replace function public.log_pipelines_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('pipeline.created', 'pipelines', new.id, jsonb_build_object('name', new.name));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity('pipeline.updated', 'pipelines', new.id, jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

create trigger pipelines_log_activity
after insert or update on public.pipelines
for each row execute function public.log_pipelines_activity();

-- Pipeline padrão (verificação da etapa: "pipeline padrão criado e
-- consultável") -------------------------------------------------------------

insert into public.pipelines (name, description, is_default)
values (
  'Funil Comercial',
  'Novo lead → Contactado → Avaliação marcada → Avaliação realizada → Orçamento enviado → Em negociação → Tratamento iniciado → Concluído/Perdido.',
  true
);

-- RLS -------------------------------------------------------------------------
--
-- Leitura: perfis com acesso ao módulo Funil (mesmo conjunto da Etapa 1.9:
-- administrador/gestor/comercial). Escrita: só administrador/gestor —
-- configurar o funil é responsabilidade de gestão, não do dia-a-dia
-- comercial. Sem delete: soft delete via active=false.

alter table public.pipelines enable row level security;

create policy "pipelines_select"
on public.pipelines
for select
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'comercial'));

create policy "pipelines_insert"
on public.pipelines
for insert
to authenticated
with check (public.current_user_role() in ('administrador', 'gestor'));

create policy "pipelines_update"
on public.pipelines
for update
to authenticated
using (public.current_user_role() in ('administrador', 'gestor'))
with check (public.current_user_role() in ('administrador', 'gestor'));
