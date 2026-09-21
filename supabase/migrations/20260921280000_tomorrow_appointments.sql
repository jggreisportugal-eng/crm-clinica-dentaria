-- Etapa 4.5 — Pontos de integração para lembretes (preparação para N8N)
--
-- Expõe os dados de "consultas de amanhã" para a Fase 6 (N8N) poder
-- consultar e disparar lembretes pelo Chatwoot (Etapa 6.4). O fluxo de
-- automação em si NÃO é implementado aqui — só o ponto de consulta.
--
-- Mesmo padrão de segurança da Etapa 2.5 (função security definer,
-- executável só por service_role): evita expor telefone/nome de
-- pacientes a qualquer papel autenticado via RPC — só o backend/
-- automação com a service_role key pode chamar isto.

create or replace function public.get_tomorrow_appointments()
returns table (
  appointment_id uuid,
  patient_id uuid,
  patient_name text,
  patient_phone text,
  scheduled_at timestamptz,
  professional_name text,
  status public.appointment_status
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    p.id,
    p.full_name,
    p.phone,
    a.scheduled_at,
    u.full_name,
    a.status
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  left join public.users u on u.id = a.professional_id
  where a.scheduled_at >= (current_date + 1)::timestamptz
    and a.scheduled_at < (current_date + 2)::timestamptz
    and a.status in ('marcada', 'confirmada')
  order by a.scheduled_at;
$$;

comment on function public.get_tomorrow_appointments is
  'Consultas marcadas/confirmadas para amanhã (fuso do servidor), com dados de contacto do paciente — consumida pelo N8N na Etapa 6.4 para disparar lembretes via Chatwoot. Chamar via POST /rest/v1/rpc/get_tomorrow_appointments com a service_role key.';

revoke execute on function public.get_tomorrow_appointments() from public, anon, authenticated;
grant execute on function public.get_tomorrow_appointments() to service_role;
