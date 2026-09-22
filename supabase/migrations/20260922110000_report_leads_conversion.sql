-- Etapa 7.1 — Relatório: leads por origem e conversão
--
-- Views agregando leads/campaigns por origem e a taxa de conversão ao
-- longo do funil. `security_invoker = true`: a view corre com os
-- privilégios/RLS de quem a consulta, não do dono — cada perfil só vê,
-- através da view, o que já veria consultando leads/deals diretamente.

create view public.report_leads_by_origin
with (security_invoker = true)
as
select
  coalesce(c.name, l.source, 'Direto') as origin,
  count(*) as total_leads,
  count(*) filter (where l.status = 'convertido') as converted_leads,
  round(
    (count(*) filter (where l.status = 'convertido'))::numeric
    / nullif(count(*), 0) * 100,
    1
  ) as conversion_rate_pct
from public.leads l
left join public.campaigns c on c.id = l.campaign_id
where l.active
group by coalesce(c.name, l.source, 'Direto')
order by total_leads desc;

comment on view public.report_leads_by_origin is
  'Leads agrupados por origem (campanha ou source), com taxa de conversão (status=convertido / total).';

create view public.report_funnel_conversion
with (security_invoker = true)
as
select
  d.funnel_stage,
  count(*) as deals_count,
  coalesce(sum(d.estimated_value), 0) as total_value
from public.deals d
where d.active
group by d.funnel_stage;

comment on view public.report_funnel_conversion is
  'Distribuição de deals ativos por etapa do funil (contagem e valor), para visualizar a conversão ao longo do funil.';

grant select on public.report_leads_by_origin to authenticated;
grant select on public.report_funnel_conversion to authenticated;
