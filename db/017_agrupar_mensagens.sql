-- Empresa virtual CLT — mensagens em sequência do cliente: uma resposta só, entendendo todas
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-10. Idempotente.
-- Como funciona (n8n · Roteador): cada mensagem espera 8 s; se chegou outra do mesmo cliente nesse tempo, essa sai
-- sem responder ("agrupada"). Só a última dispara o agente, que lê todas as mensagens desde a última resposta.
-- A ordem usa a hora em que o cliente enviou (enviada_em), pois o n8n pode processar as mensagens fora de ordem.

alter table credito.conversas add column if not exists enviada_em timestamptz;

create or replace function credito.receber_mensagem_em(p_telefone text, p_texto text, p_canal text, p_numero_id int, p_nome text, p_enviada_em timestamptz)
returns json language plpgsql as $$
declare r json;
begin
  r := credito.receber_mensagem(p_telefone, p_texto, p_canal, p_numero_id, p_nome);
  if r is not null then
    update credito.conversas set enviada_em = coalesce(p_enviada_em, criado_em) where id = (r->>'msg_id')::bigint;
  end if;
  return r;
end $$;

create or replace function credito.ultima_do_cliente(p_lead int, p_msg bigint) returns boolean language sql stable as $$
  select coalesce((select id from credito.conversas where lead_id = p_lead and direcao = 'entrada'
                    order by coalesce(enviada_em, criado_em) desc, id desc limit 1) = p_msg, false) $$;

update credito.configuracoes set valor = to_jsonb((valor #>> '{}') || E'\n- Ao listar ofertas, use SEMPRE a mesma numeração das OFERTAS nos DADOS DO CLIENTE (ex.: se mostrar só a de 36x e a de 24x, mantenha os números delas, como 2) e 3)). Ao chamar escolher_oferta, use esse número.'::text), atualizado_em = now()
where chave = 'regras_gerais' and (valor #>> '{}') not like '%mesma numeração das OFERTAS%';

-- receber_mensagem passou a devolver msg_id; contexto_agente junta as mensagens do cliente desde a última resposta,
-- na ordem de envio (versões completas aplicadas no banco via replace das funções).
