# 07-painel-principal — Painel · escritorio/index.html em fragmentos

O painel do dono (`escritorio/index.html`, um arquivo só com HTML, CSS e JS, sem build). Ele foi cortado nas marcações que já existiam: cabeçalho, CSS, topo e menu, uma tela por fragmento (`tela-*`) e uma seção do JavaScript por fragmento (`js-*`, as seções `// ═══ NOME ═══` do código). Fala com o n8n em `BASE/webhook/escritorio/*`.

## `escritorio/index.html` em 44 fragmentos

Juntando os fragmentos nesta ordem, o arquivo volta a ser idêntico ao original.

| Fragmento | Linhas no original | O que é |
|---|---|---|
| `01-cabecalho.html` | 1–13 | `<head>`: metadados, fontes, ícones e tema escuro salvo |
| `02-estilo.css` | 14–743 | Todo o CSS da página |
| `03-corpo.html` | 744–816 | Topo, barra de saúde/conexão, menu (desktop, celular e "Mais") e submenus |
| `04-tela-escritorio.html` | 817–829 | Tela **Escritório** (salas com os agentes, "precisa da sua atenção", clientes no escritório) |
| `05-tela-clientes.html` | 830–839 | Tela **Clientes** (CRM) |
| `06-tela-agentes.html` | 840–848 | Tela **Agentes** (versões A/B/C e placar) |
| `07-tela-indicacoes.html` | 849–856 | Tela **Indicações** (programa de indicação) |
| `08-tela-conversas.html` | 857–863 | Tela **Conversas** (atender o cliente pelo painel) |
| `09-tela-numeros.html` | 864–864 | Tela **Números** (chips de WhatsApp, status, QR) |
| `10-tela-maturador.html` | 865–866 | Tela **Maturador** (aquecimento dos chips) |
| `11-tela-campanha.html` | 867–891 | Tela **Campanha** (a IA chama a base importada) |
| `12-tela-disparo.html` | 892–898 | Tela **Disparo** (rodadas de disparo pelos chips) |
| `13-tela-oficial.html` | 899–905 | Tela **API oficial** (disparo por mensagem modelo da Meta) |
| `14-tela-pipeline.html` | 906–907 | Tela **Pipeline** (kanban por etapa) |
| `15-tela-bms.html` | 908–917 | Tela **Configurações › BMs Meta** |
| `16-tela-hoje.html` | 918–922 | Tela **Início** (resumo do dia, produção CLT e FGTS) |
| `17-tela-mes.html` | 923–936 | Tela **Vendas** (vendas por dia, crescimento e projeção) |
| `18-tela-funil.html` | 937–940 | Tela **Funil** (por período) |
| `19-tela-financeiro.html` | 941–961 | Tela **Financeiro** (gastos, lucro e retorno) |
| `20-tela-links.html` | 962–970 | Tela **Links** (Extrair, Telefones e FGTS) |
| `21-tela-v8.html` | 971–1018 | Tela **Consulta V8 / Unno / HUB** (margem e simulação) |
| `22-tela-simulacao.html` | 1019–1045 | Tela **Simulação** (simulador "e se…") e tela da chave de acesso |
| `23-script.js` | 1046–1046 | Abertura do `<script>` |
| `24-js-config.js` | 1047–1072 | Configuração: endpoint do n8n, token de sessão, intervalos de atualização, rótulos e visual dos agentes |
| `25-js-util.js` | 1073–1086 | Funções utilitárias (formatar R$, datas, escapar HTML) |
| `26-js-pessoas-em-vetor.js` | 1087–1160 | Desenho SVG dos agentes (pele, cabelo, roupa) |
| `27-js-cenario-de-cada-sala.js` | 1161–1193 | Desenho SVG de cada sala |
| `28-js-modo-demo-dados-ficticios-no-mesmo-forma.js` | 1194–1314 | Modo demonstração (dados fictícios no formato da API) |
| `29-js-busca-de-dados.js` | 1315–1351 | Busca do estado no n8n (`/escritorio/estado`) a cada minuto |
| `30-js-renderizacao.js` | 1352–1399 | Desenha o escritório e as salas |
| `31-js-atencao-funil-e-saude.js` | 1400–1452 | "Precisa da sua atenção", funil e saúde do sistema |
| `32-js-vendas-por-dia-grafico-crescimento-e-pro.js` | 1453–1527 | Gráfico de vendas por dia, crescimento e projeção |
| `33-js-simulacao.js` | 1528–1576 | Simulador "e se…" |
| `34-js-agentes-versoes-a-b-c.js` | 1577–1643 | Aba Agentes (versões A/B/C) |
| `35-js-financeiro-gastos-lucro-e-retorno.js` | 1644–1712 | Aba Financeiro |
| `36-js-campanha-a-ia-chama-os-clientes-importad.js` | 1713–1907 | Campanha (importar base, editor da mensagem, placar), e também Conversas (`cv*`), Números (`nm*`) e Indicações (`in*`) |
| `37-js-disparo.js` | 1908–2034 | Aba Disparo |
| `38-js-api-oficial-mensagem-modelo-da-meta.js` | 2035–2192 | Aba API oficial (Meta) |
| `39-js-ficha-do-cliente-e-acoes.js` | 2193–2244 | Ficha do cliente e ações (`/escritorio/acao`) |
| `40-js-comissao-e-meta.js` | 2245–2326 | Comissão e meta diária |
| `41-js-clientes-cadastro-crm.js` | 2327–2421 | Aba Clientes (CRM) |
| `42-js-gaveta-detalhes.js` | 2422–2463 | Gaveta lateral de detalhes |
| `43-js-inicio.js` | 2464–2775 | Inicialização, tema, menu "Mais", navegação (`irPara`) e a Consulta V8/Unno/HUB (`v8*`, `unno*`, melhor proposta por comissão) |
| `44-rodape.html` | 2776–2777 | Fechamento do `</script>` / `</body></html>` |
