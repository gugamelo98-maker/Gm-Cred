-- 113 · Conversas: iniciar conversa por número (acha o cliente pelo telefone ou cria). O envio é feito por /escritorio/atendimento.
-- Clientes/Conversas/Pipeline passaram a mostrar toda a base (sem o corte de 'painel_novo_inicio', ver 109).
create or replace function credito.painel_nova_conversa(u credito.painel_usuarios, p jsonb) returns jsonb language plpgsql as $f$
declare v_tel text := regexp_replace(coalesce(p->>'telefone', ''), '\D', '', 'g'); l credito.leads; v_inst text;
begin
  if length(v_tel) in (10, 11) then v_tel := '55' || v_tel; end if;
  if length(v_tel) not in (12, 13) then return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'Telefone inválido. Use DDD + número.'); end if;
  -- número conectado: o do colaborador, senão o de atendimento
  select nome into v_inst from credito.wpp_chips where painel_dono = u.id and estado = 'open' and not coalesce(oculto, false) limit 1;
  if v_inst is null then select nome into v_inst from credito.wpp_chips where funcao = 'atendimento' and estado = 'open' and not coalesce(oculto, false) limit 1; end if;
  select * into l from credito.leads where right(regexp_replace(telefone, '\D', '', 'g'), 10) = right(v_tel, 10) order by atualizado_em desc nulls last limit 1;
  if l.id is null then
    insert into credito.leads (nome, telefone, produto, status, origem, canal, aguardando, instancia, painel_responsavel, setor_id, criado_em, atualizado_em)
    values (nullif(trim(coalesce(p->>'nome', '')), ''), v_tel, 'clt', 'respondeu', 'painel', 'whatsapp', 'humano', v_inst, u.id, 'recepcao', now(), now())
    returning * into l;
  else
    update credito.leads set nome = coalesce(nullif(trim(coalesce(p->>'nome', '')), ''), nome), aguardando = 'humano', humano_em = now(),
           painel_responsavel = coalesce(painel_responsavel, u.id), finalizado_em = null,
           instancia = case when exists (select 1 from credito.wpp_chips c where c.nome = credito.leads.instancia and c.estado = 'open') then instancia else coalesce(v_inst, instancia) end,
           painel_etapa = case when painel_etapa = 'perdido' then null else painel_etapa end
     where id = l.id returning * into l;
  end if;
  return jsonb_build_object('ok', true, 'cliente', credito.painel_cliente(l));
end $f$;
