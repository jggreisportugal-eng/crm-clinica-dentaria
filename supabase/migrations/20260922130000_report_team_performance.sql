-- Etapa 7.3 — Relatório: desempenho por profissional/equipa
--
-- Deals fechados e consultas realizadas por utilizador responsável,
-- acessível só a Administrador e Gestor.
--
-- Não dá para usar uma view com security_invoker=true aqui como nas
-- Etapas 7.1/7.2: a RLS de public.users (Etapa 1.2) só deixa
-- administrador ver todas as linhas — um Gestor veria apenas a própria
-- via RLS normal, o que quebraria o relatório de equipa para ele. Por
-- isso é uma função security definer com o gate de perfil explícito por
-- dentro (current_user_role() not in ('administrador','gestor') ->
-- devolve zero linhas), em vez de alargar a RLS de users.

create or replace function public.get_team_performance()
returns table (
  user_id uuid,
  full_name text,
  role public.user_role,
  deals_closed bigint,
  appointments_done bigint
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
    u.id,
    u.full_name,
    u.role,
    coalesce(d.deals_closed, 0),
    coalesce(a.appointments_done, 0)
  from public.users u
  left join (
    select responsible_user_id, count(*) as deals_closed
    from public.deals
    where funnel_stage = 'concluido' and responsible_user_id is not null
    group by responsible_user_id
  ) d on d.responsible_user_id = u.id
  left join (
    select professional_id, count(*) as appointments_done
    from public.appointments
    where status = 'realizada' and professional_id is not null
    group by professional_id
  ) a on a.professional_id = u.id
  where u.active
  order by u.full_name;
end;
$$;

comment on function public.get_team_performance is
  'Desempenho por utilizador (deals fechados, consultas realizadas). Devolve zero linhas para quem não é administrador/gestor — gate de perfil explícito, não depende da RLS de users.';

revoke execute on function public.get_team_performance() from public;
grant execute on function public.get_team_performance() to authenticated;
