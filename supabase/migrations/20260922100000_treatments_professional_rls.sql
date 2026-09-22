-- Etapa 5.3 — Controlo de acesso por perfil em treatments
--
-- Refina o RLS baseline da Etapa 5.1: o perfil Profissional passa a ver
-- e atualizar só os tratamentos em que é o responsável (professional_id),
-- não todos. Administrador/gestor mantêm acesso amplo; comercial mantém
-- leitura ampla (não muda).

drop policy "treatments_select" on public.treatments;

create policy "treatments_select"
on public.treatments
for select
to authenticated
using (
  public.current_user_role() in ('administrador', 'gestor', 'comercial')
  or (
    public.current_user_role() = 'profissional'
    and professional_id = auth.uid()
  )
);

drop policy "treatments_update" on public.treatments;

create policy "treatments_update"
on public.treatments
for update
to authenticated
using (
  public.current_user_role() in ('administrador', 'gestor')
  or (
    public.current_user_role() = 'profissional'
    and professional_id = auth.uid()
  )
)
with check (
  public.current_user_role() in ('administrador', 'gestor')
  or (
    public.current_user_role() = 'profissional'
    and professional_id = auth.uid()
  )
);

-- Transição do deal para "Tratamento iniciado" -----------------------------
--
-- O checkpoint de fim de Fase 5 exige que isto já funcione, mas nenhuma
-- etapa anterior (5.1/5.2) criou essa ligação — fica aqui, junto do
-- controlo de acesso, para fechar o checkpoint. Mesmo padrão da Etapa 4.4
-- (appointments -> deals): quando o tratamento passa a "em_andamento",
-- avança o deal ligado para tratamento_iniciado (só avança, nunca faz
-- regredir um deal que já esteja mais à frente).

create or replace function public.advance_deal_on_treatment_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'em_andamento'
     and old.status is distinct from 'em_andamento'
     and new.deal_id is not null
  then
    update public.deals
    set funnel_stage = 'tratamento_iniciado'
    where id = new.deal_id
      and funnel_stage not in ('tratamento_iniciado', 'concluido', 'perdido');
  end if;

  return new;
end;
$$;

comment on function public.advance_deal_on_treatment_started is
  'Quando um tratamento passa a em_andamento, avança o deal ligado para tratamento_iniciado (nunca regride um deal já mais avançado).';

create trigger treatments_advance_deal_on_started
after update on public.treatments
for each row execute function public.advance_deal_on_treatment_started();
