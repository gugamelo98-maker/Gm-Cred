# Quebra do branch `claude/wizardly-euler-e7soqw`

Commit: `344edb4` · 15 arquivos em 4 partes.

| Parte | Arquivos | Conteúdo |
|---|---|---|
| [`07-painel-principal`](07-painel-principal/README.md) | 1 | Painel · escritorio/index.html em fragmentos |
| [`08-paginas-extras`](08-paginas-extras/README.md) | 4 | Painel · páginas extras (chat de teste, FGTS, pixel, assinatura demo) |
| [`09-imagens-e-deploy`](09-imagens-e-deploy/README.md) | 9 | Painel · imagens e deploy na Vercel (vercel.json) |
| [`99-legado-cpf-validator`](99-legado-cpf-validator/README.md) | 1 | Legado · zip do projeto antigo (CPF Validator Pro, Horizons) |

## Remontar

```bash
python3 quebra/ferramentas/remontar.py quebra/wizardly-euler /caminho/destino --conferir origin/claude/wizardly-euler-e7soqw
```

`--conferir` compara cada arquivo remontado com o branch original. `--ate NN` monta só as partes até NN.
