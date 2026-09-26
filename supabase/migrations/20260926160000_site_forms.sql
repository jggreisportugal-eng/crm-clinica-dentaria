-- Formulários de sites/landing pages → CRM
--
-- 1) site_forms: cada formulário público pertence a uma organização. O id
--    (uuid) vai no código do site e é público; o que protege a rota é
--    allowed_origins (CORS + verificação do Origin), o consentimento
--    obrigatório, o honeypot e o limite por IP na API. Só service_role.
--
-- 2) ingest_site_lead(): atómica, com advisory lock por contacto (dois
--    envios seguidos não duplicam o paciente). Procura o paciente pelo
--    telemóvel e depois pelo e-mail; contacto novo => paciente com os
--    consentimentos dados no formulário. Cada envio gera um lead (origem
--    "Site" + UTM, ligado à campanha com o mesmo utm_campaign), um deal
--    "Novo lead" se o paciente não tiver nenhum ativo, e uma tarefa para a
--    receção contactar.

create table public.site_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  allowed_origins text[] not null,
  default_interest text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.site_forms is
  'Formulários públicos (landing pages) por organização. O id é público; allowed_origins limita quem pode enviar. Só service_role.';

create index site_forms_organization_idx on public.site_forms (organization_id);

alter table public.site_forms enable row level security;

revoke all on public.site_forms from anon, authenticated;
grant select, insert, update, delete on public.site_forms to service_role;

create or replace function public.ingest_site_lead(
  p_organization_id uuid,
  p_form_name text,
  p_name text,
  p_email text,
  p_phone text,
  p_message text,
  p_interest text,
  p_consent boolean,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_landing_page text default null,
  p_referrer text default null,
  p_raw jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_lead_id uuid;
  v_deal_id uuid;
  v_campaign_id uuid;
  v_created boolean := false;
  v_prefs jsonb := jsonb_build_object('whatsapp', true, 'telefone', true, 'email', true);
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':' || coalesce(p_phone, p_email), 0)
  );

  if p_utm_campaign is not null then
    select id into v_campaign_id from public.campaigns
    where organization_id = p_organization_id
      and active
      and lower(utm_campaign) = lower(p_utm_campaign)
    limit 1;
  end if;

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

  if v_patient_id is null then
    insert into public.patients (
      organization_id, full_name, phone, email, source, interest, campaign_id,
      preferred_contact_channel, consent_communication, communication_preferences,
      consent_recorded_at
    )
    values (
      p_organization_id, p_name, p_phone, p_email, 'Site', p_interest, v_campaign_id,
      'whatsapp', p_consent,
      case when p_consent then v_prefs else '{}'::jsonb end,
      case when p_consent then now() end
    )
    returning id into v_patient_id;
    v_created := true;
  else
    -- Contacto já conhecido: completa o que faltar, regista o novo
    -- consentimento e nunca apaga dados que a equipa já tenha.
    update public.patients
    set phone = coalesce(phone, p_phone),
        email = coalesce(email, p_email),
        interest = coalesce(interest, p_interest),
        consent_communication = consent_communication or p_consent,
        communication_preferences = case
          when p_consent then communication_preferences || v_prefs
          else communication_preferences end,
        consent_recorded_at = case when p_consent then now() else consent_recorded_at end
    where id = v_patient_id;
  end if;

  insert into public.leads (
    organization_id, patient_id, campaign_id, source, utm_source, utm_medium,
    utm_campaign, utm_content, utm_term, landing_page, referrer, raw_payload
  )
  values (
    p_organization_id, v_patient_id, v_campaign_id, 'Site', p_utm_source, p_utm_medium,
    p_utm_campaign, p_utm_content, p_utm_term, p_landing_page, p_referrer, p_raw
  )
  returning id into v_lead_id;

  select id into v_deal_id from public.deals
  where organization_id = p_organization_id and patient_id = v_patient_id and active
  order by created_at desc limit 1;

  if v_deal_id is null then
    insert into public.deals (organization_id, patient_id, lead_id)
    values (p_organization_id, v_patient_id, v_lead_id)
    returning id into v_deal_id;
  end if;

  insert into public.tasks (organization_id, patient_id, deal_id, title, description, due_at)
  values (
    p_organization_id,
    v_patient_id,
    v_deal_id,
    left('Pedido do site — ' || p_name, 200),
    concat_ws(E'\n',
      'Nome: ' || p_name,
      'Telemóvel: ' || coalesce(p_phone, '—'),
      'E-mail: ' || coalesce(p_email, '—'),
      case when p_interest is not null then 'Interesse: ' || p_interest end,
      case when p_message is not null then 'Mensagem: ' || p_message end,
      'Formulário: ' || p_form_name,
      case when p_utm_campaign is not null then 'Campanha: ' || p_utm_campaign end,
      case when v_created then 'Contacto novo.' else 'Contacto já existente no CRM.' end,
      'Contactar para marcar a consulta.'
    ),
    now() + interval '2 hours'
  );

  return jsonb_build_object('patient_id', v_patient_id, 'lead_id', v_lead_id, 'created_patient', v_created);
end;
$$;

revoke execute on function public.ingest_site_lead(
  uuid, text, text, text, text, text, text, boolean, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.ingest_site_lead(
  uuid, text, text, text, text, text, text, boolean, text, text, text, text, text, text, text, jsonb
) to service_role;
