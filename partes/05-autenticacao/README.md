# Parte 05 — Autenticação (login local)

**O que é:** cadastro e login **100% no navegador** (não há backend de usuários).

| Arquivo | Função |
|---|---|
| `src/services/authService.js` | Usuários em `localStorage.users`; "hash" de senha = `btoa()` (base64, **não é seguro**). `registerUser`, `authenticateUser`, `getUsers` |
| `src/contexts/AuthContext.jsx` | `AuthProvider` + `useAuth()` → `{user, loading, login, logout, isAuthenticated}`. Sessão em `localStorage.auth_user` |
| `src/components/ProtectedRoute.jsx` | Redireciona para `/login` se não autenticado |
| `src/pages/LoginPage.jsx` | Login por e-mail **ou** usuário + senha |
| `src/pages/RegisterPage.jsx` | Cadastro: nome, e-mail, usuário, senha, confirmação |

**Depende de:** 01, 03. **Fornece:** `useAuth()` para as partes 06, 11, 12.
**Atenção:** o cadastro salva `nome`, mas Header/Settings leem `user.name` → o nome aparece vazio. Veja "Problemas encontrados" em `PROJETO.md`.
