# Quebra do branch `claude/focused-euler-pmxfmp`

Commit: `6e65535` · 115 arquivos em 12 partes.

| Parte | Arquivos | Conteúdo |
|---|---|---|
| [`01-banco-fundacao-e-agentes`](01-banco-fundacao-e-agentes/README.md) | 23 | Banco · fundação, agentes e conversa (001–022) |
| [`02-banco-crm-recuperacao-financeiro`](02-banco-crm-recuperacao-financeiro/README.md) | 14 | Banco · CRM, recuperação, financeiro, campanha e resumo (023–036) |
| [`03-banco-whatsapp-e-disparo`](03-banco-whatsapp-e-disparo/README.md) | 33 | Banco · números de WhatsApp, atendimento, disparo, rotador e API oficial (037–078) |
| [`04-banco-regras-da-ana`](04-banco-regras-da-ana/README.md) | 12 | Banco · regras de conversa da Ana: silêncio, emoji, valores, prazos, CPF (073–091) |
| [`05-banco-fgts-hub-unno`](05-banco-fgts-hub-unno/README.md) | 8 | Banco · FGTS (Lotus/HUB), higienização e Unno (092+) |
| [`06-n8n-fluxos`](06-n8n-fluxos/README.md) | 9 | n8n · geradores e fluxos (Roteador, Agente, Ações, V8, Acompanhamento, Unno) |
| [`07-painel-principal`](07-painel-principal/README.md) | 1 | Painel · escritorio/index.html em fragmentos |
| [`08-paginas-extras`](08-paginas-extras/README.md) | 4 | Painel · páginas extras (chat de teste, FGTS, pixel, assinatura demo) |
| [`09-imagens-e-deploy`](09-imagens-e-deploy/README.md) | 6 | Painel · imagens e deploy na Vercel (vercel.json) |
| [`10-testes`](10-testes/README.md) | 1 | Testes de estresse da IA |
| [`11-documentacao`](11-documentacao/README.md) | 3 | Documentação e pendências |
| [`99-legado-cpf-validator`](99-legado-cpf-validator/README.md) | 1 | Legado · zip do projeto antigo (CPF Validator Pro, Horizons) |

## Remontar

```bash
python3 quebra/ferramentas/remontar.py quebra/focused-euler /caminho/destino --conferir origin/claude/focused-euler-pmxfmp
```

`--conferir` compara cada arquivo remontado com o branch original. `--ate NN` monta só as partes até NN.
