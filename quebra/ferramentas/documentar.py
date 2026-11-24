"""Gera os README.md de cada parte e de cada branch (chamado pelo quebrar.py)."""
import os, re

PARTE = {
    "01-banco-fundacao-e-agentes": "Estrutura base do Postgres (schema `credito`): setores do escritório virtual (Recepção, Simulação, Vendas, Formalização, Pós-venda, Gerente), leads, comissão e meta, sessões de acesso, os 3 agentes por setor (teste A/B/C), o roteador de mensagens, os prompts e a máquina de estados do cliente, e as regras de seguro, objeção, recuperação e parcela por prazo. `zerar_escritorio.sql` é um utilitário para zerar tudo (só quando o dono pedir).",
    "02-banco-crm-recuperacao-financeiro": "CRM de clientes, dados dos agentes para o painel, áudios, recuperação pelos gerentes, Financeiro (gastos, lucro e retorno), Campanha (a IA chama a base importada), prospecção, etiquetas, grupo \"Com margem\" e o Resumo do painel.",
    "03-banco-whatsapp-e-disparo": "Vários números de WhatsApp (status, QR, maturador, reserva), aba Conversas (atender pelo painel), avisos no grupo, follow-up, indicações, status de entrega, WAHA, botões, Disparo (rodadas, teste A/B, duplicar, {margem}), rotador de links (redirect1 → n8n → wa.me) e API oficial da Meta.",
    "04-banco-regras-da-ana": "Ajustes finos da atendente IA \"Ana\": silêncio, prazo e PIX, menos emoji, parcela de R$300, trava de valor (nunca inventar valor), maior prazo, Consulta V8 no painel, envio pelo WAHA, frase para pedir o CPF, abertura e recusa.",
    "05-banco-fgts-hub-unno": "Produtos novos: FGTS pela Lotus e pela HUB (BMP/J17), higienização em fila, link do FGTS com passagem para humano, e a Unno como segundo banco do CLT (`banco_escolhido`).",
    "06-n8n-fluxos": "Fluxos do n8n (Cloudfy) escritos com o `@n8n/workflow-sdk`. Os `gerar_*.js` são os geradores: o SDK não aceita funções auxiliares, então eles \"achatam\" o código e geram os fluxos prontos (`roteador.js`, `agente.js`, `acoes.js`, `v8_ferramentas.js`, `acompanhamento.js`). Quase toda a regra de negócio fica em funções do Postgres (`credito.*`); o n8n chama essas funções, o modelo de IA (OpenRouter) e as APIs dos bancos.",
    "07-painel-principal": "O painel do dono (`escritorio/index.html`, um arquivo só com HTML, CSS e JS, sem build). Ele foi cortado nas marcações que já existiam: cabeçalho, CSS, topo e menu, uma tela por fragmento (`tela-*`) e uma seção do JavaScript por fragmento (`js-*`, as seções `// ═══ NOME ═══` do código). Fala com o n8n em `BASE/webhook/escritorio/*`.",
    "08-paginas-extras": "Páginas avulsas do painel, cortadas do mesmo jeito: `chat.html` (chat de teste com a IA), `fgts.html` (robô FGTS Lotus/HUB em fila), `pixel.html` (versão do escritório em pixel art/canvas) e `assinar-demo.html` (assinatura de demonstração).",
    "09-imagens-e-deploy": "Logos, ícones e foto de perfil do WhatsApp, e o `vercel.json` (deploy na Vercel + redirecionamentos de gmcredconsignado.com.br / redirect1 para o rotador do n8n).",
    "10-testes": "`estresse.py`: bateria de conversas difíceis (perguntas, assunto fora, tentativa de manipular a IA, cliente irritado, dados errados, mensagem longa) mandadas ao webhook `gmcred/chat`. Uso: `python3 estresse.py <arquivo-com-token>`.",
    "11-documentacao": "Pendências do projeto, contrato do servidor de WhatsApp (o que um substituto do WAHA precisa implementar) e `.gitignore`.",
    "99-legado-cpf-validator": "Zip do projeto antigo (CPF Validator Pro, exportado da Hostinger Horizons). Não é usado pela GM Cred; está aqui só porque o branch ainda tem esse arquivo.",
}

ARQ = {
    "n8n/gerar_agentes.js": "Gerador dos fluxos V8 Ferramentas, Ações, Agente e Acompanhamento (`node gerar_agentes.js <qual> [ids]`)",
    "n8n/gerar_roteador.js": "Gerador do Roteador",
    "n8n/gerar_v8.js": "Gerador da ferramenta V8",
    "n8n/roteador.js": "**Roteador**: webhook `POST gmcred/chat`, entrada única das mensagens → valida a chave → `credito.receber_mensagem` → setor → agente sorteado",
    "n8n/agente.js": "**Agente**: monta o contexto (`credito.contexto_agente`), chama o modelo (OpenRouter) com as ferramentas e devolve as mensagens",
    "n8n/acoes.js": "**Ações** do agente: consultar_cpf, simular, criar_proposta, status_proposta, escolher_oferta, registrar_pix, pedir_humano, encerrar…",
    "n8n/v8_ferramentas.js": "**V8 Ferramentas**: token em cache (`credito.v8_token`), login OAuth na V8, consulta de margem, simulação e operação",
    "n8n/acompanhamento.js": "**Acompanhamento**: a cada 2 min lê `credito.fila_acompanhamento()` e reconsulta CPFs, acompanha propostas e dispara a recuperação",
    "n8n/unno_ana_codigo.js": "Código do nó da Unno (margem e vínculo, simulação e proposta pela API da Unno)",
    "escritorio/chat.html": "Chat de teste com a IA",
    "escritorio/fgts.html": "Robô FGTS (Lotus/HUB)",
    "escritorio/pixel.html": "Escritório em pixel art (canvas)",
    "escritorio/assinar-demo.html": "Assinatura de demonstração",
    "escritorio/vercel.json": "Deploy e redirecionamentos na Vercel",
    "testes/estresse.py": "Teste de estresse da IA",
    "PENDENCIAS.md": "Lista de pendências",
    "docs/contrato-servidor-whatsapp.md": "Contrato da API de WhatsApp (subconjunto do WAHA + botões)",
    ".gitignore": "Ignora `disparo_*.csv` e `clovis_*`",
}

FRAG = {
    "cabecalho": "`<head>`: metadados, fontes, ícones e tema escuro salvo",
    "estilo": "Todo o CSS da página",
    "corpo": "Topo, barra de saúde/conexão, menu (desktop, celular e \"Mais\") e submenus",
    "script": "Abertura do `<script>`",
    "rodape": "Fechamento do `</script>` / `</body></html>`",
    "tela-hoje": "Tela **Início** (resumo do dia, produção CLT e FGTS)",
    "tela-escritorio": "Tela **Escritório** (salas com os agentes, \"precisa da sua atenção\", clientes no escritório)",
    "tela-pipeline": "Tela **Pipeline** (kanban por etapa)",
    "tela-conversas": "Tela **Conversas** (atender o cliente pelo painel)",
    "tela-clientes": "Tela **Clientes** (CRM)",
    "tela-v8": "Tela **Consulta V8 / Unno / HUB** (margem e simulação)",
    "tela-campanha": "Tela **Campanha** (a IA chama a base importada)",
    "tela-disparo": "Tela **Disparo** (rodadas de disparo pelos chips)",
    "tela-oficial": "Tela **API oficial** (disparo por mensagem modelo da Meta)",
    "tela-bms": "Tela **Configurações › BMs Meta**",
    "tela-mes": "Tela **Vendas** (vendas por dia, crescimento e projeção)",
    "tela-funil": "Tela **Funil** (por período)",
    "tela-links": "Tela **Links** (Extrair, Telefones e FGTS)",
    "tela-numeros": "Tela **Números** (chips de WhatsApp, status, QR)",
    "tela-maturador": "Tela **Maturador** (aquecimento dos chips)",
    "tela-agentes": "Tela **Agentes** (versões A/B/C e placar)",
    "tela-indicacoes": "Tela **Indicações** (programa de indicação)",
    "tela-financeiro": "Tela **Financeiro** (gastos, lucro e retorno)",
    "tela-simulacao": "Tela **Simulação** (simulador \"e se…\") e tela da chave de acesso",
    "js-config": "Configuração: endpoint do n8n, token de sessão, intervalos de atualização, rótulos e visual dos agentes",
    "js-util": "Funções utilitárias (formatar R$, datas, escapar HTML)",
    "js-pessoas-em-vetor": "Desenho SVG dos agentes (pele, cabelo, roupa)",
    "js-cenario-de-cada-sala": "Desenho SVG de cada sala",
    "js-modo-demo-dados-ficticios-no-mesmo-forma": "Modo demonstração (dados fictícios no formato da API)",
    "js-busca-de-dados": "Busca do estado no n8n (`/escritorio/estado`) a cada minuto",
    "js-renderizacao": "Desenha o escritório e as salas",
    "js-atencao-funil-e-saude": "\"Precisa da sua atenção\", funil e saúde do sistema",
    "js-vendas-por-dia-grafico-crescimento-e-pro": "Gráfico de vendas por dia, crescimento e projeção",
    "js-simulacao": "Simulador \"e se…\"",
    "js-agentes-versoes-a-b-c": "Aba Agentes (versões A/B/C)",
    "js-financeiro-gastos-lucro-e-retorno": "Aba Financeiro",
    "js-campanha-a-ia-chama-os-clientes-importad": "Campanha (importar base, editor da mensagem, placar), e também Conversas (`cv*`), Números (`nm*`) e Indicações (`in*`)",
    "js-disparo": "Aba Disparo",
    "js-api-oficial-mensagem-modelo-da-meta": "Aba API oficial (Meta)",
    "js-ficha-do-cliente-e-acoes": "Ficha do cliente e ações (`/escritorio/acao`)",
    "js-comissao-e-meta": "Comissão e meta diária",
    "js-clientes-cadastro-crm": "Aba Clientes (CRM)",
    "js-gaveta-detalhes": "Gaveta lateral de detalhes",
    "js-inicio": "Inicialização, tema, menu \"Mais\", navegação (`irPara`) e a Consulta V8/Unno/HUB (`v8*`, `unno*`, melhor proposta por comissão)",
    "js-estado": "Estado da página",
    "js-sidebar": "Barra lateral",
    "js-paineis": "Painéis de informação",
    "js-canvas": "Desenho do escritório no canvas",
}

def frag_desc(nome_arquivo):
    base = re.sub(r"^\d+-", "", os.path.splitext(nome_arquivo)[0])
    return FRAG.get(base, "")

def comentario_sql(dados):
    for l in dados.decode("utf-8", "replace").splitlines():
        if l.startswith("--"):
            return l.lstrip("- ").strip()
    return ""

def escrever(ref, saida, man, ler):
    por_parte = {}
    for it in man["arquivos"]:
        por_parte.setdefault(it["parte"], []).append(it)
    titulos = {p["pasta"]: p["titulo"] for p in man["partes"]}
    for pasta, itens in sorted(por_parte.items()):
        L = [f"# {pasta} — {titulos[pasta]}", "", PARTE.get(pasta, ""), ""]
        inteiros = [i for i in itens if "arquivo" in i]
        if inteiros:
            L += ["| Arquivo | O que é |", "|---|---|"]
            for i in inteiros:
                p = i["caminho"]
                d = comentario_sql(ler(p)) if p.endswith(".sql") else ARQ.get(p, "Imagem (logo, ícone ou foto de perfil)" if p.startswith("escritorio/img/") else "Zip do projeto antigo (não usado)" if p.startswith("horizons") else "")
                L.append(f"| `{p}` | {d.replace('|', '/')} |")
            L.append("")
        for i in itens:
            if "fragmentos" in i:
                L += [f"## `{i['caminho']}` em {len(i['fragmentos'])} fragmentos", "",
                      "Juntando os fragmentos nesta ordem, o arquivo volta a ser idêntico ao original.", "",
                      "| Fragmento | Linhas no original | O que é |", "|---|---|---|"]
                for f in i["fragmentos"]:
                    nome = os.path.basename(f["arquivo"])
                    L.append(f"| `{nome}` | {f['linhas'][0]}–{f['linhas'][1]} | {frag_desc(nome)} |")
                L.append("")
        with open(os.path.join(saida, pasta, "README.md"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(L))
    nome = os.path.basename(saida.rstrip("/"))
    L = [f"# Quebra do branch `{ref.replace('origin/', '')}`", "",
         f"Commit: `{man['commit'][:7]}` · {len(man['arquivos'])} arquivos em {len(por_parte)} partes.", "",
         "| Parte | Arquivos | Conteúdo |", "|---|---|---|"]
    for pasta, itens in sorted(por_parte.items()):
        L.append(f"| [`{pasta}`]({pasta}/README.md) | {len(itens)} | {titulos[pasta]} |")
    L += ["", "## Remontar", "", "```bash",
          f"python3 quebra/ferramentas/remontar.py quebra/{nome} /caminho/destino --conferir {ref}", "```", "",
          "`--conferir` compara cada arquivo remontado com o branch original. `--ate NN` monta só as partes até NN.", ""]
    with open(os.path.join(saida, "README.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(L))
