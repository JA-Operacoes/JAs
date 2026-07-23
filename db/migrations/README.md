# Migrations do banco

Cada mudança de **estrutura** do banco (nova tabela, nova coluna, índice, etc.)
vira um arquivo `.sql` **numerado** aqui dentro. O runner (`db/migrate.js`)
aplica, em ordem, os arquivos que ainda não foram aplicados em cada banco.

## Por que isso existe

Antes o banco era promovido por "foto" (dump/restore), o que fazia um dev
**sobrescrever** o trabalho do outro e não dava pra levar mudanças pra produção
sem apagar os dados reais. Com migrations:

- Os 2 devs criam arquivos **diferentes** → o Git junta sem conflito.
- Cada ambiente (local, teste, produção) aplica só as migrations que faltam.
- A produção recebe **só as mudanças de estrutura**, sem tocar nos dados reais.

## Como criar uma migration

1. Crie um arquivo com o **próximo número** e um nome curto do que ele faz:
   ```
   db/migrations/003_adiciona_coluna_cpf_em_clientes.sql
   ```
   > Use sempre 3 dígitos (`001`, `002`, ...) pra ordenar certo. Combine com o
   > time pra não repetir número. Se dois devs usarem o mesmo, é só renumerar.

2. Escreva o SQL da mudança. Exemplo:
   ```sql
   ALTER TABLE clientes ADD COLUMN cpf varchar(14);
   ```

3. Aplique:
   ```powershell
   # no LOCAL (Postgres nativo)
   npm run migrate

   # no TESTE (dentro do container)
   docker compose -p jasystem-test -f compose.yaml -f compose.test.yaml --env-file .env.test exec app npm run migrate
   ```

4. Commite o arquivo no Git junto com o código que depende dele.

## Regras importantes

- **Nunca edite uma migration já aplicada e commitada.** Se precisa corrigir,
  crie uma nova migration com a correção. (O runner só aplica cada arquivo uma
  vez; editar o antigo não reaplica.)
- Cada arquivo roda dentro de uma **transação**: se der erro no meio, nada dele
  é aplicado (ROLLBACK) e o processo para.
- **Baseline:** os bancos hoje já têm a estrutura atual (veio do dump). As
  migrations valem pras mudanças **daqui pra frente**. A tabela de controle
  `schema_migrations` começa vazia e vai registrando o que for aplicado.

## Tabela de controle

O runner cria e mantém a tabela `schema_migrations` (uma linha por arquivo
aplicado, com a data). É assim que ele sabe o que já rodou em cada banco.
