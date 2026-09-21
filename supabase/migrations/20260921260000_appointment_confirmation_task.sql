-- Etapa 4.3 — Criação automática de tarefa de confirmação
--
-- Ao marcar uma consulta, cria automaticamente uma tarefa de confirmação.

-- tasks.appointment_id: rastreabilidade da tarefa automática até à
-- consulta que a originou (mesmo padrão do lead_id adicionado na Etapa 2.5).
alter table public.tasks
  add column appointment_id uuid references public.appointments (id);

create index tasks_appointment_idx on public.tasks (appointment_id);

create or replace function public.create_confirmation_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'marcada' then
    insert into public.tasks (patient_id, appointment_id, title, description, due_at, status)
    values (
      new.patient_id,
      new.id,
      'Confirmar consulta',
      format('Confirmar a consulta agendada para %s.', to_char(new.scheduled_at, 'DD/MM/YYYY HH24:MI')),
      greatest(now(), new.scheduled_at - interval '1 day'),
      'pendente'
    );
  end if;
  return new;
end;
$$;

comment on function public.create_confirmation_task is
  'Ao marcar uma consulta (status inicial marcada), cria automaticamente a tarefa de confirmação correspondente em tasks.';

create trigger appointments_create_confirmation_task
after insert on public.appointments
for each row execute function public.create_confirmation_task();
