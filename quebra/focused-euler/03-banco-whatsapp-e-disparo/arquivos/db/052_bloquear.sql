-- 052: botão BLOQUEAR. Cliente que manda só "BLOQUEAR" (toque no botão) é encerrado como
-- "não contatar · clicou em bloquear": número vai para numeros_bloqueados (gatilho fn_bloquear_numero),
-- sai das listas e o atendimento fecha. A Ana recebe a mensagem já com o cliente marcado como
-- "não quer continuar" e só se despede.
create or replace function credito.clicou_bloquear(p_lead int, p_texto text) returns void language plpgsql as $$
begin
  if lower(regexp_replace(coalesce(p_texto, ''), '[^[:alpha:]]', '', 'g')) <> 'bloquear' then return; end if;
  update credito.leads set status = 'parou', motivo_parada = 'não contatar · clicou em bloquear', nao_contatar = true, recuperacoes = greatest(recuperacoes, 1)
   where id = p_lead;
  update credito.atribuicoes set resultado = 'perdeu', fim = now() where lead_id = p_lead and fim is null;
end $$;
-- chamado em receber_wpp_v2, logo depois de marcar_origem
