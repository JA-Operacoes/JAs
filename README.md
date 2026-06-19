## 🧠 JAS (JA-System)

O **JA System** é uma plataforma de gestão para o setor de eventos, desenvolvida para a JA Promoções. Projetado para evoluir como um SaaS, ele centraliza o controle de **clientes, orçamentos, staff e financeiro** em um único ecossistema multiempresa.

### 🚀 O Diferencial

Criado para substituir sistemas complexos como o SIGEVENT, o JA System foca na experiência do usuário:

- **Intuitivo** — Interface moderna que elimina caminhos redundantes.
- **Ágil** — Menos burocracia e acesso mais rápido à informação necessária.
- **Eficiente** — Traduz processos complexos em fluxos de trabalho simples e diretos.
- **Objetivo** — Entregar agilidade máxima para que o foco seja o evento, não o sistema.

---

## 📑 Índice

1. [Tecnologias](#-tecnologias)
2. [Pré-requisitos](#-pré-requisitos)
3. [Instalação (Setup)](#-instalação-setup)
4. [Variáveis de Ambiente](#-variáveis-de-ambiente)
5. [Como Rodar](#-como-rodar)
6. [Arquitetura](#-arquitetura)
7. [Autenticação e Permissões](#-autenticação-e-permissões)
8. [Multiempresa (Multi-tenant)](#-multiempresa-multi-tenant)
9. [Mapa de Módulos e Rotas](#-mapa-de-módulos-e-rotas)
10. [Geração de Documentos (Python)](#-geração-de-documentos-python)
11. [Fluxos de Uso do Sistema](#-fluxos-de-uso-do-sistema)
12. [Funcionalidades](#-funcionalidades)
13. [Convenções e Versionamento](#-convenções-e-versionamento)
14. [Solução de Problemas](#-solução-de-problemas)
15. [Devs](#-devs)

---

## 🛠 Tecnologias

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black) ![HTML5](https://img.shields.io/badge/Html5-E34F26?style=for-the-badge&logo=html5&logoColor=black) ![CSS](https://img.shields.io/badge/Css-%23663399?style=for-the-badge&logo=css&logoColor=black) ![Python](https://img.shields.io/badge/python-blue?style=for-the-badge&logo=python&logoColor=black) ![Node.js](https://img.shields.io/badge/Node.js-green?style=for-the-badge&logo=nodedotjs&logoColor=black) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

| Camada | Tecnologia |
| --- | --- |
| **Backend** | Node.js + Express.js |
| **Banco de Dados** | PostgreSQL (multiempresa por `idempresa`) |
| **Frontend** | HTML5 + CSS3 + JavaScript puro (sem framework SPA) |
| **Autenticação** | JWT (validade de 10h) + bcrypt |
| **Upload de arquivos** | Multer (fotos de funcionário, contratos até 50MB) |
| **Geração de DOCX** | Python (`docxtpl`, `num2words`, `python-dateutil`, `python-docx`) |
| **E-mail** | Nodemailer |
| **Containerização** | Docker + Docker Compose |

### Principais dependências Node

![Bcrypt](https://img.shields.io/badge/5.1.1%2B-black?style=for-the-badge&label=Bcrypt&labelColor=black&color=darkred) ![Cors](https://img.shields.io/badge/2.8.5%2B-black?style=for-the-badge&label=Cors&labelColor=black&color=darkred) ![Dotenv](https://img.shields.io/badge/16.4.7%2B-black?style=for-the-badge&label=Dotenv&labelColor=black&color=darkred) ![Express](https://img.shields.io/badge/4.21.2%2B-black?style=for-the-badge&label=Express&labelColor=black&color=darkred) ![Flatpickr](https://img.shields.io/badge/4.6.13%2B-black?style=for-the-badge&label=Flatpickr&labelColor=black&color=darkred) ![Multer](https://img.shields.io/badge/2.0.1%2B-black?style=for-the-badge&label=Multer&labelColor=black&color=darkred) ![PG](https://img.shields.io/badge/8.14.1%2B-black?style=for-the-badge&label=PG&labelColor=black&color=darkred) ![Xlsx](https://img.shields.io/badge/0.18.5%2B-black?style=for-the-badge&label=Xlsx&labelColor=black&color=darkred) ![Nodemailer](https://img.shields.io/badge/7.0.3%2B-black?style=for-the-badge&label=Nodemailer&labelColor=black&color=darkred) ![JWT](https://img.shields.io/badge/9.0.2%2B-black?style=for-the-badge&label=Json%20Web%20Token&labelColor=black&color=darkred)

---

## ✅ Pré-requisitos

![Node.JS](https://img.shields.io/badge/18%2B-black?style=for-the-badge&logo=nodedotjs&logoColor=green&label=Node.JS&labelColor=black&color=darkgreen) ![Postgres](https://img.shields.io/badge/9.0%2B-black?style=for-the-badge&logo=postgresql&logoColor=white&label=Postgres&labelColor=black&color=blue) ![Python](https://img.shields.io/badge/3.x-black?style=for-the-badge&logo=python&logoColor=yellow&label=Python&labelColor=black&color=yellow) ![GIT](https://img.shields.io/badge/2.48%2B-black?style=for-the-badge&logo=git&logoColor=orange&label=GIT&labelColor=black&color=orange)

Antes de começar você precisa ter instalado:

- **Node.js** 18 ou superior — https://nodejs.org
- **PostgreSQL** 9.0 ou superior — https://www.postgresql.org/download/
- **Python** 3.x — https://www.python.org/downloads/ (marque **"Add Python to PATH"** na instalação)
- **Git** 2.48 ou superior — https://git-scm.com

> 💡 O Python é obrigatório porque a geração de **propostas e contratos em DOCX** é feita por scripts Python chamados pelo backend.

---

## 📥 Instalação (Setup)

### 1. Clonar o repositório

```bash
git clone https://github.com/JA-Operacoes/JAs.git
# ou via SSH
git clone git@github.com:JA-Operacoes/JAs.git

cd JAs
```

### 2. Instalar TODAS as dependências (Node + Python) automaticamente

Para novos integrantes, basta um comando. Ele **verifica se o Python está instalado**, instala as dependências do Node (`npm install`) e as dependências do Python (`requirements.txt`):

```bash
npm run setup
```

Se o Python não for encontrado, o script avisa com o link de download e encerra — instale o Python e rode `npm run setup` novamente.

<details>
<summary>Instalação manual (passo a passo)</summary>

```bash
# Dependências do Node
npm install

# Dependências do Python
pip install -r requirements.txt
```

</details>

### 3. Configurar o banco de dados

Crie um banco PostgreSQL chamado `JA` (ou o nome que definir em `DB_NAME`). Há um dump disponível na raiz para restaurar a estrutura/dados:

```bash
pg_restore -U postgres -d JA backup.dump
```

### 4. Criar o arquivo `.env` (ver seção abaixo) e rodar o sistema.

---

## 🔐 Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Servidor
PORT=3000
BASE_URL=http://localhost:3000

# Banco de dados PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=**solicite ao seu superior**
DB_NAME=JA

# Autenticação
JWT_SECRET=**chave secreta — solicite ao seu superior**
```

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `PORT` | Porta em que a API sobe | `3000` |
| `BASE_URL` | URL base usada para montar links (ex.: download de propostas) | — |
| `DB_HOST` | Host do PostgreSQL | `localhost` |
| `DB_PORT` | Porta do PostgreSQL | `5432` |
| `DB_USER` | Usuário do banco | — |
| `DB_PASS` | Senha do banco | — |
| `DB_NAME` | Nome do banco | `JA` |
| `JWT_SECRET` | Chave para assinar os tokens JWT (**troque em produção**) | — |

> ⚠️ Nunca faça commit do arquivo `.env`. Senhas e a `JWT_SECRET` devem ser solicitadas ao responsável.

---

## ▶ Como Rodar

### Localmente

```bash
npm start
```

O servidor sobe em `http://localhost:3000` e redireciona a raiz (`/`) para a tela de login (`login.html`).

### Com Docker

```bash
# Produção (API + PostgreSQL)
docker compose -f compose.yaml up --build

# Desenvolvimento com debug (Node Inspector na porta 9229)
docker compose -f compose.debug.yaml up --build
```

| Serviço | Porta |
| --- | --- |
| API (jasystem) | `3000` |
| PostgreSQL | `5432` |
| Debugger (modo debug) | `9229` |

---

## 🧩 Arquitetura

```
📦 JAs
├── server.js              → ponto de entrada; sobe o Express, registra middlewares e rotas
├── db.js / db/conexaoDB.js → pool de conexão PostgreSQL
├── setup.js               → script de instalação (Node + Python) para novos integrantes
├── requirements.txt       → dependências Python
│
├── 📂 routes/             → endpoints (35 arquivos de rota)
├── 📂 controllers/        → regras de negócio (auth, permissões)
├── 📂 middlewares/        → autenticação (JWT), permissões, logs, upload
├── 📂 models/             → templates .docx de propostas e contratos
├── 📂 migrations/         → scripts de migração do banco
├── 📂 utils/              → utilitários compartilhados
├── 📂 uploads/            → arquivos gerados/enviados (propostas, contratos, comprovantes)
│
└── 📂 public/             → FRONTEND
    ├── *.html             → páginas (login, cadastros, orçamento, relatórios…)
    ├── 📂 js/             → lógica de cada tela
    ├── 📂 css/            → estilos (Index, Logins, Modal, MensagensSwal, Flatpickr…)
    ├── 📂 img/            → imagens, ícones, assinaturas
    └── 📂 python/         → scripts de geração de DOCX (Proposta, Contrato, Adicionais)
```

### Pipeline de uma requisição protegida

```
Cliente → Authorization: Bearer <token> + x-id-empresa
   → autenticarToken()      (valida JWT, define req.usuario)
   → contextoEmpresa()      (define e valida req.idempresa)
   → verificarPermissao()   (checa permissão do módulo/ação)
   → Controller / Rota      (regra de negócio)
   → PostgreSQL
   → logMiddleware()        (registra alteração em "logs")
   → Resposta
```

---

## 🔑 Autenticação e Permissões

### Login

`POST /auth/login` recebe **usuário + senha**, valida com `bcrypt` e retorna um **JWT válido por 10 horas** com o payload:

```json
{
  "idusuario": 1,
  "nomeusuario": "João Silva",
  "email": "joao@example.com",
  "empresas": [{ "id": 1, "ativo": true }, { "id": 2, "ativo": false }],
  "idempresaDefault": 1
}
```

### Como autenticar nas demais rotas

Toda rota protegida exige dois headers:

```http
Authorization: Bearer <token>
x-id-empresa: <id da empresa ativa>
```

Se `x-id-empresa` não for enviado, o sistema usa a `idempresaDefault` do token.

### Sistema de permissões (módulo × ação)

Cada usuário tem permissões registradas na tabela `permissoes`, por **módulo** e por **empresa**. As ações disponíveis são:

| Ação | Significa |
| --- | --- |
| `acesso` | Pode acessar o módulo |
| `pesquisar` | Pode listar/buscar |
| `cadastrar` | Pode criar |
| `alterar` | Pode editar |
| `apagar` | Pode excluir |
| `master` / `supremo` / `comercial` / `financeiro` / `devs` | Níveis especiais de acesso |

No backend, a verificação é feita por um middleware factory:

```js
router.get("/", verificarPermissao('Clientes', 'pesquisar'), handler);
```

---

## 🏢 Multiempresa (Multi-tenant)

O sistema é **multiempresa**: quase todas as entidades possuem uma tabela de vínculo `*empresas` (ex.: `clienteempresas`, `funcionarioempresas`, `orcamentoempresas`). Os dados são **isolados por `idempresa`**, derivado do header `x-id-empresa` / token.

- **Soft delete** — registros são desativados via coluna `ativo` em vez de excluídos.
- **Auditoria** — a tabela `logs` guarda quem alterou, o quê, e os dados anteriores/novos.

---

## 🗺 Mapa de Módulos e Rotas

> Prefixos de rota registrados em [server.js](server.js). Rotas **públicas** não exigem token; as demais exigem autenticação.

### Autenticação e administração

| Prefixo | Módulo | Acesso |
| --- | --- | --- |
| `/auth` | Login, cadastro e busca de usuários | 🟢 Público |
| `/permissoes` | Gestão de permissões | 🟢 Público (listagem) |
| `/empresas` | Empresas | 🔒 Protegido |
| `/modulos` | Módulos do sistema | 🔒 Protegido |
| `/index`, `/aside` | Dados de dashboard e sidebar | 🔒 Protegido |

### Cadastros base

| Prefixo | Módulo |
| --- | --- |
| `/clientes` | Clientes |
| `/eventos` | Eventos |
| `/funcionarios` | Funcionários |
| `/profissional` | Profissionais |
| `/funcao` | Funções |
| `/categoriafuncao` | Categorias de função |
| `/equipamentos` | Equipamentos |
| `/suprimentos` | Suprimentos |
| `/fornecedores` | Fornecedores |
| `/localmontagem` | Locais de montagem / pavilhões |
| `/propostatextos` | Textos pré-definidos de propostas |

### Operação de eventos

| Prefixo | Módulo |
| --- | --- |
| `/orcamentos` | Orçamentos (criação, edição, geração de proposta/contrato) |
| `/staff` | Staff / equipe alocada ao evento |
| `/Contrato` | Geração e consulta de contratos |
| `/indiceanual` | Índices anuais (reajustes de preço) |

### Financeiro

| Prefixo | Módulo |
| --- | --- |
| `/bancos` | Bancos |
| `/planocontas` | Plano de contas |
| `/contas` | Contas |
| `/tipoconta` | Tipos de conta |
| `/centrocusto` | Centros de custo |
| `/lancamentos` | Lançamentos financeiros |
| `/pagamentos` | Pagamentos (staff e contas) |

### Dashboard, relatórios e notificações

| Prefixo | Módulo |
| --- | --- |
| `/Main` | Dashboard: agenda, calendário de eventos, vencimentos, contas a pagar, atividades |
| `/relatorios` | Relatórios (eventos, equipe, empresas) |
| `/notificacoes` | Notificações entre usuários (solicitações, orçamentos, pagamentos) |

<details>
<summary>Exemplos de endpoints do módulo de Orçamentos</summary>

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `GET` | `/orcamentos/` | Lista orçamentos (filtro `nrOrcamento`) |
| `POST` | `/orcamentos/` | Cria novo orçamento |
| `PUT` | `/orcamentos/:id` | Atualiza orçamento |
| `PATCH` | `/orcamentos/:id` | Altera status do orçamento |
| `DELETE` | `/orcamentos/:id` | Remove orçamento |
| `GET` | `/orcamentos/:nrOrcamento/proposta` | Gera proposta em DOCX (Python) |
| `GET` | `/orcamentos/:nrOrcamento/proposta/adicionais` | Gera proposta de adicionais |
| `GET` | `/orcamentos/download/proposta/:filename` | Baixa a proposta gerada |
| `POST` | `/orcamentos/uploadContratoManual` | Upload de contrato manual |

</details>

---

## 📄 Geração de Documentos (Python)

Os scripts em [public/python/](public/python/) recebem um **JSON via stdin** (enviado pelo backend Node) e produzem arquivos `.docx` a partir de templates em [models/](models/).

| Script | Template | Saída | Uso |
| --- | --- | --- | --- |
| `Proposta.py` | `models/Proposta.docx` | `uploads/Proposta/Proposta_*.docx` | Proposta comercial completa (itens, staff, valores por extenso) |
| `Adicionais.py` | `models/Proposta_Adicionais.docx` | `uploads/Proposta/Proposta-Adicional_*.docx` | Proposta apenas de itens adicionais |
| `Contrato.py` | `models/Contrato.docx` | `uploads/contratos/Contrato_*.docx` | Contrato com períodos, escopo e assinaturas |

Bibliotecas usadas: `docxtpl`, `num2words` (valores por extenso PT-BR), `python-dateutil` (datas), `python-docx`. Todas instaladas via `requirements.txt`.

---

## 🔄 Fluxos de Uso do Sistema

### Fluxo de Cadastros e Operação

1. Cadastro de **Cliente**
2. Cadastro de **Funcionários**
3. Cadastro de **Evento**
4. Cadastro de **Função, Equipamentos e Suprimentos**
5. Criação do **Orçamento** *(apenas usuários específicos)*
6. Cadastro de **Staff** para o evento
7. **Solicitações** — Ajuste de Custo, Caixinha, Diária Dobrada, Meia Diária, Cachê Fechado/Liberado, Função Excedida, Aditivo ou Extra Bonificado
8. **Autorização** das solicitações *(apenas senhas especiais)*
9. **Pagamentos** de Staff / Contas

### Fluxo Financeiro

1. Cadastro de **Contas, Tipo de Contas, Centro de Custo e Plano de Contas**
2. **Lançamento** de contas
3. **Pagamentos** de contas / staff
4. **Baixa** dos pagamentos das contas

---

## ⭐ Funcionalidades

- Gerador de **Propostas/Orçamentos** semi-automático (DOCX)
- Geração de **Contratos** com assinaturas
- Contratação de **Staff** direcionada aos eventos
- **Microfinanceiro** — contas comerciais e pagamentos de funcionários
- **Agenda individual** de compromissos
- Sistema de **Notificações** entre usuários
- **Relatórios** de eventos, equipe e empresas
- **Índices anuais** para reajuste automático de preços
- **Multiempresa** com permissões granulares por módulo

---

## 📐 Convenções e Versionamento

O versionamento usa os scripts do `package.json`:

```bash
# Correção de bug → incrementa patch (1.0.x) e dá push com a tag
npm run Bug-fix

# Nova funcionalidade → incrementa minor (1.x.0) e dá push com a tag
npm run Novidade
```

Lint do projeto (ESLint flat config):

```bash
npx eslint .
```

---

## 🩺 Solução de Problemas

| Problema | Causa provável | Solução |
| --- | --- | --- |
| `npm run setup` falha dizendo que Python não foi encontrado | Python não instalado ou fora do PATH | Instale o Python 3 marcando "Add Python to PATH" e rode de novo |
| Erro ao gerar proposta/contrato | Dependências Python ausentes | Rode `pip install -r requirements.txt` |
| Erro de conexão ao banco | `.env` incorreto ou Postgres parado | Verifique as variáveis `DB_*` e se o serviço PostgreSQL está rodando |
| `401 / token inválido` | Token expirado (validade 10h) ou ausente | Faça login novamente e envie o header `Authorization: Bearer <token>` |
| `403 sem permissão` | Usuário sem permissão no módulo/empresa | Ajuste as permissões em `/permissoes` ou verifique o header `x-id-empresa` |

---

## 👥 Devs

| <img src="https://avatars.githubusercontent.com/u/110931738?v=4" width=115><br><sub>![gu5t4v0l](https://img.shields.io/badge/%40gu5t4v0l-blue?style=for-the-badge&logo=github&logoColor=white)</sub> | <img src="https://avatars.githubusercontent.com/u/202639384?v=4" width=115><br><sub>![MarcinhaLima](https://img.shields.io/badge/%40MarcinhaLima-%23C209C1?style=for-the-badge&logo=github&logoColor=white)</sub> |
| :---: | :---: |
