-- 103 · Receber foto do cliente no WhatsApp (aplicado em 24/11/2026)
--
-- Antes: o fluxo "GM Cred · WhatsApp (entrada)" guardava só a legenda da foto;
-- foto sem legenda ficava com texto vazio e era descartada, e a imagem nunca era salva.
--
-- n8n "GM Cred · WhatsApp (entrada)" (pbkzHfNxi7QG9tWh), versão 68342e86
-- (a anterior, 78bb42a1, continua no histórico do n8n para voltar se precisar):
--   É áudio do cliente? (não) → É foto do cliente? → Baixar foto (do servidor Baileys, igual ao áudio)
--   → Foto em base64 → Guardar foto (insert em credito.midias) → Texto da foto ("📷 Foto: legenda")
--   → Mensagem → Receber (agora chama também credito.anexar_midia).
--   O nó Mensagem passou a levar "midia" e trata foto sem legenda como "📷 Foto".
--   Áudio (transcrição pela Groq) e texto: sem mudança.
--
-- A mensagem fica em credito.conversas com tipo = 'imagem' e extra = {"midia_id": N}.
-- A imagem fica em credito.midias (mime, dados); credito.midia(id) devolve em base64.

create or replace function credito.anexar_midia(p_r json, p_midia int, p_tipo text default 'imagem')
returns void language plpgsql as $$
declare v_msg bigint; v_lead int;
begin
  if coalesce(p_midia, 0) <= 0 or p_r is null then return; end if;
  v_lead := nullif(p_r->'lead'->>'id', '')::int;
  v_msg := nullif(p_r->>'msg_id', '')::bigint;
  if v_msg is null and v_lead is not null then
    select max(id) into v_msg from credito.conversas where lead_id = v_lead and direcao = 'entrada' and criado_em > now() - interval '10 minutes';
  end if;
  if v_msg is null then return; end if;
  update credito.conversas
     set tipo = p_tipo, extra = coalesce(extra, '{}'::jsonb) || jsonb_build_object('midia_id', p_midia)
   where id = v_msg;
end $$;
