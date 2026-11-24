-- Empresa virtual CLT — roteador de mensagens, chat de teste e configurações
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-09. Idempotente.

-- 1. CONFIGURAÇÕES gerais (ex.: endereço padrão usado na formalização da V8)
create table if not exists credito.configuracoes (
  chave text primary key, valor jsonb not null, atualizado_em timestamptz not null default now());
insert into credito.configuracoes (chave, valor) values
 ('endereco_padrao', '{"cep":"88049335","logradouro":"Servidão Unidos","numero":"220","bairro":"Tapera","cidade":"Florianópolis","uf":"SC"}')
on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();

-- 2. CLIENTES DE TESTE (vindos do chat de teste) ficam marcados e podem ser apagados de uma vez
alter table credito.leads add column if not exists teste boolean not null default false;
alter table credito.leads add column if not exists canal text not null default 'whatsapp';
create index if not exists leads_telefone_ativo_idx on credito.leads (telefone, criado_em desc);

-- 3. RECEBER MENSAGEM: acha/cria o cliente, grava a mensagem, sorteia o agente do setor
--    e devolve tudo que o agente precisa (cliente, agente, histórico curto)
create or replace function credito.receber_mensagem(p_telefone text, p_texto text, p_canal text default 'whatsapp',
                                                    p_numero_id int default null, p_nome text default null)
returns json language plpgsql as $$
declare v_lead credito.leads%rowtype; v_ag int; v_novo boolean := false;
begin
  if coalesce(trim(p_telefone),'') = '' or coalesce(trim(p_texto),'') = '' then return null; end if;
  select * into v_lead from credito.leads
   where telefone = p_telefone and status not in ('parou')
   order by criado_em desc limit 1;
  if v_lead.id is null then
    insert into credito.leads (telefone, nome, status, setor_id, canal, teste, numero_id, dt_respondeu)
    values (p_telefone, nullif(p_nome,''), 'respondeu', 'recepcao', p_canal, p_canal = 'teste', p_numero_id, now())
    returning * into v_lead;
    v_novo := true;
  else
    update credito.leads set ultima_interacao = now(),
           aguardando = case when aguardando = 'humano' then 'humano' else 'agente' end,
           dt_respondeu = coalesce(dt_respondeu, now()),
           nome = coalesce(nome, nullif(p_nome,'')),
           status = case when status = 'disparado' then 'respondeu' else status end
     where id = v_lead.id returning * into v_lead;
  end if;

  v_ag := credito.atribuir_agente(v_lead.id, v_lead.setor_id);
  insert into credito.conversas (lead_id, agente_id, direcao, conteudo, numero_id, setor_id)
  values (v_lead.id, v_ag, 'entrada', p_texto, p_numero_id, v_lead.setor_id);
  update credito.agentes set status = 'trabalhando', lead_atual_id = v_lead.id, ultima_atividade = now() where id = v_ag;

  return json_build_object(
    'novo', v_novo,
    'responder', v_lead.aguardando <> 'humano',
    'lead', json_build_object('id', v_lead.id, 'nome', v_lead.nome, 'telefone', v_lead.telefone, 'cpf', v_lead.cpf_informado,
                              'setor', v_lead.setor_id, 'status', v_lead.status, 'consult_id', v_lead.consult_id,
                              'valor', v_lead.valor, 'teste', v_lead.teste),
    'agente', (select json_build_object('id', a.id, 'nome', a.nome, 'versao', a.versao, 'abordagem', a.abordagem,
                                        'modelo', a.modelo, 'prompt', a.prompt, 'papel', a.papel)
                 from credito.agentes a where a.id = v_ag),
    'historico', coalesce((select json_agg(json_build_object('de', h.direcao, 'texto', h.conteudo) order by h.criado_em)
                  from (select direcao, conteudo, criado_em from credito.conversas
                         where lead_id = v_lead.id order by criado_em desc limit 20) h), '[]'::json)
  );
end $$;

-- 4. REGISTRAR RESPOSTA do agente (já dividida em balões curtos)
create or replace function credito.registrar_resposta(p_lead int, p_agente int, p_baloes json)
returns json language plpgsql as $$
declare v_setor text; v_versao text; b text;
begin
  select setor_id into v_setor from credito.leads where id = p_lead;
  select versao into v_versao from credito.agentes where id = p_agente;
  for b in select json_array_elements_text(p_baloes) loop
    insert into credito.conversas (lead_id, agente_id, direcao, conteudo, setor_id, agente_versao)
    values (p_lead, p_agente, 'saida', b, v_setor, v_versao);
  end loop;
  update credito.leads set aguardando = case when aguardando = 'humano' then 'humano' else 'cliente' end,
         ultima_interacao = now() where id = p_lead;
  update credito.agentes set status = 'livre', ultima_atividade = now() where id = p_agente;
  return json_build_object('ok', true, 'baloes', p_baloes);
end $$;

-- 5. APAGAR CLIENTES DE TESTE (com conversas, eventos e sorteios)
create or replace function credito.limpar_testes() returns int language plpgsql as $$
declare n int;
begin
  update credito.agentes set lead_atual_id = null where lead_atual_id in (select id from credito.leads where teste);
  delete from credito.conversas where lead_id in (select id from credito.leads where teste);
  delete from credito.simulacoes where lead_id in (select id from credito.leads where teste);
  delete from credito.contratos where lead_id in (select id from credito.leads where teste);
  delete from credito.leads where teste;           -- eventos, alertas e atribuições saem em cascata
  get diagnostics n = row_count;
  return n;
end $$;
