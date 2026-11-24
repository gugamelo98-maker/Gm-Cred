#!/usr/bin/env python3
"""Remonta um branch da GM Cred a partir das partes.

Uso: python3 quebra/ferramentas/remontar.py <pasta-da-quebra> <pasta-de-destino> [--ate NN] [--conferir REF]
Ex.: python3 quebra/ferramentas/remontar.py quebra/focused-euler /tmp/gmcred
     python3 quebra/ferramentas/remontar.py quebra/focused-euler /tmp/gmcred --ate 06   (só as partes 01 a 06)
     python3 quebra/ferramentas/remontar.py quebra/focused-euler /tmp/gmcred --conferir origin/claude/focused-euler-pmxfmp

Arquivos inteiros são copiados; arquivos em fragmentos são juntados na ordem do
manifesto.json. Com --conferir, compara cada arquivo com o branch original no git.
"""
import argparse, hashlib, json, os, subprocess

ap = argparse.ArgumentParser()
ap.add_argument("quebra"); ap.add_argument("destino")
ap.add_argument("--ate", default="99"); ap.add_argument("--conferir")
a = ap.parse_args()

man = json.load(open(os.path.join(a.quebra, "manifesto.json"), encoding="utf-8"))
feitos, diferentes = 0, []
for item in man["arquivos"]:
    if item["parte"][:2] > a.ate:
        continue
    if "fragmentos" in item:
        dados = b"".join(open(os.path.join(a.quebra, f["arquivo"]), "rb").read() for f in item["fragmentos"])
    else:
        dados = open(os.path.join(a.quebra, item["arquivo"]), "rb").read()
    dest = os.path.join(a.destino, item["caminho"])
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    open(dest, "wb").write(dados)
    feitos += 1
    if a.conferir:
        orig = subprocess.run(["git", "show", f"{a.conferir}:{item['caminho']}"], capture_output=True, check=True).stdout
        if hashlib.sha256(orig).digest() != hashlib.sha256(dados).digest():
            diferentes.append(item["caminho"])

print(f"{feitos} arquivos remontados em {a.destino}")
if a.conferir:
    print("IDÊNTICO ao branch original" if not diferentes else f"DIFERENTES: {diferentes}")
