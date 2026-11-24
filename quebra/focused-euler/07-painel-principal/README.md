# 07-painel-principal — Painel · escritorio/index.html em fragmentos

O painel do dono (`escritorio/index.html`, um arquivo só com HTML, CSS e JS, sem build). Ele foi cortado nas marcações que já existiam: cabeçalho, CSS, topo e menu, uma tela por fragmento (`tela-*`) e uma seção do JavaScript por fragmento (`js-*`, as seções `// ═══ NOME ═══` do código). Fala com o n8n em `BASE/webhook/escritorio/*`.

## `escritorio/index.html` em 41 fragmentos

Juntando os fragmentos nesta ordem, o arquivo volta a ser idêntico ao original.

| Fragmento | Linhas no original | O que é |
|---|---|---|
| `01-cabecalho.html` | 1–13 | `<head>`: metadados, fontes, ícones e tema escuro salvo |
| `02-estilo.css` | 14–707 | Todo o CSS da página |
| `03-corpo.html` | 708–777 | Topo, barra de saúde/conexão, menu (desktop, celular e "Mais") e submenus |
| `04-tela-escritorio.html` | 778–790 | Tela **Escritório** (salas com os agentes, "precisa da sua atenção", clientes no escritório) |
| `05-tela-clientes.html` | 791–800 | Tela **Clientes** (CRM) |
| `06-tela-agentes.html` | 801–809 | Tela **Agentes** (versões A/B/C e placar) |
| `07-tela-indicacoes.html` | 810–817 | Tela **Indicações** (programa de indicação) |
| `08-tela-conversas.html` | 818–824 | Tela **Conversas** (atender o cliente pelo painel) |
| `09-tela-numeros.html` | 825–825 | Tela **Números** (chips de WhatsApp, status, QR) |
| `10-tela-maturador.html` | 826–827 | Tela **Maturador** (aquecimento dos chips) |
| `11-tela-campanha.html` | 828–852 | Tela **Campanha** (a IA chama a base importada) |
| `12-tela-disparo.html` | 853–859 | Tela **Disparo** (rodadas de disparo pelos chips) |
| `13-tela-oficial.html` | 860–866 | Tela **API oficial** (disparo por mensagem modelo da Meta) |
| `14-tela-hoje.html` | 867–871 | Tela **Início** (resumo do dia, produção CLT e FGTS) |
| `15-tela-mes.html` | 872–885 | Tela **Vendas** (vendas por dia, crescimento e projeção) |
| `16-tela-funil.html` | 886–889 | Tela **Funil** (por período) |
| `17-tela-financeiro.html` | 890–910 | Tela **Financeiro** (gastos, lucro e retorno) |
| `18-tela-v8.html` | 911–942 | Tela **Consulta V8 / Unno / HUB** (margem e simulação) |
| `19-tela-simulacao.html` | 943–969 | Tela **Simulação** (simulador "e se…") e tela da chave de acesso |
| `20-script.js` | 970–970 | Abertura do `<script>` |
| `21-js-config.js` | 971–996 | Configuração: endpoint do n8n, token de sessão, intervalos de atualização, rótulos e visual dos agentes |
| `22-js-util.js` | 997–1010 | Funções utilitárias (formatar R$, datas, escapar HTML) |
| `23-js-pessoas-em-vetor.js` | 1011–1084 | Desenho SVG dos agentes (pele, cabelo, roupa) |
| `24-js-cenario-de-cada-sala.js` | 1085–1117 | Desenho SVG de cada sala |
| `25-js-modo-demo-dados-ficticios-no-mesmo-forma.js` | 1118–1238 | Modo demonstração (dados fictícios no formato da API) |
| `26-js-busca-de-dados.js` | 1239–1275 | Busca do estado no n8n (`/escritorio/estado`) a cada minuto |
| `27-js-renderizacao.js` | 1276–1323 | Desenha o escritório e as salas |
| `28-js-atencao-funil-e-saude.js` | 1324–1355 | "Precisa da sua atenção", funil e saúde do sistema |
| `29-js-vendas-por-dia-grafico-crescimento-e-pro.js` | 1356–1430 | Gráfico de vendas por dia, crescimento e projeção |
| `30-js-simulacao.js` | 1431–1479 | Simulador "e se…" |
| `31-js-agentes-versoes-a-b-c.js` | 1480–1546 | Aba Agentes (versões A/B/C) |
| `32-js-financeiro-gastos-lucro-e-retorno.js` | 1547–1615 | Aba Financeiro |
| `33-js-campanha-a-ia-chama-os-clientes-importad.js` | 1616–1810 | Campanha (importar base, editor da mensagem, placar), e também Conversas (`cv*`), Números (`nm*`) e Indicações (`in*`) |
| `34-js-disparo.js` | 1811–1918 | Aba Disparo |
| `35-js-api-oficial-mensagem-modelo-da-meta.js` | 1919–2021 | Aba API oficial (Meta) |
| `36-js-ficha-do-cliente-e-acoes.js` | 2022–2059 | Ficha do cliente e ações (`/escritorio/acao`) |
| `37-js-comissao-e-meta.js` | 2060–2137 | Comissão e meta diária |
| `38-js-clientes-cadastro-crm.js` | 2138–2232 | Aba Clientes (CRM) |
| `39-js-gaveta-detalhes.js` | 2233–2274 | Gaveta lateral de detalhes |
| `40-js-inicio.js` | 2275–2437 | Inicialização, tema, menu "Mais", navegação (`irPara`) e a Consulta V8/Unno/HUB (`v8*`, `unno*`, melhor proposta por comissão) |
| `41-rodape.html` | 2438–2439 | Fechamento do `</script>` / `</body></html>` |
