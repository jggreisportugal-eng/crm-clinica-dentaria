# Pendências

## Integração Chatwoot (Etapas 3.3 – 3.6)

Adiadas em 2026-09-21: a VPS/instância do Chatwoot ainda não está pronta.
Implementar essas etapas às cegas (sem um payload real para validar) arrisca
campos errados no webhook e retrabalho depois — por isso ficam para quando a
instância existir.

O schema que já as suporta está pronto (Etapas 3.1 `conversations` e 3.2
`messages`, ambas commitadas). Falta:

- **Etapa 3.3** — Endpoint receptor de webhooks do Chatwoot (entrada): cria/
  atualiza leads a partir de eventos de nova conversa/mensagem, com
  deduplicação por telefone/e-mail + `crm_id`.
- **Etapa 3.4** — Sincronização bidirecional de status, responsável e
  etiquetas entre Chatwoot e CRM.
- **Etapa 3.5** — Envio de mensagens a partir do CRM via API do Chatwoot.
- **Etapa 3.6** — Link direto na ficha do paciente/lead para a conversa
  correspondente no Chatwoot.

### O que é preciso para retomar

- URL da instância Chatwoot (ex.: `https://chat.dominio.pt`)
- API access token do Chatwoot (para a Etapa 3.5, envio de mensagens)
- Account ID do Chatwoot
- Segredo/assinatura do webhook (para validar os eventos recebidos na 3.3)
- Acesso para configurar o webhook no painel do Chatwoot apontando para o
  endpoint que será criado na 3.3

Assim que a VPS estiver disponível, retomar direto na Etapa 3.3.

## Fase 6 — N8N (adiada inteira)

Adiada em 2026-09-22: nenhuma instância N8N disponível ainda (mesma situação
do Chatwoot — provavelmente vai ficar na mesma VPS). A Etapa 6.1 já pede
para configurar a instância real, e quase toda a fase depende disso, então
ficou toda para depois em vez de tentar preparar às cegas.

- **Etapa 6.1** — Setup do ambiente N8N e autenticação com o CRM.
- **Etapa 6.2** — Fluxo: novo lead → criar/atualizar paciente.
- **Etapa 6.3** — Fluxo: novo lead de campanha → registar origem e UTM.
- **Etapa 6.4** — Fluxo: lembrete de consulta (consulta amanhã).
- **Etapa 6.5** — Fluxo: paciente não respondeu → tarefa de follow-up.
- **Etapa 6.6** — Fluxo: orçamento enviado há X dias → nova tarefa comercial.
- **Etapa 6.7** — Fluxo: paciente inativo → campanha de reativação.
- **Etapa 6.8** — Fluxo: tratamento concluído → pós-atendimento.

### Pontos de integração já prontos para quando o N8N existir

Preparados com antecedência (Etapas 2.5 e 4.5), executáveis só via
`service_role` (nunca por um utilizador autenticado comum):

Desde a Etapa 8.2 (multi-clínica), ambas exigem `p_organization_id`
explícito — chamadas por service_role, sem sessão de utilizador, então não
há como inferir a organização sozinhas. O workflow N8N de cada clínica
passa o `organization_id` dela própria.

- **`POST /rest/v1/rpc/run_followup_checks`** — `{p_organization_id, p_days_unanswered_lead?, p_days_stalled_budget?}`
  → cria tarefas de follow-up para leads sem resposta e orçamentos parados.
  Pensado para a Etapa 6.5/6.6 (disparo agendado via N8N ou pg_cron).
- **`POST /rest/v1/rpc/get_tomorrow_appointments`** — `{p_organization_id}`
  → lista as consultas marcadas/confirmadas de amanhã (nome/telefone do
  paciente, profissional). Pensado para a Etapa 6.4 (lembrete de consulta
  via Chatwoot) — só falta o fluxo N8N em si, que também depende da
  integração Chatwoot acima.

### O que é preciso para retomar

- URL/acesso à instância N8N
- Credenciais de API do CRM para o N8N se autenticar (Etapa 6.1) — nesta
  stack isso é a `service_role key` do Supabase (mesma usada nos dois RPCs
  acima), guardada como credencial no N8N, nunca hardcoded num workflow
- Para 6.4, 6.5, 6.7: depende também da integração Chatwoot (ver acima)

Assim que N8N estiver disponível, retomar direto na Etapa 6.1.

## Formulário do site → CRM (lado do CRM pronto em 2026-09-26)

A rota `POST /api/public/leads/[formId]` (commit 2d608fd) aceita envios do
**browser** (JSON, CORS limitado a `site_forms.allowed_origins`). Foi pensada
para a landing de teste em Lovable (demo.clinicsmart.cloud); o prompt para a
ligar está em `docs/prompt-lovable-formulario.md`, **não aplicado** — a
landing é só de apresentação.

O site real (www.saudente.com) é **WordPress** (tema Dentalist) com
formulários **Forminator** (campos `name-1`, `email-1`, `phone-1`,
`select-1`, `textarea-1`, `consent-1`). O Forminator envia pela integração
"Webhook" **a partir do servidor WordPress** (sem cabeçalho Origin), por isso
falta, quando se avançar:

- Modo servidor-a-servidor em `site_forms`: token secreto (no URL ou
  cabeçalho) em vez da verificação de Origin.
- Mapeamento dos campos do Forminator (`name-1` → nome, `select-1` →
  interesse, `consent-1` → consentimento, …), confirmado com um envio real.
- Configurar o webhook no Forminator (Integrações → Webhook).

## Follow-up de fim de semana (lado do CRM pronto em 2026-10-01)

Às sextas, a assistente deseja bom fim de semana aos pacientes com negócio em
avaliação realizada / orçamento enviado / em negociação, parados há 3+ dias
(regras em `deals_due_weekend_followup`, migração
`20261001120000_weekend_followup.sql`). Rota
`POST /api/agent/followup-fim-de-semana`; mesmo caminho dos lembretes.

Canal: a inbox "WhatsApp Saudente" é `Channel::Api` (Evolution), não a
Cloud API oficial — não há janela de 24 h nem template a aprovar. Se um dia
se mudar para a Cloud API, o texto livre deixa de poder ser enviado fora da
janela e é preciso um template aprovado.

Falta:

- ~~Migração~~ — aplicada no Supabase em 2026-10-01 (a base de dados do CRM
  é o Supabase cloud, não a VPS).
- ~~Workflow no n8n~~ — importado e ativo em 2026-10-01 ("CRM — follow-up de
  fim de semana", credencial "Header Auth account"). Para outra clínica,
  duplicar o nó HTTP com a credencial dela.
- ~~Instruções da integração "Generic" no fazer.ai~~ — feito em 2026-10-01:
  a integração passou a chamar-se "CRM — lembretes de consulta e follow-ups"
  e distingue os eventos pelo início do texto ("Lembrete de consulta" /
  "Follow-up de fim de semana").
- ~~Histórico na ficha do paciente~~ — feito em 2026-10-02: botão
  "Histórico" na lista de pacientes (função `patient_history`, migração
  `20261002120000_patient_history.sql`, a aplicar no SQL Editor do Supabase).
