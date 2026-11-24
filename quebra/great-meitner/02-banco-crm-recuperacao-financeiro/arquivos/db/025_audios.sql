-- Empresa virtual CLT — áudios do cliente
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-10. Idempotente.
-- No n8n (GM Cred · Roteador): se a mensagem tem "audio" (base64) + "audio_mime", vira arquivo (Convert to File),
-- é transcrita pelo Groq (whisper-large-v3-turbo, pt, verbose_json; credencial groq_akampa, a mesma da IA do Akampa)
-- e entra como texto "🎤 ...". Trechos sem fala (no_speech_prob alto) e alucinações típicas em ruído ("Obrigado.")
-- são descartados: nesse caso a mensagem vira "🎤 (áudio que não deu para entender)".
-- Para o WhatsApp: baixar o áudio (Evolution getBase64FromMediaMessage) e mandar no mesmo campo "audio".

update credito.configuracoes set valor = to_jsonb((valor #>> '{}') || E'\n- ÁUDIOS: mensagens que começam com 🎤 são áudios do cliente já transcritos. Responda normalmente ao conteúdo, sem comentar que era áudio. Se vier "🎤 (áudio que não deu para entender)", peça com naturalidade para ele mandar por escrito (ex.: "Não consegui ouvir direito aqui, pode me mandar por escrito? 😊"). Nunca fale em erro ou transcrição.'::text), atualizado_em = now()
where chave = 'regras_gerais' and (valor #>> '{}') not like '%- ÁUDIOS:%';
