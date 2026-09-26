-- Etapa 3.3 — Recetor de webhooks do Chatwoot
--
-- 1) chatwoot_integrations: liga uma conta do Chatwoot a uma organização do
--    CRM (multi-clínica: cada clínica tem a sua conta/webhook). Guarda o
--    segredo do webhook em claro porque é preciso para recalcular o HMAC
--    (X-Chatwoot-Signature); por isso a tabela só é acessível ao
--    service_role — RLS ligada sem policies + grants explícitos.
--
-- 2) chatwoot_ingest(): processa um evento (conversa e/ou mensagem) de forma
--    atómica. Um advisory lock por contacto evita que duas mensagens
--    seguidas de um contacto novo criem o paciente duas vezes (os webhooks
--    chegam em paralelo). Contacto novo => paciente + lead (origem) + deal
--    na etapa "Novo lead". Contacto conhecido (mesmo telemóvel/e-mail ou
--    mesmo contacto Chatwoot) => só liga a conversa ao paciente existente.
--    Consentimentos RGPD ficam a false: iniciar uma conversa não é
--    consentimento de marketing.

create table public.chatwoot_integrations (
  organization_id uuid primary key references public.organizations (id),
  chatwoot_account_id integer not null unique,
  chatwoot_base_url text not null,
  webhook_secret text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.chatwoot_integrations is
  'Conta Chatwoot de cada organização + segredo do webhook (HMAC). Só service_role.';

create trigger chatwoot_integrations_set_updated_at
before update on public.chatwoot_integrations
for each row execute function public.set_updated_at();

alter table public.chatwoot_integrations enable row level security;

revoke all on public.chatwoot_integrations from anon, authenticated;
grant select, insert, update, delete on public.chatwoot_integrations to service_role;

create or replace function public.chatwoot_ingest(
  p_organization_id uuid,
  p_chatwoot_conversation_id text,
  p_chatwoot_contact_id text,
  p_contact_name text,
  p_phone text,
  p_email text,
  p_channel text,
  p_conversation_status text,
  p_conversation_link text,
  p_message_id text default null,
  p_direction text default null,
  p_sender_label text default null,
  p_content text default null,
  p_sent_at timestamptz default null,
  p_raw jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_patient_id uuid;
  v_lead_id uuid;
  v_created_patient boolean := false;
  v_at timestamptz := coalesce(p_sent_at, now());
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':' ||
      coalesce(p_chatwoot_contact_id, p_phone, p_email, p_chatwoot_conversation_id),
      0
    )
  );

  select id, patient_id into v_conversation_id, v_patient_id
  from public.conversations
  where organization_id = p_organization_id
    and chatwoot_conversation_id = p_chatwoot_conversation_id;

  if v_conversation_id is null then
    if p_phone is not null then
      select id into v_patient_id from public.patients
      where organization_id = p_organization_id and phone = p_phone and active
      order by created_at limit 1;
    end if;

    if v_patient_id is null and p_email is not null then
      select id into v_patient_id from public.patients
      where organization_id = p_organization_id and email = p_email and active
      order by created_at limit 1;
    end if;

    if v_patient_id is null and p_chatwoot_contact_id is not null then
      select patient_id into v_patient_id from public.conversations
      where organization_id = p_organization_id
        and chatwoot_contact_id = p_chatwoot_contact_id
      order by created_at limit 1;
    end if;

    if v_patient_id is null then
      insert into public.patients (
        organization_id, full_name, phone, email, source, preferred_contact_channel
      )
      values (
        p_organization_id,
        coalesce(nullif(trim(p_contact_name), ''), p_phone, p_email, 'Contacto Chatwoot'),
        p_phone,
        p_email,
        'Chatwoot',
        p_channel
      )
      returning id into v_patient_id;

      insert into public.leads (organization_id, patient_id, source, raw_payload)
      values (p_organization_id, v_patient_id, coalesce(p_channel, 'chatwoot'), p_raw)
      returning id into v_lead_id;

      insert into public.deals (organization_id, patient_id, lead_id)
      values (p_organization_id, v_patient_id, v_lead_id);

      v_created_patient := true;
    end if;

    insert into public.conversations (
      organization_id, patient_id, lead_id, chatwoot_conversation_id,
      chatwoot_contact_id, channel, status, last_message_at
    )
    values (
      p_organization_id, v_patient_id, v_lead_id, p_chatwoot_conversation_id,
      p_chatwoot_contact_id, p_channel, p_conversation_status, v_at
    )
    returning id into v_conversation_id;
  else
    update public.conversations
    set status = coalesce(p_conversation_status, status),
        channel = coalesce(channel, p_channel),
        last_message_at = greatest(last_message_at, v_at)
    where id = v_conversation_id;
  end if;

  if p_message_id is not null then
    insert into public.messages (
      organization_id, conversation_id, chatwoot_message_id, direction,
      sender_label, content, sent_at
    )
    values (
      p_organization_id, v_conversation_id, p_message_id, p_direction,
      p_sender_label, p_content, v_at
    )
    on conflict (chatwoot_message_id) where chatwoot_message_id is not null
    do nothing;
  end if;

  update public.patients
  set last_interaction_at = greatest(last_interaction_at, v_at),
      last_interaction_channel = coalesce(p_channel, last_interaction_channel),
      chatwoot_conversation_link = coalesce(p_conversation_link, chatwoot_conversation_link)
  where id = v_patient_id;

  return jsonb_build_object(
    'patient_id', v_patient_id,
    'conversation_id', v_conversation_id,
    'created_patient', v_created_patient
  );
end;
$$;

revoke execute on function public.chatwoot_ingest(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.chatwoot_ingest(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb
) to service_role;
