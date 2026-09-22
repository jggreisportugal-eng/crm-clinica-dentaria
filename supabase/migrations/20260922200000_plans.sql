-- Etapa 8.3 — Gestão de planos e cobrança
--
-- Estrutura mínima de planos + associação organização-plano, sem
-- inventar além do que o documento pede ("planos, cobrança") — sem
-- checkout, faturas ou integração de pagamento, que o documento não
-- menciona.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null default 0,
  billing_interval text not null default 'mensal' check (billing_interval in ('mensal', 'anual')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plans is
  'Catálogo de planos disponíveis na plataforma. Geral (não por organização) — cada organização associa-se a um destes via organizations.plan_id.';

create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

-- Associação organização-plano ------------------------------------------------

alter table public.organizations
  add column plan_id uuid references public.plans (id),
  add column subscribed_at timestamptz;

comment on column public.organizations.plan_id is
  'Plano ativo da organização. Gerido a nível de plataforma (service_role) — não é self-service pelo perfil administrador da clínica nesta fase.';

-- RLS: catálogo de leitura pública (para qualquer ecrã que precise de
-- mostrar "o seu plano"); sem insert/update/delete — gerido fora da
-- aplicação, não há um perfil "super-admin da plataforma" nesta fase.

alter table public.plans enable row level security;

create policy "plans_select"
on public.plans
for select
to authenticated
using (true);

-- Seed dos planos + associação da organização default (satisfaz a
-- verificação da etapa: "organização de teste associada a um plano
-- corretamente").

insert into public.plans (name, price, billing_interval) values
  ('Básico', 49.00, 'mensal'),
  ('Pro', 99.00, 'mensal'),
  ('Enterprise', 249.00, 'mensal');

update public.organizations
set plan_id = (select id from public.plans where name = 'Básico'),
    subscribed_at = now()
where id = '00000000-0000-0000-0000-000000000001';
