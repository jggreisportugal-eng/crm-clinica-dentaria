-- Etapa 1.2 — Schema users + autenticação + RLS por perfil
--
-- Cria a extensão de perfil (public.users) sobre auth.users, com os 5
-- perfis de acesso do CRM, e aplica RLS pelo princípio do menor privilégio
-- desde já (mesmo sem as restantes tabelas existirem ainda).

-- 1. Perfis de acesso -------------------------------------------------------

create type public.user_role as enum (
  'administrador',
  'gestor',
  'recepcao',
  'comercial',
  'profissional'
);

-- 2. Tabela users -------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'recepcao',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is
  'Perfil de cada utilizador do CRM (extensão de auth.users) com o seu perfil de acesso (role).';
comment on column public.users.role is
  'Perfil de acesso: administrador | gestor | recepcao | comercial | profissional.';

-- updated_at sempre atual
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- 3. Criação automática do perfil ao registar um utilizador em auth.users ----
--
-- O role vem de auth.users.raw_user_meta_data->>'role' (definido no momento
-- da criação do utilizador, tipicamente via Admin API por um administrador),
-- nunca escolhido livremente pelo próprio utilizador num formulário público.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(
      (new.raw_user_meta_data ->> 'role')::public.user_role,
      'recepcao'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 4. RLS ----------------------------------------------------------------------

alter table public.users enable row level security;

-- Função auxiliar (security definer) para ler o role do utilizador autenticado
-- sem recursão de RLS (uma policy não pode fazer SELECT à própria tabela que
-- protege sem isto).
create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.users where id = auth.uid();
$$;

comment on function public.current_user_role() is
  'Devolve o perfil (role) do utilizador autenticado. security definer para evitar recursão de RLS em public.users.';

-- Cada utilizador vê o seu próprio registo.
create policy "users_select_own"
on public.users
for select
to authenticated
using (id = auth.uid());

-- Administrador vê todos os registos.
create policy "users_select_admin"
on public.users
for select
to authenticated
using (public.current_user_role() = 'administrador');

-- Administrador pode atualizar qualquer registo (ex.: mudar role/active).
create policy "users_update_admin"
on public.users
for update
to authenticated
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

-- Sem policies de insert/delete para 'authenticated': a criação do perfil é
-- feita exclusivamente pelo trigger (security definer) a partir de
-- auth.users, e alterações administrativas usam a service_role key
-- (bypassa RLS) a partir de código server-side de confiança — menor
-- privilégio: nenhum utilizador comum pode criar, apagar ou promover a si
-- próprio a outro perfil.
