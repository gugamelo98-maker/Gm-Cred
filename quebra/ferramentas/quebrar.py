#!/usr/bin/env python3
"""Quebra um branch da GM Cred em partes.

Uso: python3 quebra/ferramentas/quebrar.py <ref-do-git> <pasta-de-saida>
Ex.: python3 quebra/ferramentas/quebrar.py origin/claude/focused-euler-pmxfmp quebra/focused-euler

Cada arquivo do branch vai para uma parte (regras em PARTES). Os HTML grandes do
painel são cortados em fragmentos (cabeçalho, CSS, cada tela, cada seção do JS)
nas marcações que já existem no código. O manifesto.json guarda a ordem exata
para o remontar.py juntar tudo de novo, idêntico ao original.
"""
import json, os, re, subprocess, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PARTES = [
    # (pasta, título, regra)
    ("01-banco-fundacao-e-agentes", "Banco · fundação, agentes e conversa (001–022)", lambda p: db(p, 1, 22) or p == "db/zerar_escritorio.sql"),
    ("02-banco-crm-recuperacao-financeiro", "Banco · CRM, recuperação, financeiro, campanha e resumo (023–036)", lambda p: db(p, 23, 36)),
    ("03-banco-whatsapp-e-disparo", "Banco · números de WhatsApp, atendimento, disparo, rotador e API oficial (037–078)", lambda p: db(p, 37, 72) or db(p, 75, 78)),
    ("04-banco-regras-da-ana", "Banco · regras de conversa da Ana: silêncio, emoji, valores, prazos, CPF (073–091)", lambda p: db(p, 73, 74) or db(p, 79, 91)),
    ("05-banco-fgts-hub-unno", "Banco · FGTS (Lotus/HUB), higienização e Unno (092+)", lambda p: db(p, 92, 999)),
    ("06-n8n-fluxos", "n8n · geradores e fluxos (Roteador, Agente, Ações, V8, Acompanhamento, Unno)", lambda p: p.startswith("n8n/")),
    ("07-painel-principal", "Painel · escritorio/index.html em fragmentos", lambda p: p == "escritorio/index.html"),
    ("08-paginas-extras", "Painel · páginas extras (chat de teste, FGTS, pixel, assinatura demo)", lambda p: p.startswith("escritorio/") and p.endswith(".html")),
    ("09-imagens-e-deploy", "Painel · imagens e deploy na Vercel (vercel.json)", lambda p: p.startswith("escritorio/")),
    ("10-testes", "Testes de estresse da IA", lambda p: p.startswith("testes/")),
    ("11-documentacao", "Documentação e pendências", lambda p: p.startswith("docs/") or p in ("PENDENCIAS.md", ".gitignore")),
    ("99-legado-cpf-validator", "Legado · zip do projeto antigo (CPF Validator Pro, Horizons)", lambda p: p.startswith("horizons-export")),
]

def db(p, a, b):
    m = re.match(r"db/(\d+)_", p)
    return bool(m) and a <= int(m.group(1)) <= b

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:40] or "x"

def git(*a, binary=False):
    out = subprocess.run(["git", *a], check=True, capture_output=True).stdout
    return out if binary else out.decode()

def cortes_html(texto):
    """Devolve [(nome, ext, trecho)] cortando nas marcações estruturais do arquivo."""
    linhas = texto.splitlines(keepends=True)
    cortes = [(0, "cabecalho", "html")]
    no_script = False
    for i, l in enumerate(linhas):
        s = l.strip()
        if not no_script:
            if s.startswith("<style"):
                cortes.append((i, "estilo", "css"))
            elif s.startswith("</style>") and i + 1 < len(linhas):
                cortes.append((i + 1, "corpo", "html"))
            elif m := re.match(r'<div class="view[^"]*" id="v-([\w-]+)"', s):
                cortes.append((i, "tela-" + m.group(1), "html"))
            elif s.startswith("<script") and "</script>" not in s and "src=" not in s:
                cortes.append((i, "script", "js"))
                no_script = True
        else:
            if m := re.match(r"//\s*═+\s*(.+?)\s*═", s):
                cortes.append((i, "js-" + slug(m.group(1)), "js"))
            elif "</script>" in s:
                no_script = False
                if i + 1 < len(linhas):
                    cortes.append((i + 1, "rodape", "html"))
    # remove cortes repetidos na mesma linha (fica o último) e ordena
    por_linha = {}
    for c in cortes:
        por_linha[c[0]] = c
    cortes = sorted(por_linha.values())
    frags = []
    for n, (ini, nome, ext) in enumerate(cortes):
        fim = cortes[n + 1][0] if n + 1 < len(cortes) else len(linhas)
        frags.append((nome, ext, "".join(linhas[ini:fim]), ini + 1, fim))
    return frags

def main(ref, saida):
    arquivos = [l for l in git("ls-tree", "-r", "--name-only", ref).splitlines() if l]
    manifesto = {"ref": ref, "commit": git("rev-parse", ref).strip(), "arquivos": []}
    partes_usadas = {}
    for p in arquivos:
        parte = next((pasta, tit) for pasta, tit, regra in PARTES if regra(p))
        partes_usadas.setdefault(parte, []).append(p)
        conteudo = git("show", f"{ref}:{p}", binary=True)
        item = {"caminho": p, "parte": parte[0]}
        if p.endswith(".html") and len(conteudo) > 15000:
            frags = cortes_html(conteudo.decode("utf-8"))
            item["fragmentos"] = []
            for n, (nome, ext, trecho, l1, l2) in enumerate(frags, 1):
                rel = f"{parte[0]}/fragmentos/{p}/{n:02d}-{nome}.{ext}"
                escreve(os.path.join(saida, rel), trecho.encode("utf-8"))
                item["fragmentos"].append({"arquivo": rel, "linhas": [l1, l2]})
        else:
            rel = f"{parte[0]}/arquivos/{p}"
            escreve(os.path.join(saida, rel), conteudo)
            item["arquivo"] = rel
        manifesto["arquivos"].append(item)
    manifesto["partes"] = [{"pasta": pa, "titulo": t, "arquivos": fs} for (pa, t), fs in sorted(partes_usadas.items())]
    escreve(os.path.join(saida, "manifesto.json"), json.dumps(manifesto, ensure_ascii=False, indent=1).encode())
    import documentar
    documentar.escrever(ref, saida, manifesto, lambda p: git("show", f"{ref}:{p}", binary=True))
    print(f"{ref}: {len(arquivos)} arquivos em {len(partes_usadas)} partes")

def escreve(caminho, dados):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    with open(caminho, "wb") as f:
        f.write(dados)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
