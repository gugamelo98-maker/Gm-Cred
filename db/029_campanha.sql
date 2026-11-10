-- Empresa virtual CLT — Campanha: a IA chama os clientes importados (1 mensagem a cada 5 min, 8h-20h)
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-10. Idempotente.
-- Painel: POST /escritorio/campanha (k, acao = ver | importar | ativar | pausar | mensagem | remover, linhas, mensagem, id)
-- Número de WhatsApp da campanha: instância Evolution "gmcred-campanha" (criada em 2026-11-10, aguardando leitura do QR).
-- Pendente: disparador (1 envio a cada intervalo_min) e entrada das respostas do WhatsApp no Roteador.

create table if not exists credito.campanha_contatos (
  id bigserial primary key,
  nome text, telefone text not null unique, cpf text, margem numeric(12,2),
  status text not null default 'na_fila' check (status in ('na_fila', 'enviado', 'erro', 'removido')),
  lead_id int, erro text, criado_em timestamptz not null default now(), enviado_em timestamptz);
create index if not exists campanha_status_idx on credito.campanha_contatos (status, id);

insert into credito.configuracoes (chave, valor) values ('campanha', jsonb_build_object(
  'ativa', false, 'intervalo_min', 5, 'instancia', null, 'hora_inicio', 8, 'hora_fim', 20,
  'mensagem', 'Oi {nome}, tudo bem? Aqui é a Ana, da GM Cred 😊 Vi que você tem crédito CLT disponível pela carteira assinada. Quer que eu veja quanto consigo liberar pra você? É rapidinho e sem compromisso.'))
on conflict (chave) do nothing;

-- credito.campanha_api(k, acao, dados): versão em vigor é a aplicada no banco nesta data
-- (importa normalizando o telefone para 55+DDD+número, descarta inválidos e repetidos — inclusive quem já é cliente —,
--  liga/pausa, salva a mensagem e devolve fila, enviados, responderam e a lista com CPF mascarado).

-- 2026-11-10: WhatsApp ligado (instância "gmcred-campanha", webhook MESSAGES_UPSERT -> /webhook/gmcred/whatsapp)
--  * n8n "GM Cred · WhatsApp (entrada)": recebe a mensagem, credito.receber_whatsapp(tel, texto, nome), espera 8 s,
--    confere se é a última da sequência e chama o Agente;
--  * n8n "GM Cred · WhatsApp (envio)": a cada minuto, credito.wpp_pendentes() (faz o passo da campanha quando passou o
--    intervalo e devolve as mensagens de saída ainda não enviadas dos leads de WhatsApp) -> Evolution sendText -> wpp_marcar.
--  * credito.conversas.enviado_wpp marca o que já saiu; credito.tel_lead() casa o número com ou sem o 9.
--  * áudio pelo WhatsApp ainda não é transcrito: vira "🎤 (áudio que não deu para entender)" e a Ana pede para escrever.
alter table credito.conversas add column if not exists enviado_wpp timestamptz;
update credito.configuracoes set valor = valor || '{"instancia":"gmcred-campanha"}'::jsonb where chave = 'campanha';
