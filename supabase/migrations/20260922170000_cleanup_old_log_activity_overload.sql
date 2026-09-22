-- Limpeza: a Etapa 8.1 mudou a assinatura de log_activity() acrescentando
-- organization_id como primeiro parâmetro. Como os tipos dos argumentos
-- mudaram, o Postgres criou uma nova sobrecarga em vez de substituir a
-- antiga — a versão de 5 argumentos (sem organization_id) ficou órfã,
-- sem nenhum ponto de chamada. Remove-a para não haver duas versões
-- incompatíveis da mesma função no schema.

drop function if exists public.log_activity(text, text, uuid, jsonb, uuid);
