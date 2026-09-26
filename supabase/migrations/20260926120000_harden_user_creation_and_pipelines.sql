-- Endurecimento antes de dados reais (CRM publicado em crm.clinicsmart.cloud)
--
-- 1) handle_new_user passa a ler role/organization_id de raw_app_meta_data.
--    raw_user_meta_data é controlado pelo próprio utilizador (supabase.auth
--    .signUp com a anon key, que é pública no bundle do browser): qualquer
--    pessoa podia registar-se com role=administrador e o organization_id de
--    outra clínica. raw_app_meta_data só é gravável com service_role.
--    Sem organization_id => erro (acabou o fallback para a "Clínica Default"):
--    utilizadores só nascem pelo onboarding ou pela Admin API.
--
-- 2) set_default_pipeline filtrava só por is_default — desde a Fase 8 há um
--    default por organização, e a função (security definer, ignora RLS)
--    podia ligar o deal de uma clínica ao funil de outra. Agora filtra por
--    new.organization_id (o DEFAULT da coluna já está aplicado quando um
--    trigger BEFORE corre).
--
-- 3) Organizações novas não recebiam funil nenhum (o único "Funil Comercial"
--    foi criado na Etapa 2.1 para a organização default), por isso criar um
--    deal falharia no NOT NULL de pipeline_id. Cada organização nova recebe
--    agora o seu "Funil Comercial" default.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_org_id uuid;
begin
  v_org_id := (new.raw_app_meta_data ->> 'organization_id')::uuid;

  if v_org_id is null then
    raise exception 'handle_new_user: organization_id em falta no app_metadata — utilizadores só podem ser criados pelo onboarding ou pela Admin API';
  end if;

  v_role := coalesce(
    (new.raw_app_meta_data ->> 'role')::public.user_role,
    'recepcao'
  );

  insert into public.users (id, email, full_name, role, organization_id)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', v_role, v_org_id);

  perform public.log_activity(
    v_org_id,
    'user.created',
    'users',
    new.id,
    jsonb_build_object('email', new.email, 'role', v_role)
  );

  return new;
end;
$$;

create or replace function public.set_default_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pipeline_id is null then
    select id into new.pipeline_id
    from public.pipelines
    where is_default
      and organization_id = new.organization_id
    limit 1;
  end if;
  return new;
end;
$$;

create or replace function public.create_default_pipeline_for_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pipelines (organization_id, name, description, is_default)
  values (
    new.id,
    'Funil Comercial',
    'Novo lead → Contactado → Avaliação marcada → Avaliação realizada → Orçamento enviado → Em negociação → Tratamento iniciado → Concluído/Perdido.',
    true
  );
  return new;
end;
$$;

create trigger organizations_create_default_pipeline
after insert on public.organizations
for each row execute function public.create_default_pipeline_for_organization();
