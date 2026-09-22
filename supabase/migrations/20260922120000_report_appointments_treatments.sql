-- Etapa 7.2 — Relatório: consultas, tratamentos e faturação comercial
--
-- Agrega appointments e treatments (valor comercial — orçamento/status,
-- nunca dado clínico). Mesmo padrão de segurança da Etapa 7.1.

create view public.report_appointments_summary
with (security_invoker = true)
as
select
  status,
  count(*) as appointments_count
from public.appointments
group by status;

comment on view public.report_appointments_summary is
  'Contagem de consultas por status (marcada/confirmada/realizada/cancelada/faltou).';

create view public.report_treatments_billing
with (security_invoker = true)
as
select
  status,
  count(*) as treatments_count,
  coalesce(sum(budget), 0) as total_budget
from public.treatments
where active
group by status;

comment on view public.report_treatments_billing is
  'Faturação comercial: tratamentos agrupados por status, contagem e soma do orçamento (budget) — nunca dado clínico.';

grant select on public.report_appointments_summary to authenticated;
grant select on public.report_treatments_billing to authenticated;
