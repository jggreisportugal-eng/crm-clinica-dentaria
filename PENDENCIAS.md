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

## Pontos de integração prontos para o N8N (Fase 6)

Preparados com antecedência (Etapas 2.5 e 4.5), executáveis só via
`service_role` (nunca por um utilizador autenticado comum):

- **`POST /rest/v1/rpc/run_followup_checks`** — `{p_days_unanswered_lead?, p_days_stalled_budget?}`
  → cria tarefas de follow-up para leads sem resposta e orçamentos parados.
  Pensado para a Etapa 6.5/6.6 (disparo agendado via N8N ou pg_cron).
- **`POST /rest/v1/rpc/get_tomorrow_appointments`** — sem parâmetros → lista
  as consultas marcadas/confirmadas de amanhã (nome/telefone do paciente,
  profissional). Pensado para a Etapa 6.4 (lembrete de consulta via
  Chatwoot) — só falta o fluxo N8N em si, que também depende da
  integração Chatwoot acima.
