-- Etapa 3.1 — Schema conversations
--
-- Referências às conversas do Chatwoot, com FK para patients/leads e o
-- campo crm_id como identificador próprio do CRM (evita duplicidade ao
-- sincronizar com o Chatwoot nas etapas seguintes — 3.3 em diante).
--
-- Nota: esta etapa é só schema. A ligação real ao Chatwoot (webhooks,
-- API) fica pendente até haver uma instância Chatwoot acessível
-- (Etapas 3.3+) — ver memória do projeto.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  lead_id uuid references public.leads (id),

  crm_id text not null unique default gen_random_uuid()::text,
  chatwoot_conversation_id text,
  chatwoot_contact_id text,

  channel text,
  status text,
  last_message_at timestamptz,

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.conversations is
  'Referências às conversas do Chatwoot. crm_id é o identificador gerado pelo CRM (enviado ao Chatwoot como atributo do contacto/conversa) para deduplicação na sincronização — ver Etapa 3.3. Sem delete via API — usar active=false.';
comment on column public.conversations.crm_id is
  'Identificador próprio do CRM, gerado na criação, usado para casar com o Chatwoot e evitar conversas duplicadas.';
comment on column public.conversations.chatwoot_conversation_id is
  'ID da conversa no Chatwoot — populado quando a sincronização (Etapa 3.3) associar as duas pontas.';

create unique index conversations_chatwoot_conversation_id_idx
on public.conversations (chatwoot_conversation_id)
where chatwoot_conversation_id is not null;

create index conversations_patient_idx on public.conversations (patient_id);

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

-- Auditoria (reutiliza log_activity() da Etapa 1.3) -------------------------

create or replace function public.log_conversations_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('conversation.created', 'conversations', new.id, jsonb_build_object('patient_id', new.patient_id, 'crm_id', new.crm_id));
  elsif tg_op = 'UPDATE' then
    perform public.log_activity('conversation.updated', 'conversations', new.id, jsonb_build_object('patient_id', new.patient_id, 'status', new.status));
  end if;
  return new;
end;
$$;

create trigger conversations_log_activity
after insert or update on public.conversations
for each row execute function public.log_conversations_activity();

-- RLS -------------------------------------------------------------------------
--
-- Mesmo conjunto de perfis que lida com comunicação/pacientes: administrador/
-- gestor/recepcao/comercial. Profissional fica de fora (não faz
-- atendimento via Chatwoot). Sem delete: soft delete via active=false.

alter table public.conversations enable row level security;

create policy "conversations_select"
on public.conversations
for select
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial'));

create policy "conversations_insert"
on public.conversations
for insert
to authenticated
with check (public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial'));

create policy "conversations_update"
on public.conversations
for update
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial'))
with check (public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial'));
