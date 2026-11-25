-- 114 · Chave geral da IA (botão no painel, só admin). Desligada: credito.receber_wpp_v2 devolve responder=false para todos.
insert into credito.configuracoes (chave, valor) values ('ia_geral', '{"ligada": true}'::jsonb) on conflict (chave) do nothing;

create or replace function credito.ia_ligada() returns boolean language sql stable as $$
  select coalesce((select (valor->>'ligada')::boolean from credito.configuracoes where chave = 'ia_geral'), true)
$$;

-- aplicado em credito.receber_wpp_v2, logo antes do "return r;" final:
--   if not credito.ia_ligada() then r := jsonb_set(r::jsonb, '{responder}', 'false'::jsonb)::json; end if;

create or replace function credito.painel_ia(k text, p jsonb) returns jsonb language plpgsql as $f$
declare u credito.painel_usuarios := credito.painel_sessao(k);
begin
  if u.id is null then return jsonb_build_object('ok', false, 'codigo', 401, 'erro', 'Sessão expirada. Entre de novo.'); end if;
  if p ? 'ligada' then
    if u.papel <> 'admin' then return jsonb_build_object('ok', false, 'codigo', 403, 'erro', 'Só o administrador liga ou desliga a IA.'); end if;
    insert into credito.configuracoes (chave, valor) values ('ia_geral', jsonb_build_object('ligada', (p->>'ligada')::boolean, 'por', u.id, 'em', now()))
    on conflict (chave) do update set valor = excluded.valor;
  end if;
  return jsonb_build_object('ok', true, 'ligada', credito.ia_ligada());
end $f$;
-- painel_dados_api: acao 'ia' -> credito.painel_ia(k, p)
