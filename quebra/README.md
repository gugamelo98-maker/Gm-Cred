# GM Cred — projeto quebrado em partes

Cada um dos 3 branches da GM Cred foi quebrado **separadamente**, sem juntar nada:

| Pasta | Branch | Commit | Arquivos | Partes |
|---|---|---|---|---|
| [`focused-euler/`](focused-euler/README.md) | `claude/focused-euler-pmxfmp` | `6e65535` (18/11) | 115 | 12 |
| [`great-meitner/`](great-meitner/README.md) | `claude/great-meitner-eur875` | `1d88ecf` (11/11) | 58 | 9 |
| [`wizardly-euler/`](wizardly-euler/README.md) | `claude/wizardly-euler-e7soqw` | `344edb4` (19/11) | 15 | 4 |

Os branches originais não foram alterados.

## O que é o projeto

A GM Cred vende **crédito consignado CLT** (e FGTS) pelo WhatsApp com uma atendente de IA, a **"Ana"**. O sistema imita uma "empresa virtual" com setores: Recepção, Simulação, Vendas, Formalização, Pós-venda e Gerente. Cada setor tem 3 agentes de IA em teste A/B/C.

```
 Cliente no WhatsApp ──► WAHA (chips gmcred-N) ──► n8n Roteador (webhook gmcred/chat)
                                                     │
                                Postgres  credito.*  ◄┤  receber_mensagem → setor → agente sorteado
                          (regras, estados, prompts)  │
                                                     ▼
                     n8n Agente (OpenRouter) ──► n8n Ações ──► V8 / Unno / HUB / Lotus (bancos)
                                                     │
                     n8n Acompanhamento (a cada 2 min): reconsulta, propostas, recuperação
                                                     │
 Dono ◄── Painel escritorio/index.html (Vercel) ◄── n8n webhooks escritorio/*  (estado, acao, disparo…)
```

- **Banco (Postgres na Cloudfy, schema `credito`)**: quase toda a regra de negócio fica em funções SQL. As migrações `db/NNN_*.sql` estão nas partes 01–05.
- **n8n (Cloudfy)**: os fluxos são gerados por código (`@n8n/workflow-sdk`). Ficam na parte 06.
- **Painel**: HTML/CSS/JS puro, sem build, publicado na Vercel. O `vercel.json` também faz o rotador de links `gmcredconsignado.com.br → n8n → wa.me`. Ficam nas partes 07–09.

## Como as partes estão organizadas (iguais nos 3 branches)

| Parte | Conteúdo |
|---|---|
| 01–05 | Banco, agrupado por assunto (número da migração) |
| 06 | Fluxos do n8n |
| 07 | `escritorio/index.html` cortado em fragmentos: CSS, cada **tela** e cada **seção do JS** |
| 08 | Páginas extras (`chat`, `fgts`, `pixel`, `assinar-demo`), também em fragmentos |
| 09 | Imagens e `vercel.json` |
| 10 | Teste de estresse da IA |
| 11 | Pendências e documentação |
| 99 | Zip do projeto antigo (CPF Validator Pro), que não é usado |

Um branch só tem as partes dos arquivos que ele contém. O `wizardly-euler`, por exemplo, só tem o painel (07, 08, 09, 99).

Dentro de cada parte:
- `arquivos/<caminho original>`: arquivos inteiros;
- `fragmentos/<caminho original>/NN-nome.ext`: pedaços de um arquivo grande, na ordem certa;
- `README.md`: o que é cada arquivo/fragmento e, para fragmentos, as linhas que ocupavam no original.

O `manifesto.json` de cada branch guarda a ordem exata para remontar.

## Remontar

```bash
python3 quebra/ferramentas/remontar.py quebra/focused-euler /tmp/gmcred --conferir origin/claude/focused-euler-pmxfmp
```

- `--conferir <branch>`: compara cada arquivo remontado com o branch original no git e diz se ficou idêntico.
- `--ate 06`: monta só as partes 01 a 06 (montagem aos poucos).

Verificado: os 3 branches remontam **idênticos byte a byte** ao original.

Para quebrar de novo depois de novas mudanças num branch:

```bash
python3 quebra/ferramentas/quebrar.py origin/claude/focused-euler-pmxfmp quebra/focused-euler
```

## Diferenças entre os branches (para quando for juntar)

Os três divergiram a partir do mesmo começo; nenhum contém os outros.

- **focused-euler**: o mais completo. Banco até a migração 102, n8n com Unno, painel com Consulta V8+Unno e melhor proposta por comissão.
- **wizardly-euler**: só o painel, com **29 commits que não estão no focused**: FGTS em grupos (BMP/J17, com/sem saldo, sem adesão), HUB na Consulta (pré-simulação, sexo e cidade), tela **Pipeline** (kanban), **BMs Meta** em Configurações, tela **Links**, disparo com "Enviando agora" e relatório CSV, tabulação manual no painel Humano. Também tem 3 logos (`logo-hub`, `logo-unno`, `logo-v8`) que faltam no focused.
- **great-meitner**: versão mais antiga (banco só até a migração 042). O único commit próprio é o **menu em grupos** (Operação, WhatsApp com Campanha/Números/Maturador em abas, Análise; no celular, Análise vai para "Mais"). Também remove o zip antigo.

Juntar o focused com o wizardly dá 44 conflitos no `index.html` e 16 no `fgts.html`; com o great-meitner, 6 no `index.html`. Como agora o painel está em fragmentos, dá para comparar tela por tela, por exemplo:

```bash
diff quebra/focused-euler/07-painel-principal/fragmentos/escritorio/index.html/34-js-disparo.js quebra/wizardly-euler/07-painel-principal/fragmentos/escritorio/index.html/37-js-disparo.js
```

A numeração dos fragmentos muda entre branches porque o wizardly tem telas a mais. Compare pelo nome, não pelo número.
