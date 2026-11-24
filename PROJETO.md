# GM Cred — CPF Validator Pro: mapa do projeto quebrado em partes

Origem: export da Hostinger Horizons (`horizons-export-40204db1-….zip`, commit `956e22a`).
O código foi extraído e dividido em **13 partes** dentro de `partes/`. Cada parte tem um `README.md` e uma pasta `arquivos/` com os arquivos **nos mesmos caminhos do projeto original**, então remontar = copiar todas as `arquivos/` para uma mesma pasta.

## O que o sistema faz

Painel web (React) para **simular crédito consignado CLT por CPF** numa API externa:

1. **Simular** um CPF → a API devolve um `consultId`.
2. **Consultar** a simulação (CPF + `consultId`) → margem, valor solicitado, valor que o cliente recebe, taxa, nº de parcelas, IOF, seguro…
3. Fazer isso **um por vez** ou **em lote** (lista de CPFs), respeitando **20 requisições/minuto**.
4. Guardar tudo num **histórico local** (IndexedDB do navegador) e **exportar** para CSV, JSON ou Excel.

API: `https://servicos-api-clt-v8-multi-login.nttja3.easypanel.host`
- `POST /simular` → `{ cpf, usuario }`
- `POST /consultar-simulacoes` → `{ cpf, usuario, consultId }`

O campo `usuario` (ex.: `usuario_1`) é configurado na tela **Configurações** e define qual login do banco/correspondente a API usa ("multi-login").

**Stack:** React 18 · Vite 4 · React Router 6 · Tailwind 3 · Radix UI (shadcn) · framer-motion · lucide-react · xlsx. Não há backend próprio: login, sessão, limite de requisições e histórico ficam no navegador.

## Arquitetura em camadas

```
                 ┌───────────────────────── 12 Montagem final ─────────────────────────┐
                 │  App.jsx (rotas)            Dashboard.jsx (abas + estado rate limit) │
                 └──────┬──────────┬──────────┬──────────┬──────────┬──────────────────┘
                        │          │          │          │          │
            07 Simulação   08 Lote   09 Consulta  10 Histórico  11 Configurações
             individual              de dados
                        │          │          │          │          │
                 ┌──────┴──────────┴──────────┴──────────┴──────────┴──────┐
                 │ 06 Layout compartilhado (Header, Sidebar, RateLimit)    │
                 │ 05 Autenticação (AuthContext, Login, Register)          │
                 │ 04 Serviços e dados (API, rate limiter, IndexedDB)      │
                 │ 03 UI kit (button, card, table, toast…)                 │
                 │ 01 Fundação (config, build, main.jsx)  +  02 Plugins    │
                 └─────────────────────────────────────────────────────────┘
   99 Código não utilizado (fora da árvore de imports)
```

## As partes

| # | Parte | Arquivos | Depende de | Resumo |
|---|---|---|---|---|
| 01 | `01-fundacao` | 15 | — | package.json, Vite, Tailwind, ESLint, index.html, main.jsx, CSS, `cn()` |
| 02 | `02-plugins-horizons` | 8 | 01 | Plugins do editor visual Horizons (só em dev); exigidos pelo `vite.config.js` |
| 03 | `03-ui-kit` | 14 | 01 | Componentes base shadcn/Radix + sistema de toast |
| 04 | `04-servicos-e-dados` | 4 | 01, 03 | `apiService`, `rateLimiter`, `indexedDBService`, hook `useSimulationStorage` |
| 05 | `05-autenticacao` | 5 | 01, 03 | Login/cadastro em localStorage, `AuthContext`, `ProtectedRoute` |
| 06 | `06-layout-compartilhado` | 3 | 03, 05 | `Header`, `Sidebar`, `RateLimitIndicator` |
| 07 | `07-simulacao-individual` | 1 | 03, 04, 06 | `CPFValidator` (Simular / Consultar) |
| 08 | `08-processamento-lote` | 3 | 03, 04, 06 | Lote com 5 workers, progresso, ETA, reprocessar erros, export |
| 09 | `09-consulta-dados` | 3 | 03, 04 | Consulta CPF+ConsultId individual/lote + Excel |
| 10 | `10-historico` | 1 | 03, 04 | Histórico do IndexedDB: filtro, detalhes, excluir, exportar |
| 11 | `11-configuracoes` | 1 | 03–06 | Usuário da API, sessão, sobre |
| 12 | `12-montagem-final` | 2 | todas | `App.jsx` (rotas) + `Dashboard.jsx` (abas) |
| 99 | `99-codigo-nao-utilizado` | 7 | — | Componentes que nenhuma tela importa (descartáveis) |

Total: 67 arquivos. O `.env` original **não** foi incluído porque tem credenciais; use o `.env.example`.

## Como remontar

**Tudo de uma vez** (gera `./app`, idêntico ao original):

```bash
./remontar.sh
```

```bash
cd app && npm install && npm run dev
```

**Sem o código morto:** `./remontar.sh app 12`
**Incremental / parte por parte:** `./remontar.sh app 06` monta só de 01 a 06. Depois rode de novo com um número maior.
Observação: só a parte 12 liga tudo (`main.jsx` importa `@/App`), então o app só abre no navegador com 01–12 completas. Para testar uma parte antes disso, crie um `src/App.jsx` provisório que renderize só aquele componente.

**Ordem recomendada para reconstruir/reescrever:** 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12.

Verificado: a remontagem completa é idêntica ao zip original (`diff -r`, ignorando só pastas vazias e o `.env`), e `npm ci && npm run build` passa, com ou sem a parte 99.

## Dados guardados no navegador

| Onde | Chave | Conteúdo |
|---|---|---|
| localStorage | `users` | Usuários cadastrados (senha em base64) |
| localStorage | `auth_user` | Sessão atual |
| localStorage | `apiUser` | Usuário enviado à API (padrão `usuario_1`) |
| localStorage | `api_request_timestamps` | Timestamps das últimas requisições (rate limit) |
| IndexedDB | `SimuladorDB` → `simulacoes` | Histórico de simulações/consultas |

## Problemas encontrados (para corrigir na remontagem)

1. **Nome do usuário não aparece:** o cadastro grava `nome`, mas `Header.jsx` e `SettingsPage.jsx` leem `user.name`.
2. **Login inseguro:** usuários e senhas (só em base64) ficam no localStorage; qualquer pessoa entra criando `auth_user` à mão. Serve apenas como protótipo; o ideal é auth no servidor (ex.: Supabase).
3. **URL da API repetida em 4 lugares** (`apiService.js` ×2, `CPFValidator.jsx`, `BatchProcessing.jsx`). Centralizar em uma constante/variável de ambiente.
4. **Dois formatos de registro no mesmo banco:** 07/09 gravam campos como `{status, value}`; 08 grava valores planos (`margem: 123`). O histórico e a exportação tratam os dois, mas isso complica tudo.
5. **Lote lento com muitos CPFs:** cada `save()` do `useSimulationStorage` relê o banco inteiro. Além disso, os 5 workers em paralelo disparam juntos e o limite fica só no cliente.
6. **Estado inicial do rate limit** no Dashboard diz 50, mas o limite real é 20 (é corrigido no 1º segundo).
7. **Funções duplicadas:** a sub-aba "Consultar" do `CPFValidator` e a aba "Dados" (parte 09) fazem a mesma chamada.
8. **Código morto:** a aba `settings` dentro do `Dashboard.jsx` nunca aparece (a Sidebar navega para `/settings`); a parte 99 inteira não é usada; dependências como `@radix-ui/react-avatar`, `checkbox`, `dropdown-menu`, `slider` e `tabs` não são importadas.
9. **Marca Horizons:** o `<title>` do `index.html` é "Hostinger Horizons" e o `.htaccess` envia `X-Powered-By: Hostinger Horizons`.
