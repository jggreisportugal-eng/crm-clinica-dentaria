-- Etapa 8.1 — Introdução de organization_id em todas as tabelas
--
-- Cria public.organizations e adiciona organization_id às 14 tabelas
-- principais do documento + patient_tags (tabela de associação nossa,
-- que também precisa de isolamento). Todos os dados existentes são
-- migrados para uma organização "default" — nada de RLS ainda, isso é
-- a Etapa 8.2.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is
  'Clínicas/organizações (multi-tenant). Sem delete via API — usar active=false.';

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

-- Organização default: todos os dados existentes (Fases 1-7, dados de
-- teste incluídos) passam a pertencer a ela.
insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Clínica Default');

-- Helper: adiciona a coluna, faz o backfill e aplica not null, para não
-- repetir a mesma sequência de 3 comandos 15 vezes.
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
      'alter table public.%I add column organization_id uuid references public.organizations (id);',
      t
    );

    -- Desliga os triggers da tabela (ex.: log_<tabela>_activity) antes
    -- do backfill: eles chamariam log_activity() com a assinatura
    -- ainda antiga (essa função só é atualizada na parte 2 desta
    -- etapa) e tentariam inserir em activities sem organization_id,
    -- que a esta altura já pode ser not null.
    execute format('alter table public.%I disable trigger user;', t);

    execute format(
      'update public.%I set organization_id = %L;',
      t, '00000000-0000-0000-0000-000000000001'
    );

    execute format('alter table public.%I enable trigger user;', t);

    execute format(
      'alter table public.%I alter column organization_id set not null;',
      t
    );
    execute format(
      'create index %I on public.%I (organization_id);',
      t || '_organization_idx', t
    );
  end loop;
end;
$$;

-- Ajustes de constraints que passam a fazer sentido por organização, não
-- globalmente, agora que organization_id existe em todo o lado:

-- tags.name era globalmente único (Etapa 1.5); duas clínicas devem poder
-- ter, cada uma, a sua própria tag "VIP".
alter table public.tags drop constraint tags_name_key;
alter table public.tags add constraint tags_org_name_key unique (organization_id, name);

-- pipelines: só um "default" por organização, não um único no sistema
-- inteiro (Etapa 2.1).
drop index public.pipelines_single_default_idx;
create unique index pipelines_single_default_idx
on public.pipelines (organization_id, is_default)
where is_default;
