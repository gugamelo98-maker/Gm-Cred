# 08-paginas-extras — Painel · páginas extras (chat de teste, FGTS, pixel, assinatura demo)

Páginas avulsas do painel, cortadas do mesmo jeito: `chat.html` (chat de teste com a IA), `fgts.html` (robô FGTS Lotus/HUB em fila), `pixel.html` (versão do escritório em pixel art/canvas) e `assinar-demo.html` (assinatura de demonstração).

| Arquivo | O que é |
|---|---|
| `escritorio/assinar-demo.html` | Assinatura de demonstração |

## `escritorio/chat.html` em 5 fragmentos

Juntando os fragmentos nesta ordem, o arquivo volta a ser idêntico ao original.

| Fragmento | Linhas no original | O que é |
|---|---|---|
| `01-cabecalho.html` | 1–7 | `<head>`: metadados, fontes, ícones e tema escuro salvo |
| `02-estilo.css` | 8–117 | Todo o CSS da página |
| `03-corpo.html` | 118–178 | Topo, barra de saúde/conexão, menu (desktop, celular e "Mais") e submenus |
| `04-script.js` | 179–432 | Abertura do `<script>` |
| `05-rodape.html` | 433–434 | Fechamento do `</script>` / `</body></html>` |

## `escritorio/fgts.html` em 5 fragmentos

Juntando os fragmentos nesta ordem, o arquivo volta a ser idêntico ao original.

| Fragmento | Linhas no original | O que é |
|---|---|---|
| `01-cabecalho.html` | 1–7 | `<head>`: metadados, fontes, ícones e tema escuro salvo |
| `02-estilo.css` | 8–39 | Todo o CSS da página |
| `03-corpo.html` | 40–125 | Topo, barra de saúde/conexão, menu (desktop, celular e "Mais") e submenus |
| `04-script.js` | 126–328 | Abertura do `<script>` |
| `05-rodape.html` | 329–330 | Fechamento do `</script>` / `</body></html>` |

## `escritorio/pixel.html` em 12 fragmentos

Juntando os fragmentos nesta ordem, o arquivo volta a ser idêntico ao original.

| Fragmento | Linhas no original | O que é |
|---|---|---|
| `01-cabecalho.html` | 1–7 | `<head>`: metadados, fontes, ícones e tema escuro salvo |
| `02-estilo.css` | 8–65 | Todo o CSS da página |
| `03-corpo.html` | 66–95 | Topo, barra de saúde/conexão, menu (desktop, celular e "Mais") e submenus |
| `04-script.js` | 96–96 | Abertura do `<script>` |
| `05-js-config.js` | 97–108 | Configuração: endpoint do n8n, token de sessão, intervalos de atualização, rótulos e visual dos agentes |
| `06-js-estado.js` | 109–121 | Estado da página |
| `07-js-modo-demo-dados-ficticios-no-mesmo-forma.js` | 122–168 | Modo demonstração (dados fictícios no formato da API) |
| `08-js-busca-de-dados.js` | 169–205 | Busca do estado no n8n (`/escritorio/estado`) a cada minuto |
| `09-js-sidebar.js` | 206–221 | Barra lateral |
| `10-js-paineis.js` | 222–265 | Painéis de informação |
| `11-js-canvas.js` | 266–464 | Desenho do escritório no canvas |
| `12-rodape.html` | 465–466 | Fechamento do `</script>` / `</body></html>` |
