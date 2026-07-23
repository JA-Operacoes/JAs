# Padrão de Permissões

Guia de como liberar/restringir telas e rotas por permissão neste projeto.
Serve como referência para padronizar e manter — toda tela nova deve seguir isto.

---

## 1. Modelo de dados

Tudo vive na tabela **`permissoes`**, com uma linha por **(usuário, módulo, empresa)**.
As colunas se dividem em dois tipos:

### a) Ações de módulo (granulares)
Dizem o que o usuário pode fazer **naquele módulo**:

| Coluna      | Significado |
|-------------|-------------|
| `acesso`    | abrir/entrar no módulo |
| `cadastrar` | criar registros |
| `alterar`   | editar |
| `pesquisar` | consultar |
| `apagar`    | excluir |

### b) Flags especiais (transversais)
Não pertencem a um módulo específico — são "papéis" fortes do usuário:

| Coluna       | Uso |
|--------------|-----|
| `master`     | visão ampliada |
| `financeiro` | acesso financeiro |
| `supremo`    | super-acesso (vê/aprova tudo) |
| `comercial`  | acesso comercial |
| `devs`       | acesso a dados sensíveis / config técnica |
| `rh`         | folha de pagamento / RH mode / Alíquotas |

> **Convenção:** as flags especiais são concedidas na linha do módulo **`Staff`**.
> O front lê pela linha do Staff; o back lê em **qualquer módulo**. Se você sempre
> conceder a flag no Staff, os dois batem. (Ver §4.)

---

## 2. Regra de ouro

> **O backend é a única segurança real. O frontend é só UX (esconder/mostrar).**

Sempre faça **as duas coisas**:
1. **Front esconde** o que o usuário não pode ver (menu, botão, tela).
2. **Back bloqueia** a rota correspondente (retorna `401`/`403`).

Esconder no front sem proteger no back = qualquer um chama a API direto e passa.

---

## 3. Backend — como proteger uma rota

### Caso 1: ação de módulo → `verificarPermissao(modulo, acao)`
Use quando a permissão é granular (acesso/cadastrar/alterar/pesquisar/apagar) de um módulo.

```js
const { verificarPermissao } = require('./middlewares/permissaoMiddleware');

router.post('/clientes',
  autenticarToken(), contextoEmpresa,
  verificarPermissao('Clientes', 'cadastrar'),   // 403 se não puder cadastrar
  controller.criar
);
```

Arquivo: [`middlewares/permissaoMiddleware.js`](../middlewares/permissaoMiddleware.js)

### Caso 2: flag especial → `exigirFlag(...flags)`
Use quando o acesso depende de uma flag transversal (rh, supremo, devs...).
Passa quem tiver **qualquer uma** das flags informadas (lógica OU).

```js
const { exigirFlag } = require('./middlewares/permissaoMiddleware');

// Só rh OU supremo entram em qualquer rota /rh/*
app.use("/rh",
  autenticarToken(), contextoEmpresa,
  exigirFlag('rh', 'supremo'),
  require("./routes/rotaRH")
);
```

Detalhes do `exigirFlag`:
- Aceita 1+ flags; basta ter **uma** (`rh = true OR supremo = true`).
- Os nomes de coluna passam por uma **whitelist** (`FLAGS_ESPECIAIS`) antes de irem
  para a query — evita SQL injection no nome da coluna.
- Verifica na **empresa atual** (`req.idempresa`).
- Sem flag → `403`; sem login/empresa → `401`.

> Para adicionar uma flag nova, inclua o nome em `FLAGS_ESPECIAIS` no middleware.

---

## 4. Frontend — como esconder

### Dentro da shell OPER/Index (tem `window.permissoes`)
A função global `temPermissao(modulo, acao)` já está disponível (definida no
[`Index.js`](../public/js/Index.js)). Lê `window.permissoes`.

```js
const temMaster     = temPermissao("Staff", "master");
const temFinanceiro = temPermissao("Staff", "financeiro");
const temTotal      = temMaster && temFinanceiro;

if (!temTotal) botao.style.display = "none";
```

Para flags com lógica OU (igual ao back):
```js
const temAcessoRH = temPermissao("Staff", "rh") || temPermissao("Staff", "supremo");
if (!temAcessoRH) elemento.style.display = "none";
```

#### ⚠️ Timing: espere as permissões carregarem
`window.permissoes` é carregado de forma **assíncrona** no Index.js. Se você checar
no `DOMContentLoaded` direto, pode rodar **antes** das permissões existirem e esconder
algo por engano.

O Index.js dispara o evento **`permissoesCarregadas`** assim que `window.permissoes`
**e** `window.temPermissao` estão prontos. Padrão para usar:

```js
function quandoPermissoesProntas(cb) {
  if (Array.isArray(window.permissoes)) cb();
  else document.addEventListener("permissoesCarregadas", cb, { once: true });
}

document.addEventListener("DOMContentLoaded", () => quandoPermissoesProntas(initMinhaTela));
```

### Página standalone (NÃO tem `window.permissoes`)
Telas que não rodam dentro do Index.js (ex.: `CadUsuarios.html`) não têm
`temPermissao`. Busque as permissões do usuário logado direto da API:

```js
const perms = await fetchComToken('/auth/permissoes');
const temRH = Array.isArray(perms) && perms.some(p => !!p.pode_rh);
if (!temRH) elemento.style.display = "none";
```

> Note: a API devolve `pode_rh`, `pode_supremo`, etc. (prefixo `pode_`).

---

## 5. Front vs Back: o detalhe do "Staff" vs "qualquer módulo"

- **Front** (`temPermissao("Staff", "rh")`) olha **só a linha do módulo Staff**.
- **Back** (`exigirFlag('rh')`) olha **qualquer módulo** com `rh = true`.

Eles só coincidem se a flag for sempre concedida na linha do **Staff** (convenção).
Se quiser deixar o front idêntico ao back (olhar qualquer módulo):

```js
const temRH = window.permissoes?.some(p => p.pode_rh || p.pode_supremo) ?? false;
```

Escolha **um** critério e use sempre o mesmo, para não divergir.

---

## 6. Exemplos reais já implementados

| Recurso | Front (esconde) | Back (bloqueia) |
|--------|------------------|------------------|
| **RH mode** | [`RH.js`](../public/js/RH.js) — `temPermissao("Staff","rh") \|\| ...("supremo")` esconde `li.RH` | `exigirFlag('rh','supremo')` no `/rh` |
| **Alíquotas (menu)** | [`Index.js`](../public/js/Index.js) — mesmo critério no item `.abrir-modal` | `/rh/parametros` cai sob o `/rh` protegido |
| **Checkbox Devs** (CadUsuarios) | [`usuarios.js`](../public/js/usuarios.js) — fetch `/auth/permissoes`, esconde se não tem `pode_devs` | `permissoesController` recusa conceder `devs` se o solicitante não for devs |

---

## 7. Checklist para uma tela nova

1. [ ] Definir a permissão necessária (ação de módulo **ou** flag especial).
2. [ ] **Back:** proteger a rota com `verificarPermissao(...)` ou `exigirFlag(...)`.
3. [ ] **Front:** esconder menu/botão/tela com `temPermissao(...)` (ou fetch, se standalone).
4. [ ] Se for na shell, envolver a checagem no `quandoPermissoesProntas(...)`.
5. [ ] Usar o **mesmo critério** (mesmas flags/módulos) no front e no back.
6. [ ] Testar com um usuário **sem** a permissão: não vê **e** toma `403` na API.
