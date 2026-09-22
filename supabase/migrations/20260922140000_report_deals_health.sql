-- Etapa 7.4 — Relatório: motivos de perda e oportunidades paradas
--
-- Deals em "Perdido" (com motivo, se capturado) e deals parados há X dias
-- numa etapa. Mesmo padrão da Etapa 7.3 (função security definer com gate
-- de perfil explícito) em vez de view com security_invoker=true: esta
-- consulta também faz LEFT JOIN a public.users para o nome do
-- responsável, e a RLS de users só deixa administrador ver todas as
-- linhas — um gestor veria "responsible_name" nulo para deals de outros
-- responsáveis se dependêssemos da RLS normal.

alter table public.deals
  add column lost_reason text;

comment on column public.deals.lost_reason is
  'Motivo da perda, capturado quando o deal é movido para a etapa perdido (opcional — daí "se capturado" no documento).';

create or replace function public.get_deals_health(p_stalled_days integer default 7)
returns table (
  deal_id uuid,
  patient_name text,
  funnel_stage public.funnel_stage,
  lost_reason text,
  estimated_value numeric,
  responsible_name text,
  days_since_update integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if public.current_user_role() not in ('administrador', 'gestor') then
    return;
  end if;

  return query
  select
    d.id,
    p.full_name,
    d.funnel_stage,
    d.lost_reason,
    d.estimated_value,
    u.full_name,
    extract(day from now() - d.updated_at)::int
  from public.deals d
  join public.patients p on p.id = d.patient_id
  left join public.users u on u.id = d.responsible_user_id
  where d.active
    and (
      d.funnel_stage = 'perdido'
      or (
        d.funnel_stage not in ('concluido', 'perdido')
        and d.updated_at < now() - (p_stalled_days || ' days')::interval
      )
    )
  order by d.updated_at asc;
end;
$$;

comment on function public.get_deals_health is
  'Deals perdidos (com motivo) e deals parados há mais de p_stalled_days dias numa etapa ativa. Devolve zero linhas para quem não é administrador/gestor.';

revoke execute on function public.get_deals_health(integer) from public;
grant execute on function public.get_deals_health(integer) to authenticated;
