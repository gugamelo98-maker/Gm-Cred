-- Empresa virtual CLT — aba Financeiro: gastos (disparos de WhatsApp, tráfego pago, BMs, outros), lucro e retorno
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-10. Idempotente.
-- Painel: POST /escritorio/financeiro (k, acao = ver | salvar | apagar, mes = AAAA-MM, valor, data, categoria, descricao, id)
-- Receita do mês = comissão dos contratos PAGOS no mês. Lucro = receita − gastos. Clientes de teste não contam.

create table if not exists credito.gastos (
  id bigserial primary key,
  data date not null default (now() at time zone 'America/Sao_Paulo')::date,
  categoria text not null check (categoria in ('disparos', 'trafego', 'bms', 'outros')),
  valor numeric(12,2) not null check (valor > 0),
  descricao text,
  criado_em timestamptz not null default now());
create index if not exists gastos_data_idx on credito.gastos (data);

create or replace function credito.financeiro_api(k text, p_acao text, p_dados jsonb) returns json language plpgsql as $function$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_mes date; v_fim date; v_erro text; v_valor numeric; v_data date; v_cat text;
begin
  if not credito.validar_chave(k) then return null; end if;
  p_dados := coalesce(p_dados, '{}'::jsonb);
  if p_acao = 'salvar' then
    begin
      v_valor := round(nullif(p_dados->>'valor', '')::numeric, 2);
      v_data := coalesce(nullif(p_dados->>'data', '')::date, v_hoje);
      v_cat := lower(coalesce(p_dados->>'categoria', ''));
      if v_valor is null or v_valor <= 0 or v_valor > 10000000 then v_erro := 'Informe um valor maior que zero.';
      elsif v_cat not in ('disparos', 'trafego', 'bms', 'outros') then v_erro := 'Escolha a categoria.';
      elsif v_data > v_hoje + 1 or v_data < v_hoje - 800 then v_erro := 'Confira a data do gasto.';
      else insert into credito.gastos (data, categoria, valor, descricao) values (v_data, v_cat, v_valor, nullif(left(trim(coalesce(p_dados->>'descricao', '')), 200), ''));
      end if;
    exception when others then v_erro := 'Não consegui entender o valor ou a data.';
    end;
  elsif p_acao = 'apagar' then
    begin delete from credito.gastos where id = (p_dados->>'id')::bigint; exception when others then v_erro := 'Gasto não encontrado.'; end;
  end if;
  begin v_mes := date_trunc('month', (nullif(p_dados->>'mes', '') || '-01')::date)::date; exception when others then v_mes := null; end;
  v_mes := coalesce(v_mes, date_trunc('month', v_hoje)::date);
  v_fim := (v_mes + interval '1 month')::date;
  return json_build_object(
    'mes', to_char(v_mes, 'YYYY-MM'), 'hoje', v_hoje, 'erro', v_erro,
    'gastos', coalesce((select json_agg(json_build_object('id', g.id, 'data', g.data, 'categoria', g.categoria, 'valor', g.valor, 'descricao', g.descricao) order by g.data desc, g.id desc)
                         from credito.gastos g where g.data >= v_mes and g.data < v_fim), '[]'::json),
    'por_categoria', coalesce((select json_object_agg(categoria, total) from (select categoria, sum(valor) total from credito.gastos where data >= v_mes and data < v_fim group by 1) x), '{}'::json),
    'total_gastos', coalesce((select sum(valor) from credito.gastos where data >= v_mes and data < v_fim), 0),
    'receita', coalesce((select sum(comissao) from credito.contratos where etapa = 'pago' and (dt_pagamento at time zone 'America/Sao_Paulo')::date >= v_mes and (dt_pagamento at time zone 'America/Sao_Paulo')::date < v_fim), 0),
    'liberado', coalesce((select sum(valor_liberado) from credito.contratos where etapa = 'pago' and (dt_pagamento at time zone 'America/Sao_Paulo')::date >= v_mes and (dt_pagamento at time zone 'America/Sao_Paulo')::date < v_fim), 0),
    'contratos_pagos', (select count(*) from credito.contratos where etapa = 'pago' and (dt_pagamento at time zone 'America/Sao_Paulo')::date >= v_mes and (dt_pagamento at time zone 'America/Sao_Paulo')::date < v_fim),
    'prevista', coalesce((select sum(comissao) from credito.contratos where etapa in ('aguardando_formalizacao', 'formalizado')), 0),
    'clientes', (select count(*) from credito.leads where not coalesce(teste, false) and (criado_em at time zone 'America/Sao_Paulo')::date >= v_mes and (criado_em at time zone 'America/Sao_Paulo')::date < v_fim),
    'historico', (select json_agg(json_build_object('mes', to_char(m, 'YYYY-MM'),
          'receita', coalesce((select sum(comissao) from credito.contratos where etapa = 'pago' and (dt_pagamento at time zone 'America/Sao_Paulo')::date >= m and (dt_pagamento at time zone 'America/Sao_Paulo')::date < (m + interval '1 month')::date), 0),
          'gastos', coalesce((select sum(valor) from credito.gastos where data >= m and data < (m + interval '1 month')::date), 0)) order by m desc)
        from (select generate_series(date_trunc('month', v_hoje) - interval '5 months', date_trunc('month', v_hoje), interval '1 month')::date m) s));
end $function$;
