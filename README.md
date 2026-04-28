
## 🧠 JAS (JA-Sistem) 
O JA System é uma plataforma de gestão para o setor de eventos, desenvolvida para a JA Promoções. Projetado para evoluir como um SaaS, ele centraliza o controle de clientes, orçamentos, staff e financeiro em um único ecossistema.

🚀 O Diferencial
Criado para substituir sistemas complexos como o SIGEVENT, o JA System foca na experiência do usuário:

Intuitivo: Interface moderna que elimina caminhos redundantes.

Ágil: Menos burocracia e acesso mais rápido à informação necessária.

Eficiente: Traduz processos complexos em fluxos de trabalho simples e diretos.

Objetivo: Entregar agilidade máxima para que o foco seja o evento, não o sistema.

## ⚙ SETUP

  ### Pré-Requisitos

![Static Badge](https://img.shields.io/badge/18%2B-black?style=for-the-badge&logo=nodedotjs&logoColor=green&label=Node.JS&labelColor=%20black&color=darkgreen&cacheSeconds=black)
![Static Badge](https://img.shields.io/badge/9.0%2B-black?style=for-the-badge&logo=postgresql&logoColor=white&label=Postgres&labelColor=%20black&color=blue&cacheSeconds=black)
![Static Badge](https://img.shields.io/badge/2.48%2B-black?style=for-the-badge&logo=git&logoColor=orange&label=GIT&labelColor=%20black&color=orange&cacheSeconds=black)

### 📥 Instalação

#### 1. Clonar repositório

```bash
git clone https://github.com/JA-Operacoes/JAs.git
# ou
git clone git@github.com:JA-Operacoes/JAs.git
```

#### 2. Acessar o diretório

```bash
cd ja-system
```

#### 3. Instalar dependências

```bash
npm install
```

---

#### 🔐 Variáveis de Ambiente

Crie o arquivo `.env` na raiz do projeto:

```env
PORT=3000
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=**solicite ao seu superior**
DB_NAME=Ja
```

  ### Dependencies
![Static Badge](https://img.shields.io/badge/5.1.1%2B-black?style=for-the-badge&label=Bcrypt&labelColor=black&color=darkred&cacheSeconds=black)
![Static Badge](https://img.shields.io/badge/2.8.5%2B-black?style=for-the-badge&label=Cors&labelColor=black&color=darkred&cacheSeconds=black)
![Static Badge](https://img.shields.io/badge/16.4.7%2B-black?style=for-the-badge&label=Dotenv&labelColor=black&color=darkred&cacheSeconds=black)
![Static Badge](https://img.shields.io/badge/4.21.2%2B-black?style=for-the-badge&label=Express&labelColor=black&color=darkred&cacheSeconds=black)
![Static Badge](https://img.shields.io/badge/4.6.13%2B-black?style=for-the-badge&label=Flatpickr&labelColor=black&color=darkred&cacheSeconds=black)
![Static Badge](https://img.shields.io/badge/2.0.1%2B-black?style=for-the-badge&label=Multer&labelColor=black&color=darkred&cacheSeconds=black)
![Static Badge](https://img.shields.io/badge/8.14.1%2B-black?style=for-the-badge&label=PG&labelColor=black&color=darkred&cacheSeconds=black)
![Static Badge](https://img.shields.io/badge/0.18.5%2B-black?style=for-the-badge&label=Xlsx&labelColor=black&color=darkred&cacheSeconds=black)
![Static Badge](https://img.shields.io/badge/7.0.3%2B-black?style=for-the-badge&label=Nodemailer&labelColor=black&color=darkred&cacheSeconds=black)
![Static Badge](https://img.shields.io/badge/9.0.2%2B-black?style=for-the-badge&label=Json%20Web%20Token&labelColor=black&color=darkred&cacheSeconds=black)
![Static Badge](https://img.shields.io/badge/9.23%2B-black?style=for-the-badge&label=Eslint&labelColor=black&color=darkred&cacheSeconds=black)


## Fluxo do Sistema
  #### Fluxo de Cadastros
  1. Cadastro Cliente
  2. Cadastro Funcionarios
  3. Cadastro Evento
  4. Cadastro Função, Equipamentos e Suprimentos
  5. Criação do Orçamentos (apenas Usuarios Especificos)
  6. Cadastro de Staff
  7. Solicitações Ajuste de Custo, Caixinha, Diaria Dobrada, Meia Diaria, Cache Fechado ou Liberado, Função Excedida, Aditivo ou Extra Bonificado 
  8. Autorização das Solicitaçoes (Apenas senhas Especiais)
  9. Pagamentos dos Staff / Contas

  #### Fluxo Financeiro
  1. Cadastro de Contas, Tipo de Contas, Centro de custo, Plano de Contas
  2. Lançamento de Contas
  3. Pagamentos de Contas / Staff
  4. Lançar os pagamentos das Contas

  ### 🧩ARQUITETURA
      📦 backend 
      ├── 📂 routes → endpoints 
      ├── 📂 controllers → regras de negócio 
      ├── 📂 models → modelos de propostas e contratos 
      ├── 📂 middlewares 
      │    ├── autenticação → JWT + bcrypt 
      │    └── permissão → temPermissao(modulo, acao) 
      └── server.js
      
      📦 frontend 
      ├── 📂 css → Arquivos de Estilização
      │    ├──📂 Flatpickr
      │    ├──📂 Footer
      │    ├──📂 Index
      │    ├──📂 Logins
      │    ├──📂 MensagensSwal
      │    ├──📂 Modal
      │    ├──📂 Roots
      │    ├──📂 Scroolbar
      ├── 📂 js → arquvios de funcionamentos html
      ├── 📂 Python → Arquivos de Manipulação de DOCX
      └── Ja-Oper.html

## Tecnologias utilizadas
![Static Badge](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black) ![Static Badge](https://img.shields.io/badge/Html5-E34F26?style=for-the-badge&logo=html5&logoColor=black) ![Static Badge](https://img.shields.io/badge/Css-%23663399?style=for-the-badge&logo=css&logoColor=black) ![Static Badge](https://img.shields.io/badge/python-blue?style=for-the-badge&logo=python&logoColor=black) ![Static Badge](https://img.shields.io/badge/Node.js-green?style=for-the-badge&logo=nodedotjs&logoColor=black)


## Funcionalidades
- Gerador de Propostas/Orçamentos semi-automatico
- Contratação de Staff direcionados aos Eventos
- MicroFinanceiro ( Contas Comerciais e pagamentos de Funcionarios )
- Agenda Individual para ter acesso as seus compromissos
- Sistema de Notificação entre Usuarios

## Devs
| <img src="https://avatars.githubusercontent.com/u/110931738?v=4" width=115><br><sub>![Static Badge](https://img.shields.io/badge/%40gu5t4v0l-blue?style=for-the-badge&logo=github&logoColor=white&cacheSeconds=black)</sub> | <img src="https://avatars.githubusercontent.com/u/202639384?v=4" width=115><br><sub> ![Static Badge](https://img.shields.io/badge/%40MarcinhaLima-%23C209C1?style=for-the-badge&logo=github&logoColor=white&link=https%3A%2F%2Fgithub.com%2FMarcinhalima) </sub> |
| :---: | :---: |
