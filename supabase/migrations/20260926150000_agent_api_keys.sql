-- API do agente (fazer.ai → CRM)
--
-- Cada organização gera as suas chaves no ecrã Configuração. Só o hash
-- SHA-256 fica guardado (a chave em claro é mostrada uma vez ao gerar);
-- key_prefix serve só para o administrador reconhecer a chave na lista.
-- A API /api/agent/* descobre a organização pela chave e identifica o
-- paciente pela conversa do Chatwoot/telefone do contexto do agente — o
-- modelo nunca escolhe de quem são os dados que lê.
--
-- Acesso só por service_role (as rotas da API e as server actions do
-- administrador): RLS ligada sem policies + grants explícitos.

create table public.agent_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

comment on table public.agent_api_keys is
  'Chaves da API do agente (fazer.ai) por organização. Só o hash SHA-256 é guardado. Só service_role.';

create index agent_api_keys_organization_idx on public.agent_api_keys (organization_id);

alter table public.agent_api_keys enable row level security;

revoke all on public.agent_api_keys from anon, authenticated;
grant select, insert, update, delete on public.agent_api_keys to service_role;
