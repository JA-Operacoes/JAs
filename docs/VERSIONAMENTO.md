# Versionamento

Guia de como e quando subir a versão do projeto (`package.json`) ao publicar uma branch.
Serve como referência pra padronizar — toda branch nova deve seguir isto.

---

## 1. Modelo (SemVer)

A versão segue `MAJOR.MINOR.PATCH` (ex.: `1.0.9`):

| Posição | Nome | Muda quando... |
|---|---|---|
| 1º | **MAJOR** | Mudança que **quebra compatibilidade** — algo que outra parte do sistema/equipe já dependia passa a funcionar de um jeito incompatível (ex.: remover/renomear uma rota que alguém usa, mudar estrutura de dados exigindo migração manual). Raro e deliberado. |
| 2º | **MINOR** | **Funcionalidade nova**, sem quebrar o que já existia — quem já usa o sistema continua funcionando igual, só ganhou algo a mais. |
| 3º | **PATCH** | **Correção de bug** ou ajuste pequeno, sem funcionalidade nova nem quebra. |

Na dúvida entre PATCH e MINOR: se dá pra descrever como "corrigi X", é PATCH; se é "agora dá pra fazer Y", é MINOR.

---

## 2. Passo a passo — commit e publicação de branch

**1. Trabalhe na sua branch de feature** (como já é feito hoje). Mensagens de commit em português, descritivas. Se puder, use palavras como "corrige"/"ajusta" (bug) ou "adiciona"/"inclusão"/"nova tela" (funcionalidade nova) — é o que o hook usa pra sugerir o tipo de versão depois (ver §3).

**2. Publique a branch** (`git push`). Isso já dispara o hook sozinho — não precisa rodar nada manualmente.

**3. Confira a sugestão** em **`SUGESTAO-VERSAO.txt`** (raiz do projeto, gerado/sobrescrito a cada push). Exemplo:
```
📦 Sugestão de versão pra branch "..."
→ Sugerido: MINOR (1.0.9 → 1.1.0)
Depois do merge, rodar na main: npm run Novidade
```
É só um aviso — não bloqueia o push, mesmo se você discordar.

**4. Abra e mescle o Pull Request** normalmente.

**5. Troque pra `main` e atualize** (Fetch/Pull no GitHub Desktop, ou `git checkout main && git pull` no terminal).

**6. Rode o comando sugerido, na `main`, pelo terminal:**

| Sugestão | Comando |
|---|---|
| PATCH | `npm run Bug-fix` |
| MINOR | `npm run Novidade` |
| MAJOR | `npm run Breaking` |

Cada um faz tudo de uma vez: sobe o número no `package.json`, cria o commit, cria a tag `vX.Y.Z` e publica os dois pro GitHub (`npm version <tipo> && git push --follow-tags`).

> Se a sugestão parecer errada (nenhuma palavra-chave reconhecida, ou você acha que devia ser outro nível), rode `npm version patch|minor|major && git push --follow-tags` na mão, ignorando o arquivo — a sugestão é só um apoio, a decisão final é sempre sua.

---

## 3. Como o hook funciona (referência técnica)

- **[`githooks/pre-push`](../githooks/pre-push)** — script de hook do git, disparado a cada `git push`. Sempre termina com `exit 0` (nunca bloqueia o push).
- **[`scripts/sugerir-versao.js`](../scripts/sugerir-versao.js)** — a lógica de verdade:
  1. Se a branch atual for `main`/`master`, não sugere nada (a sugestão é só pra branch de feature, antes do merge).
  2. Compara a branch atual com `origin/main` (faz um `git fetch` best-effort antes).
  3. Classifica cada commit da branch por palavra-chave na mensagem (heurística simples, não é Conventional Commits):
     - `breaking change`, `quebra compatibilidade`, `incompatível` → MAJOR
     - `adiciona`, `inclusão`, `nova tela`, `novo módulo`, `feature`, `implementa`, `cria` → MINOR
     - `corrige`, `correção`, `fix`, `ajusta`, `bug` → PATCH
  4. Usa o bump de **maior severidade** encontrado (major > minor > patch) como sugestão.
  5. Escreve o resultado no console **e** em `SUGESTAO-VERSAO.txt` (raiz do projeto) — o arquivo existe porque programas de git sem console visível (ex.: GitHub Desktop) não mostram saída de hook que termina sem erro.
- **`SUGESTAO-VERSAO.txt`** está no `.gitignore` — é local/informativo, sobrescrito a cada push, nunca deve ser commitado.
- **Ativação automática**: o script `"prepare"` do `package.json` roda `git config core.hooksPath githooks` — todo dev que rodar `npm install` já ativa o hook automaticamente, sem passo manual.

---

## 4. Checklist pra quem for mexer nisso

1. [ ] Testar o hook direto (`node scripts/sugerir-versao.js`) antes de confiar na sugestão numa branch nova.
2. [ ] Se adicionar uma palavra-chave nova à heurística, atualizar a tabela do §3 aqui também.
3. [ ] Nunca remover o `exit 0` do `githooks/pre-push` — o hook é só um aviso, nunca deve impedir um push.
