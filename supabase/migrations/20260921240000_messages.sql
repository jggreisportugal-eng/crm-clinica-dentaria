-- Etapa 3.2 — Schema messages
--
-- Metadados/histórico mínimo necessário ao CRM — não é réplica completa
-- do Chatwoot (sem anexos, reações, etc.). Registo imutável: sem update,
-- sem delete (log de conversa).

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  chatwoot_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_label text,
  content text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.messages is
  'Metadados/histórico mínimo de mensagens por conversa, o necessário ao CRM (não é réplica completa do Chatwoot). Imutável: sem update/delete via API.';
comment on column public.messages.sender_label is
  'Identificação legível de quem enviou (nome do contacto ou do agente), não um FK — o remetente pode não ser um utilizador do CRM.';

create index messages_conversation_idx on public.messages (conversation_id, sent_at);
create unique index messages_chatwoot_message_id_idx
on public.messages (chatwoot_message_id)
where chatwoot_message_id is not null;

-- Auditoria (reutiliza log_activity() da Etapa 1.3) -------------------------

create or replace function public.log_messages_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_activity('message.created', 'messages', new.id, jsonb_build_object('conversation_id', new.conversation_id, 'direction', new.direction));
  return new;
end;
$$;

create trigger messages_log_activity
after insert on public.messages
for each row execute function public.log_messages_activity();

-- RLS -------------------------------------------------------------------------
--
-- Mesmo conjunto de perfis de conversations: administrador/gestor/
-- recepcao/comercial. Só select + insert (log imutável — sem update,
-- sem delete via API).

alter table public.messages enable row level security;

create policy "messages_select"
on public.messages
for select
to authenticated
using (public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial'));

create policy "messages_insert"
on public.messages
for insert
to authenticated
with check (public.current_user_role() in ('administrador', 'gestor', 'recepcao', 'comercial'));
