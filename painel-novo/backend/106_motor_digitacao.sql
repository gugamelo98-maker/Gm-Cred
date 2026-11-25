-- 106 · Motor de crédito: digitação de contrato pela aba Motor (separado da Ana).
-- Fluxo n8n "[Motor] ✍️ Digitação" (POST /webhook/motor/digitar) usa estas funções.

alter table credito.motor_consultas add column if not exists digitacoes jsonb not null default '[]';

-- dados fictícios usados quando o banco pede e o cliente não precisa informar
insert into credito.configuracoes (chave, valor) values ('motor_digitacao', jsonb_build_object(
  'rg', '0000000', 'rg_orgao', 'SSP', 'rg_uf', 'SP', 'rg_emissao', '2015-01-10',
  'cep', '88049335', 'cidade', 'Florianópolis', 'uf', 'SC', 'bairro', 'Tapera da Base',
  'logradouro', 'Servidão Unidos', 'numero', '654', 'complemento', '-',
  'estado_civil', 'Solteiro', 'escolaridade', 'Ensino médio completo', 'pai', 'NÃO CONSTA',
  'rh_email', 'rh@gmail.com', 'rh_telefone_fim', '33224455',
  'hub_cpf_atendente', '86350528034',
  'renda', 3000, 'ocupacao', 5, 'cargo', 'Auxiliar', 'empresa', 'Não informado'))
on conflict (chave) do update set valor = excluded.valor;

-- contexto da digitação: valida a chave e entrega consulta, tokens e configurações
create or replace function credito.motor_digitar_ctx(k text, p_id bigint) returns jsonb language plpgsql as $$
declare c credito.motor_consultas%rowtype;
begin
  if not credito.validar_chave(k) then return jsonb_build_object('ok', false, 'codigo', 401, 'erro', 'sem acesso'); end if;
  select * into c from credito.motor_consultas where id = p_id;
  if c.id is null then return jsonb_build_object('ok', false, 'codigo', 404, 'erro', 'consulta não encontrada'); end if;
  return jsonb_build_object('ok', true, 'id', c.id, 'cpf', c.cpf, 'cliente', c.cliente, 'partes', c.partes,
    'ficticio', (select valor from credito.configuracoes where chave = 'motor_digitacao'),
    'tokens', jsonb_build_object(
      'hub', (select token from credito.motor_tokens where nome = 'hub' and expira_em > now()),
      'unno', (select token from credito.motor_tokens where nome = 'unno' and expira_em > now()),
      'v8_fgts', (select token from credito.motor_tokens where nome = 'v8_fgts' and expira_em > now()),
      'v8_clt', (select token from credito.v8_token where id = 1 and expira_em > now() + interval '2 minutes')),
    'cfg', jsonb_build_object(
      'hub_loja', coalesce((select (valor->>'loja_id')::int from credito.configuracoes where chave = 'hub_fgts'), 9562),
      'unno_base', (select valor->>'base' from credito.configuracoes where chave = 'unno')));
end $$;

-- guarda cada tentativa (prévia ou envio) na consulta
create or replace function credito.motor_digitacao_salvar(p_id bigint, r jsonb) returns jsonb language plpgsql as $$
begin
  update credito.motor_consultas set digitacoes = digitacoes || jsonb_build_array(r || jsonb_build_object('em', now())), atualizado_em = now() where id = p_id;
  return r;
end $$;
