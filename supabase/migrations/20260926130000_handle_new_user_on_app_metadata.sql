-- Correção da 20260926120000: auth.admin.createUser grava o app_metadata
-- DEPOIS do INSERT em auth.users (INSERT com só provider/providers, seguido
-- de um UPDATE com o app_metadata passado, na mesma transação). O trigger
-- AFTER INSERT via organization_id a null e abortava a criação do
-- utilizador ("Database error creating new user").
--
-- Agora handle_new_user corre no INSERT e no UPDATE de raw_app_meta_data:
-- cria o perfil em public.users quando o organization_id aparece, e é
-- idempotente (se o perfil já existe, não faz nada — mudar role ou
-- organização continua a ser feito em public.users, não no app_metadata).
-- Sem organization_id, a conta fica sem perfil e o RLS não lhe dá acesso a
-- nada (o registo público está, além disso, desligado no Supabase).

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
  if exists (select 1 from public.users where id = new.id) then
    return new;
  end if;

  v_org_id := (new.raw_app_meta_data ->> 'organization_id')::uuid;

  if v_org_id is null then
    return new;
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

create trigger on_auth_user_app_metadata_updated
after update of raw_app_meta_data on auth.users
for each row execute function public.handle_new_user();
