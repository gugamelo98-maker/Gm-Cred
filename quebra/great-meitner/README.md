# Quebra do branch `claude/great-meitner-eur875`

Commit: `1d88ecf` · 58 arquivos em 9 partes.

| Parte | Arquivos | Conteúdo |
|---|---|---|
| [`01-banco-fundacao-e-agentes`](01-banco-fundacao-e-agentes/README.md) | 23 | Banco · fundação, agentes e conversa (001–022) |
| [`02-banco-crm-recuperacao-financeiro`](02-banco-crm-recuperacao-financeiro/README.md) | 14 | Banco · CRM, recuperação, financeiro, campanha e resumo (023–036) |
| [`03-banco-whatsapp-e-disparo`](03-banco-whatsapp-e-disparo/README.md) | 6 | Banco · números de WhatsApp, atendimento, disparo, rotador e API oficial (037–078) |
| [`06-n8n-fluxos`](06-n8n-fluxos/README.md) | 8 | n8n · geradores e fluxos (Roteador, Agente, Ações, V8, Acompanhamento, Unno) |
| [`07-painel-principal`](07-painel-principal/README.md) | 1 | Painel · escritorio/index.html em fragmentos |
| [`08-paginas-extras`](08-paginas-extras/README.md) | 3 | Painel · páginas extras (chat de teste, FGTS, pixel, assinatura demo) |
| [`09-imagens-e-deploy`](09-imagens-e-deploy/README.md) | 1 | Painel · imagens e deploy na Vercel (vercel.json) |
| [`10-testes`](10-testes/README.md) | 1 | Testes de estresse da IA |
| [`11-documentacao`](11-documentacao/README.md) | 1 | Documentação e pendências |

## Remontar

```bash
python3 quebra/ferramentas/remontar.py quebra/great-meitner /caminho/destino --conferir origin/claude/great-meitner-eur875
```

`--conferir` compara cada arquivo remontado com o branch original. `--ate NN` monta só as partes até NN.
