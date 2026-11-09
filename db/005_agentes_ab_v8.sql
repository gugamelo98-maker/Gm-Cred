-- Empresa virtual CLT — 3 agentes por setor (teste A/B/C), sorteio fixo por cliente, cache do token V8 e respostas prontas
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-09. Idempotente.

-- 1. AGENTES: versão (A/B/C), abordagem, modelo e peso no sorteio
alter table credito.agentes
  add column if not exists versao text,
  add column if not exists abordagem text,
  add column if not exists peso numeric not null default 1;

update credito.agentes set modelo = 'google/gemini-2.5-flash' where modelo is null;
alter table credito.agentes alter column modelo set default 'google/gemini-2.5-flash';

insert into credito.agentes (nome, setor_id, papel, versao, abordagem, avatar) values
 ('Ana','recepcao','Recepcionista','A','Direta: vai direto ao ponto e pede o CPF logo','{}'),
 ('Bia','recepcao','Recepcionista','B','Consultiva: entende a necessidade antes de pedir o CPF','{}'),
 ('Caio','recepcao','Recepcionista','C','Segurança: começa passando confiança (sem cobrança antecipada) e depois pede o CPF','{}'),
 ('Bruno','simulacao','Analista de crédito','A','Valor máximo: apresenta primeiro o maior valor possível','{}'),
 ('Duda','simulacao','Analista de crédito','B','Parcela que cabe: começa pela parcela mensal','{}'),
 ('Enzo','simulacao','Analista de crédito','C','Três opções: mostra menor, médio e máximo e deixa o cliente escolher','{}'),
 ('Carla','vendas','Consultora de vendas','A','Objetiva: responde dúvidas e conduz rápido para o fechamento','{}'),
 ('Fábio','vendas','Consultor de vendas','B','Empática: valida a preocupação antes de contornar a objeção','{}'),
 ('Gabi','vendas','Consultora de vendas','C','Urgência leve: reforça vantagens reais, sem pressão falsa','{}'),
 ('Diego','formalizacao','Especialista em contratos','A','Direto: pede a chave PIX e envia o link com instruções curtas','{}'),
 ('Helô','formalizacao','Especialista em contratos','B','Passo a passo: conduz o cliente em cada etapa da assinatura','{}'),
 ('Igor','formalizacao','Especialista em contratos','C','Guiado: envia o link com um mini-guia e lembretes programados','{}'),
 ('Elisa','posvenda','Relacionamento','A','Proativa: avisa cada mudança de status sem o cliente perguntar','{}'),
 ('João','posvenda','Relacionamento','B','Sob demanda: só fala quando há algo a resolver ou o dinheiro cai','{}'),
 ('Lara','posvenda','Relacionamento','C','Relacionamento: acompanha, comemora o pagamento e pede indicação','{}'),
 ('Fernando','gerente','Recuperação','A','Lembrete simples: valor continua disponível','{}'),
 ('Marta','gerente','Recuperação','B','Novo motivo: volta com uma informação nova (outro prazo, outra simulação)','{}'),
 ('Nico','gerente','Recuperação','C','Pergunta aberta: descobre o motivo da parada e ajusta','{}')
on conflict (setor_id, nome) do update set versao=excluded.versao, abordagem=excluded.abordagem, papel=excluded.papel;

-- 2. ATRIBUIÇÕES: em cada setor o cliente cai num agente e fica com ele (base do placar A/B/C)
create table if not exists credito.atribuicoes (
  id bigserial primary key,
  lead_id int not null references credito.leads(id) on delete cascade,
  setor_id text not null references credito.setores(id),
  agente_id int not null references credito.agentes(id),
  inicio timestamptz not null default now(),
  fim timestamptz,
  resultado text,                    -- avancou / perdeu / recuperou ...
  unique (lead_id, setor_id));
create index if not exists atribuicoes_agente_idx on credito.atribuicoes (agente_id, setor_id);

-- sorteio ponderado (peso) entre os agentes ativos do setor; mantém o mesmo agente se já houver
create or replace function credito.atribuir_agente(p_lead int, p_setor text) returns int language plpgsql as $$
declare v_ag int;
begin
  select agente_id into v_ag from credito.atribuicoes where lead_id=p_lead and setor_id=p_setor;
  if v_ag is null then
    select id into v_ag from credito.agentes
     where setor_id=p_setor and ativo and peso > 0
     order by -ln(random()) / peso limit 1;      -- sorteio proporcional ao peso
    if v_ag is null then return null; end if;
    insert into credito.atribuicoes (lead_id, setor_id, agente_id) values (p_lead, p_setor, v_ag)
    on conflict (lead_id, setor_id) do nothing;
    select agente_id into v_ag from credito.atribuicoes where lead_id=p_lead and setor_id=p_setor;
  end if;
  update credito.leads set agente_id=v_ag where id=p_lead and agente_id is distinct from v_ag;
  return v_ag;
end $$;

-- 3. TOKEN DA V8 EM CACHE (vale 24 h; renovado com folga)
create table if not exists credito.v8_token (
  id int primary key default 1 check (id = 1),
  token text not null,
  expira_em timestamptz not null,
  atualizado_em timestamptz not null default now());

-- 4. RESPOSTAS PRONTAS (curtas) que os agentes usam nas dúvidas comuns
create table if not exists credito.respostas_prontas (
  id serial primary key, tema text not null unique, pergunta text not null, resposta text not null, ativo boolean not null default true);
insert into credito.respostas_prontas (tema, pergunta, resposta) values
 ('o_que_e','O que é crédito CLT?','É um empréstimo com desconto direto na sua folha de pagamento 😊'),
 ('cobranca','Tem que pagar algo antes?','Não! Nenhuma cobrança antecipada. Se alguém pedir, é golpe.'),
 ('prazo_dinheiro','Quanto tempo para cair o dinheiro?','Depois da assinatura, a V8 analisa e libera direto no seu PIX.'),
 ('saida_empresa','E se eu sair da empresa?','As parcelas seguem as regras do consignado. Te explico no detalhe na hora da proposta.'),
 ('seguro','É seguro?','Sim! É pela V8 Digital, com contrato digital assinado por você.'),
 ('robo','Você é robô?','Sou a Ana, assistente virtual da GM Cred, e tem um especialista acompanhando seu atendimento 😉')
on conflict (tema) do update set pergunta=excluded.pergunta, resposta=excluded.resposta;

-- 5. MENSAGENS: qual agente enviou cada mensagem (para o placar e a ficha)
alter table credito.conversas add column if not exists agente_versao text;
