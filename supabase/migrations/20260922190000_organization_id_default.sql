-- Correção pós-Etapa 8.2: nenhum código da aplicação envia
-- organization_id explicitamente ao criar um registo (o campo não
-- existia antes da Fase 8) — sem um default, todo INSERT feito por um
-- utilizador autenticado falhava a policy de RLS (organization_id
-- ficava null, que nunca é igual a current_user_organization_id()).
--
-- Diferente do gotcha da Etapa 2.2 (subquery em DEFAULT não é permitido),
-- aqui é só uma chamada a função — isso é permitido pelo Postgres.
-- Chamadas explícitas (triggers/automação com service_role, que não têm
-- utilizador autenticado) continuam a especificar organization_id à mão,
-- o que sempre tem prioridade sobre o default.

do $$
declare
  t text;
  tables text[] := array[
    'users', 'activities', 'companies', 'tags', 'campaigns',
    'patients', 'leads', 'pipelines', 'deals', 'tasks',
    'conversations', 'messages', 'appointments', 'treatments',
    'patient_tags'
  ];
begin
  foreach t in array tables loop
    execute format(
      'alter table public.%I alter column organization_id set default public.current_user_organization_id();',
      t
    );
  end loop;
end;
$$;
