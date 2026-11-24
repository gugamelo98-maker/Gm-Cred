# GM Cred · Painel novo

Projeto **separado** do painel atual (`escritorio/`, que está nos branches da GM Cred). Nada do painel antigo foi alterado: se o novo não ficar bom, o antigo continua funcionando.

Por enquanto roda em **modo demonstração**: dados fictícios, guardados só no navegador. Ele não manda mensagem, não consulta banco e não fala com o n8n.

## Rodar

```bash
cd painel-novo
npm install
npm run dev
```

Abra o endereço que aparecer (normalmente http://localhost:5173). Na demonstração, qualquer senha funciona. A tela de login tem atalhos para entrar como Administrador, Gestor ou Atendente.

`npm run build` gera a pasta `dist/` para publicar (Vercel, por exemplo). Por ser um app de rotas, configure o servidor para responder `index.html` em qualquer caminho.

## Abas

| Aba | O que faz | Quem vê |
|---|---|---|
| **BI** | Quantos entraram, quantos mandaram CPF, com margem, propostas, pagos e comissão por período, produto e origem. Mostra funil, gráfico por dia, custo por lead/venda por origem e resultado de cada disparo. | Admin, Gestor |
| **Pipeline** | Kanban por etapa (Recepção → Simulação → Vendas → Formalização → Pós-venda → Perdidos). **Arraste o cartão** para mudar o status. Soltar em Perdidos pede o motivo. Tudo fica no histórico do cliente. | Todos |
| **Clientes** | Cadastro com filtros (em atendimento, com margem, com humano, pagos, sem margem, perdidos), busca, ficha e exportação CSV. | Todos |
| **Conversas** | Atender pelo painel: assumir/devolver para a IA, finalizar, enviar foto/PDF/vídeo (botão, arrastar ou colar), gravar áudio, ouvir e abrir as mídias do cliente, nota interna (só a equipe vê; Admin e Gestor escrevem), mensagens prontas com `/atalho`, responsável pelo cliente. | Todos |
| **Motor de Crédito** | CPF → consulta V8, Unno e HUB juntos → simula a parcela → ranking das ofertas pela comissão. | Todos |
| **Disparos** | Rodadas de disparo pelos chips (Baileys próprio + n8n): mensagens A/B com variações, rodapé e botões, números, ritmo, horário e importação de contatos. | Admin, Gestor |
| **Números** | Chips: status, função (atendimento/disparo/reserva), QR para conectar, trava do WhatsApp, envios do dia. | Admin, Gestor |
| **Maturador** | Liga/pausa, intervalo, horário, chips participantes e últimas mensagens trocadas. | Admin, Gestor |
| **Indicações** | Indicadores, link próprio, indicações, vendas fechadas, saldo e pagamento. | Admin, Gestor |
| **Financeiro** | Receita (comissão), gastos por categoria, lucro, retorno, custo por lead/venda e lançamentos. | Admin, Gestor |
| **Usuários** *(nova)* | Quem entra no painel, o tipo de acesso (Administrador, Gestor, Atendente) e se o atendente vê **só as conversas e clientes dele** ou todos. | Admin |

Ficaram de fora do painel antigo: Escritório (salas e avatares), Campanha, API oficial, Agentes A/B/C, Simulação "e se", Links e BMs Meta. Funil e Vendas viraram parte do BI.

## Como está organizado (por partes)

```
src/
  api/
    tipos.ts      ← CONTRATO: o formato de cada dado (Cliente, Numero, Disparo…)
    contrato.ts   ← CONTRATO: tudo que o painel pede ao backend (interface Api)
    demo.ts       ← implementação de demonstração (dados fictícios)
    index.ts      ← o ponto único de troca: demo hoje, backend real depois
  estado/Dados.tsx  ← dados carregados, sessão do usuário e avisos
  componentes/      ← menu (Layout), peças visuais (ui) e gráficos
  telas/<aba>/      ← UMA PASTA POR ABA: dá para refazer uma sem mexer nas outras
  util/             ← formatação (R$, CPF, telefone, datas), períodos e rótulos
```

## Ligar no backend de verdade

1. Implemente a interface `Api` de `src/api/contrato.ts` chamando o backend novo. Os formatos estão em `src/api/tipos.ts`.
2. Em `src/api/index.ts`, troque `demoApi` pela implementação nova e ponha `MODO_DEMO = false`.

Nenhuma tela precisa mudar. Pontos que o backend novo precisa ter e que o antigo **não tem**:
- `moverCliente`: mudar a etapa à mão (o arrastar do Pipeline), com histórico de quem mudou;
- usuários com login individual e tipo de acesso (hoje é uma chave única);
- marcos com data no cliente (`entrouEm`, `cpfEm`, `margemEm`, `propostaEm`, `pagoEm`), que o BI usa.

## Pendente de definição

- **Financeiro** e **Clientes**: estão na versão base (parecida com a atual). Faltam as mudanças que vocês querem.
- **Conversas no n8n**: o envio de mídia/áudio, o recebimento de mídia do cliente e a nota interna precisam de ajuste no fluxo de WhatsApp (Baileys próprio) que já roda no n8n. O que o painel espera está em `src/api/contrato.ts`.
- **Motor de Crédito**: segue o fluxo da Consulta V8/Unno/HUB atual. Confirmar se é isso.
