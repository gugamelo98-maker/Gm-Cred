# 07-painel-principal — Painel · escritorio/index.html em fragmentos

O painel do dono (`escritorio/index.html`, um arquivo só com HTML, CSS e JS, sem build). Ele foi cortado nas marcações que já existiam: cabeçalho, CSS, topo e menu, uma tela por fragmento (`tela-*`) e uma seção do JavaScript por fragmento (`js-*`, as seções `// ═══ NOME ═══` do código). Fala com o n8n em `BASE/webhook/escritorio/*`.

## `escritorio/index.html` em 35 fragmentos

Juntando os fragmentos nesta ordem, o arquivo volta a ser idêntico ao original.

| Fragmento | Linhas no original | O que é |
|---|---|---|
| `01-cabecalho.html` | 1–8 | `<head>`: metadados, fontes, ícones e tema escuro salvo |
| `02-estilo.css` | 9–520 | Todo o CSS da página |
| `03-corpo.html` | 521–576 | Topo, barra de saúde/conexão, menu (desktop, celular e "Mais") e submenus |
| `04-tela-escritorio.html` | 577–589 | Tela **Escritório** (salas com os agentes, "precisa da sua atenção", clientes no escritório) |
| `05-tela-clientes.html` | 590–599 | Tela **Clientes** (CRM) |
| `06-tela-agentes.html` | 600–608 | Tela **Agentes** (versões A/B/C e placar) |
| `07-tela-conversas.html` | 609–615 | Tela **Conversas** (atender o cliente pelo painel) |
| `08-tela-numeros.html` | 616–616 | Tela **Números** (chips de WhatsApp, status, QR) |
| `09-tela-maturador.html` | 617–618 | Tela **Maturador** (aquecimento dos chips) |
| `10-tela-campanha.html` | 619–639 | Tela **Campanha** (a IA chama a base importada) |
| `11-tela-hoje.html` | 640–644 | Tela **Início** (resumo do dia, produção CLT e FGTS) |
| `12-tela-mes.html` | 645–658 | Tela **Vendas** (vendas por dia, crescimento e projeção) |
| `13-tela-funil.html` | 659–662 | Tela **Funil** (por período) |
| `14-tela-financeiro.html` | 663–683 | Tela **Financeiro** (gastos, lucro e retorno) |
| `15-tela-simulacao.html` | 684–709 | Tela **Simulação** (simulador "e se…") e tela da chave de acesso |
| `16-script.js` | 710–710 | Abertura do `<script>` |
| `17-js-config.js` | 711–736 | Configuração: endpoint do n8n, token de sessão, intervalos de atualização, rótulos e visual dos agentes |
| `18-js-util.js` | 737–750 | Funções utilitárias (formatar R$, datas, escapar HTML) |
| `19-js-pessoas-em-vetor.js` | 751–824 | Desenho SVG dos agentes (pele, cabelo, roupa) |
| `20-js-cenario-de-cada-sala.js` | 825–857 | Desenho SVG de cada sala |
| `21-js-modo-demo-dados-ficticios-no-mesmo-forma.js` | 858–978 | Modo demonstração (dados fictícios no formato da API) |
| `22-js-busca-de-dados.js` | 979–1015 | Busca do estado no n8n (`/escritorio/estado`) a cada minuto |
| `23-js-renderizacao.js` | 1016–1063 | Desenha o escritório e as salas |
| `24-js-atencao-funil-e-saude.js` | 1064–1095 | "Precisa da sua atenção", funil e saúde do sistema |
| `25-js-vendas-por-dia-grafico-crescimento-e-pro.js` | 1096–1170 | Gráfico de vendas por dia, crescimento e projeção |
| `26-js-simulacao.js` | 1171–1219 | Simulador "e se…" |
| `27-js-agentes-versoes-a-b-c.js` | 1220–1286 | Aba Agentes (versões A/B/C) |
| `28-js-financeiro-gastos-lucro-e-retorno.js` | 1287–1355 | Aba Financeiro |
| `29-js-campanha-a-ia-chama-os-clientes-importad.js` | 1356–1468 | Campanha (importar base, editor da mensagem, placar), e também Conversas (`cv*`), Números (`nm*`) e Indicações (`in*`) |
| `30-js-ficha-do-cliente-e-acoes.js` | 1469–1506 | Ficha do cliente e ações (`/escritorio/acao`) |
| `31-js-comissao-e-meta.js` | 1507–1584 | Comissão e meta diária |
| `32-js-clientes-cadastro-crm.js` | 1585–1679 | Aba Clientes (CRM) |
| `33-js-gaveta-detalhes.js` | 1680–1721 | Gaveta lateral de detalhes |
| `34-js-inicio.js` | 1722–1746 | Inicialização, tema, menu "Mais", navegação (`irPara`) e a Consulta V8/Unno/HUB (`v8*`, `unno*`, melhor proposta por comissão) |
| `35-rodape.html` | 1747–1748 | Fechamento do `</script>` / `</body></html>` |
