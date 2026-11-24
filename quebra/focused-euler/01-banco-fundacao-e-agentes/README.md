# 01-banco-fundacao-e-agentes — Banco · fundação, agentes e conversa (001–022)

Estrutura base do Postgres (schema `credito`): setores do escritório virtual (Recepção, Simulação, Vendas, Formalização, Pós-venda, Gerente), leads, comissão e meta, sessões de acesso, os 3 agentes por setor (teste A/B/C), o roteador de mensagens, os prompts e a máquina de estados do cliente, e as regras de seguro, objeção, recuperação e parcela por prazo. `zerar_escritorio.sql` é um utilitário para zerar tudo (só quando o dono pedir).

| Arquivo | O que é |
|---|---|
| `db/001_empresa_virtual.sql` | Empresa virtual CLT & FGTS — estrutura base (Fase 1) |
| `db/002_comissao_e_meta.sql` | Empresa virtual CLT — comissão (V8 · CLT Acelera · Venda Digital) e meta diária |
| `db/003_atencao_ficha_funil_saude.sql` | Empresa virtual CLT — "precisa da sua atenção", ficha do cliente, funil, saúde do sistema e chave de acesso |
| `db/004_sessoes_vendas_diarias_ajustes.sql` | Empresa virtual CLT — sessões de acesso, vendas por dia e ajustes de textos/cores |
| `db/005_agentes_ab_v8.sql` | Empresa virtual CLT — 3 agentes por setor (teste A/B/C), sorteio fixo por cliente, cache do token V8 e respostas prontas |
| `db/006_roteador_chat_teste.sql` | Empresa virtual CLT — roteador de mensagens, chat de teste e configurações |
| `db/007_agentes_logica.sql` | Empresa virtual CLT — lógica dos agentes: prompts, contexto, ações e máquina de estados do cliente |
| `db/008_ajustes_agentes_placar.sql` | Empresa virtual CLT — ajustes depois dos primeiros testes dos agentes + placar A/B/C |
| `db/009_propostas_reais_no_teste.sql` | Empresa virtual CLT — chat de teste cria propostas REAIS na V8 (com dados de contato e cadastro de mentirinha) |
| `db/010_sem_ofertas_humano_apresentacao.sql` | Empresa virtual CLT — simulação sem ofertas chama um especialista de verdade; apresentação da Ana sem "assistente virtual" |
| `db/011_sem_repeticao_consulta_andamento.sql` | Empresa virtual CLT — consulta em andamento sem reconsultar e sem repetir mensagens |
| `db/012_pix_ofertas_eventos.sql` | Empresa virtual CLT — ofertas só com valor/prazo/parcela, PIX "no nome do cliente", simular eventos na proposta real de teste |
| `db/013_objecao_reabrir_conversa.sql` | Empresa virtual CLT — tentar contornar objeção antes de encerrar; cliente que volta reabre a mesma conversa |
| `db/014_seguro_primeiro.sql` | Empresa virtual CLT — ofertas COM seguro por padrão; sem seguro só como último recurso |
| `db/015_objecao_em_etapas.sql` | Empresa virtual CLT — objeção em etapas; "condição melhor" (sem seguro) só como último dos últimos recursos |
| `db/016_recuperacao_5_10_30.sql` | Empresa virtual CLT — recuperação em 3 tentativas: 5, 10 e 30 minutos depois da última mensagem do cliente |
| `db/017_agrupar_mensagens.sql` | Empresa virtual CLT — mensagens em sequência do cliente: uma resposta só, entendendo todas |
| `db/018_seguro_pergunta_falha_modelo.sql` | Empresa virtual CLT — pergunta sobre seguro não libera a tabela sem seguro; falha do modelo sem mensagem estranha |
| `db/019_testes_estresse.sql` | Empresa virtual CLT — ajustes depois da bateria de testes de estresse (testes/estresse.py) |
| `db/020_apresentacao_simulacao_2a_rodada.sql` | Empresa virtual CLT — Ana nunca fala que é assistente virtual/robô; simulação tenta outras parcelas e prazos |
| `db/021_parcela_maxima_por_prazo.sql` | Empresa virtual CLT — simulação respeita a parcela máxima que a V8 libera em cada prazo |
| `db/022_limites_por_prazo_na_conversa.sql` | Empresa virtual CLT — a IA conhece a parcela máxima por prazo e confere a oferta escolhida |
| `db/zerar_escritorio.sql` | ZERAR O ESCRITÓRIO VIRTUAL (rodar só quando o dono pedir, antes de ligar os números de WhatsApp) |
