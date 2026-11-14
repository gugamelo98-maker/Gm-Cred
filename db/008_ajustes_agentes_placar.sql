-- Empresa virtual CLT — ajustes depois dos primeiros testes dos agentes + placar A/B/C
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-09. Idempotente.

-- 1. ofertas de demonstração respeitando um prazo pedido pelo cliente
create or replace function credito.ofertas_demo(p_margem numeric, p_prazo int) returns jsonb language sql immutable as $$
  select jsonb_agg(jsonb_build_object('n', n, 'seguro', seg, 'prazo', prazo, 'parcela', p_margem,
           'valor', round(p_margem * (1 - power(1.0498, -prazo)) / 0.0498 * case when seg then 0.93 else 0.97 end, 2),
           'config_id', 'demo', 'sim_id', 'demo-' || n) order by n)
  from (select * from (values (1, false, 46), (2, false, 36), (3, false, 24), (4, true, 46)) o(n, seg, prazo) where p_prazo is null
        union all
        select * from (values (1, false, p_prazo), (2, true, p_prazo)) o(n, seg, prazo) where p_prazo is not null) x $$;

-- 2. nova simulação durante a negociação não volta o cliente para "simulado"
create or replace function credito.acao(p_lead int, p_acao text, p_dados jsonb default '{}'::jsonb) returns json language plpgsql as $$
declare r json; v_status text;
begin
  select status into v_status from credito.leads where id = p_lead;
  r := credito.acao_agente(p_lead, p_acao, coalesce(p_dados, '{}'::jsonb));
  if p_acao = 'salvar_ofertas' and v_status in ('negociando') then update credito.leads set status = v_status where id = p_lead; end if;
  return (r::jsonb || jsonb_build_object('setor', (select setor_id from credito.leads where id = p_lead)))::json;
end $$;

-- 3. recuperação: retomar exatamente de onde parou, sem citar valores que não existem
update credito.setores set prompt = $t$ETAPA: RECUPERAÇÃO. O cliente parou de responder. Escreva UMA mensagem curta e natural para retomar a conversa exatamente de onde parou, no seu estilo. Não pressione e não use ferramentas.
- Se ele ainda não mandou o CPF: lembre que a consulta é rápida e gratuita e convide a mandar o CPF.
- Se já viu as OFERTAS: lembre que continuam disponíveis (use os valores dos DADOS DO CLIENTE).
- Se já escolheu e falta o PIX ou a assinatura: lembre que falta só esse passo.
- Nunca cite valores que não estejam nos DADOS DO CLIENTE.$t$ where id = 'gerente';
update credito.agentes set prompt = 'ESTILO: lembrete simples. Lembre de forma leve do próximo passo que falta.' where setor_id = 'gerente' and nome = 'Fernando';

-- 4. resultado de cada atendimento (base do placar A/B/C)
create or replace function credito.fn_marcar_recuperacao() returns trigger language plpgsql as $$
begin
  if new.direcao = 'entrada' then
    update credito.atribuicoes set resultado = 'recuperou', fim = now()
     where lead_id = new.lead_id and setor_id = 'gerente' and resultado is null
       and (select modo from credito.conversas c where c.lead_id = new.lead_id and c.direcao = 'saida' and c.id < new.id order by c.id desc limit 1) = 'recuperar';
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_conversas_recuperacao') then
    create trigger trg_conversas_recuperacao after insert on credito.conversas for each row execute function credito.fn_marcar_recuperacao();
  end if;
end $$;

create or replace function credito.fn_atribuicoes_resultado() returns trigger language plpgsql as $$
begin
  if new.setor_id is distinct from old.setor_id then
    update credito.atribuicoes set resultado = 'avancou', fim = now()
     where lead_id = new.id and setor_id = old.setor_id and resultado is null;
  end if;
  if new.status = 'parou' and old.status is distinct from 'parou' then
    update credito.atribuicoes set resultado = 'perdeu', fim = now()
     where lead_id = new.id and setor_id = new.setor_id and resultado is null;
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_leads_atribuicoes') then
    create trigger trg_leads_atribuicoes after update on credito.leads for each row execute function credito.fn_atribuicoes_resultado();
  end if;
end $$;

-- 5. placar dos agentes: atendidos, avançaram (ou recuperaram), perderam e taxa de sucesso
create or replace function credito.placar_agentes(p_incluir_teste boolean default true) returns json language sql stable as $$
  select coalesce(json_agg(x order by x.ordem, x.versao), '[]'::json) from (
    select s.ordem, s.id as setor, s.nome as setor_nome, a.nome, a.versao, a.abordagem,
           count(t.id) as atendidos,
           count(t.id) filter (where t.resultado in ('avancou', 'recuperou')) as sucesso,
           count(t.id) filter (where t.resultado = 'perdeu') as perdidos,
           case when count(t.id) > 0 then round(100.0 * count(t.id) filter (where t.resultado in ('avancou', 'recuperou')) / count(t.id)) end as taxa
      from credito.agentes a join credito.setores s on s.id = a.setor_id
      left join credito.atribuicoes t on t.agente_id = a.id
      left join credito.leads l on l.id = t.lead_id
     where a.ativo and a.versao is not null and (t.id is null or p_incluir_teste or not l.teste)
     group by s.ordem, s.id, s.nome, a.nome, a.versao, a.abordagem) x $$;

-- 6. recepção: se o cliente já mandou o CPF, consulta direto (sem pedir de novo)
update credito.setores set prompt = $t$ETAPA: RECEPÇÃO. Objetivo: conseguir o CPF do cliente para consultar quanto ele tem disponível.
- IMPORTANTE: se a mensagem do cliente já tiver um CPF (11 números, com ou sem pontos e traço), chame consultar_cpf imediatamente, mesmo que seja a primeira mensagem. Não peça o CPF de novo.
- cpf_invalido: peça para conferir o CPF.
- com_margem: diga que deu tudo certo e que já vai mostrar os valores. Não diga valores agora.
- processando: diga que está consultando e que avisa em instantes.
- sem_margem: diga com gentileza que no momento não há margem disponível (motivo simples, se houver) e agradeça.
- nao_encontrado_v8: diga que não achou vínculo CLT ativo para esse CPF e pergunte se ele trabalha de carteira assinada.
- Não peça nenhum outro dado além do CPF.$t$ where id = 'recepcao';
update credito.agentes set prompt = 'ESTILO: direto. Se ainda não tiver o CPF, já se apresente e peça o CPF para ver quanto ele tem liberado.' where setor_id = 'recepcao' and nome = 'Ana';
update credito.agentes set prompt = 'ESTILO: consultivo. Se ainda não tiver o CPF, primeiro pergunte de leve o que ele precisa (valor ou objetivo) e só depois peça o CPF.' where setor_id = 'recepcao' and nome = 'Bia';
update credito.agentes set prompt = 'ESTILO: segurança. Se ainda não tiver o CPF, diga que a consulta é gratuita, sem cobrança antecipada e sem compromisso, e peça o CPF.' where setor_id = 'recepcao' and nome = 'Caio';
update credito.setores set prompt = replace(prompt, '- sem_margem: diga com gentileza que no momento não há margem disponível (motivo simples, se houver) e agradeça.',
  '- sem_margem: diga com gentileza que no momento não há margem disponível e agradeça. Explique o motivo em linguagem simples (ex.: "CNPJ não se enquadra" = a empresa onde você trabalha não é atendida no momento). Não prometa avisar depois.')
where id = 'recepcao';

-- 7. ferramentas: chamar antes de responder; vendas registra a escolha na hora; PIX só depois da oferta escolhida
update credito.configuracoes set valor = to_jsonb((valor #>> '{}') || E'\n- FERRAMENTAS: quando a conversa pedir uma ação (consultar CPF, simular, registrar a oferta escolhida, registrar o PIX, criar a proposta, chamar humano), chame a ferramenta ANTES de responder. Nunca diga que registrou, consultou ou gerou algo sem ter chamado a ferramenta e recebido o resultado.'::text), atualizado_em = now()
where chave = 'regras_gerais' and (valor #>> '{}') not like '%- FERRAMENTAS:%';

update credito.setores set prompt = $t$ETAPA: VENDAS. O cliente já recebeu as OFERTAS. Ajude-o a escolher e fechar.
- Tire dúvidas em uma frase e contorne objeções com verdade, sem pressão falsa e sem prometer aprovação garantida.
- Se pedir outro prazo ou outra parcela, chame simular e mostre o resultado.
- ASSIM QUE o cliente disser qual oferta quer (ex.: "quero a 2", "a primeira", "a de 36x"), chame escolher_oferta com o número da oferta, na mesma hora. Sem essa ferramenta a escolha NÃO fica registrada.
- Depois que a ferramenta confirmar, repita valor e parcelas em uma frase e peça a chave PIX para receber.$t$ where id = 'vendas';

create or replace function credito.acao(p_lead int, p_acao text, p_dados jsonb default '{}'::jsonb) returns json language plpgsql as $$
declare r json; v_status text; v_oferta jsonb;
begin
  select status, oferta into v_status, v_oferta from credito.leads where id = p_lead;
  if p_acao = 'registrar_pix' and v_oferta is null then
    return json_build_object('ok', false, 'texto', 'A oferta ainda não foi registrada. Primeiro chame escolher_oferta com o número que o cliente escolheu.',
                             'setor', (select setor_id from credito.leads where id = p_lead));
  end if;
  r := credito.acao_agente(p_lead, p_acao, coalesce(p_dados, '{}'::jsonb));
  if p_acao = 'salvar_ofertas' and v_status in ('negociando') then update credito.leads set status = v_status where id = p_lead; end if;
  return (r::jsonb || jsonb_build_object('setor', (select setor_id from credito.leads where id = p_lead)))::json;
end $$;
