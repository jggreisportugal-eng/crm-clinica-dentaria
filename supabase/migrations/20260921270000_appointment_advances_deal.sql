-- Etapa 4.4 — Atualização de etapa do funil ao realizar consulta
--
-- Quando uma consulta muda para "realizada", avança o deal correspondente
-- (avaliacao_marcada -> avaliacao_realizada, conforme o exemplo do
-- documento) e cria uma tarefa de acompanhamento.
--
-- "Deal correspondente": não há FK direta appointment -> deal, por isso
-- é resolvido pelo deal ativo mais recente do mesmo paciente que ainda
-- não terminou (fora de concluido/perdido) — a correspondência mais
-- razoável possível com o modelo de dados atual.

create or replace function public.advance_deal_on_appointment_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deal record;
begin
  if new.status = 'realizada' and old.status is distinct from 'realizada' then
    select *
    into v_deal
    from public.deals
    where patient_id = new.patient_id
      and active
      and funnel_stage not in ('concluido', 'perdido')
    order by created_at desc
    limit 1;

    if found then
      if v_deal.funnel_stage = 'avaliacao_marcada' then
        update public.deals
        set funnel_stage = 'avaliacao_realizada'
        where id = v_deal.id;
      end if;

      insert into public.tasks (patient_id, deal_id, appointment_id, title, description, due_at, status)
      values (
        new.patient_id,
        v_deal.id,
        new.id,
        'Acompanhamento pós-consulta',
        'Consulta realizada — fazer o acompanhamento comercial (orçamento/próximos passos).',
        now() + interval '1 day',
        'pendente'
      );
    end if;
  end if;

  return new;
end;
$$;

comment on function public.advance_deal_on_appointment_done is
  'Ao marcar uma consulta como realizada, avança avaliacao_marcada -> avaliacao_realizada no deal correspondente e cria a tarefa de acompanhamento.';

create trigger appointments_advance_deal_on_done
after update on public.appointments
for each row execute function public.advance_deal_on_appointment_done();
