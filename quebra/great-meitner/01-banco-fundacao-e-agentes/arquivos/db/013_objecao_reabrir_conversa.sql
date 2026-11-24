-- Empresa virtual CLT — tentar contornar objeção antes de encerrar; cliente que volta reabre a mesma conversa
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-09. Idempotente.

-- 1. objeção antes de encerrar
update credito.configuracoes set valor = to_jsonb(replace(valor #>> '{}',
  '- Se o cliente disser claramente que não quer, agradeça com gentileza e use a ferramenta encerrar.',
  '- Se o cliente disser que não quer: NÃO encerre de primeira. Tente UMA vez, com empatia, entender o motivo e contornar com verdade (ex.: oferecer parcela menor ou outro prazo com simular, tirar a dúvida sobre segurança, lembrar que não tem custo antecipado). Só use encerrar se ele repetir que não quer depois dessa tentativa.')),
  atualizado_em = now()
where chave = 'regras_gerais';
update credito.setores set prompt = prompt || E'\n- Objeção ou "não quero": pergunte com leveza o que pesou (valor da parcela, prazo, insegurança) e ofereça um ajuste real (simular com parcela menor ou outro prazo). Encerre só se ele insistir.'
where id = 'vendas' and prompt not like '%Objeção ou "não quero"%';

-- 2. oferta inválida sem "1 a 0"
do $$ declare f text; begin
  f := pg_get_functiondef('credito.acao_agente(int,text,jsonb)'::regprocedure);
  f := replace(f, $x$'Número de oferta inválido. Ofertas disponíveis: 1 a ' || coalesce(jsonb_array_length(l.ofertas), 0)$x$,
                  $x$case when coalesce(jsonb_array_length(l.ofertas), 0) = 0 then 'Este cliente ainda não tem ofertas calculadas.' else 'Número de oferta inválido. Ofertas disponíveis: 1 a ' || jsonb_array_length(l.ofertas) || '. Se o cliente falou o prazo (ex.: 24x), use o número da oferta com esse prazo.' end$x$);
  execute f;
end $$;

-- 3. receber_mensagem: se o cliente encerrado (até 30 dias) volta a falar, reabre a mesma conversa na etapa em que estava,
--    com as ofertas, em vez de criar um cliente novo do zero. (versão completa aplicada no banco)
