-- Migration: adiciona fks faltantes no modulo de contas a pagar
-- Criada em: 2026-09-01T19:03:52.242Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- Verificado antes de escrever (node -e contra db/conexaoDB.js, banco local):
-- zero linhas orfas em qualquer uma das colunas abaixo. Nao inclui:
--   - contas.idvinculo / lancamentos.idvinculo: vinculo polimorfico (o valor de
--     tipovinculo decide se aponta pra fornecedores/funcionarios/clientes) —
--     Postgres nao aceita FK condicional, teria que ser trigger ou CHECK function.
--   - fornecedorempresas.codbanco: guarda o codigo Febraban (ex.: 237, 341), o
--     mesmo valor de bancos.codbanco (varchar) — nao de bancos.idbanco (a PK
--     surrogate que as outras tabelas usam). Tipo e coluna errados; precisa de
--     migration + ajuste de codigo (rotaFornecedores.js e Fornecedores.js)
--     separados, nao cabe como "so adicionar FK".

ALTER TABLE contas
  ADD CONSTRAINT contas_idtipoconta_fkey FOREIGN KEY (idtipoconta) REFERENCES tipoconta(idtipoconta),
  ADD CONSTRAINT contas_idplanocontas_fkey FOREIGN KEY (idplanocontas) REFERENCES planocontas(idplanocontas),
  ADD CONSTRAINT contas_idcentrocusto_fkey FOREIGN KEY (idcentrocusto) REFERENCES centrocusto(idcentrocusto),
  ADD CONSTRAINT contas_idempresapagadora_fkey FOREIGN KEY (idempresapagadora) REFERENCES empresas(idempresa);

ALTER TABLE lancamentos
  ADD CONSTRAINT lancamentos_idtipoconta_fkey FOREIGN KEY (idtipoconta) REFERENCES tipoconta(idtipoconta),
  ADD CONSTRAINT lancamentos_idempresapagadora_fkey FOREIGN KEY (idempresapagadora) REFERENCES empresas(idempresa),
  ADD CONSTRAINT lancamentos_idplanocontas_fkey FOREIGN KEY (idplanocontas) REFERENCES planocontas(idplanocontas);

ALTER TABLE tipoconta
  ADD CONSTRAINT tipoconta_idempresa_fkey FOREIGN KEY (idempresa) REFERENCES empresas(idempresa);

ALTER TABLE planocontas
  ADD CONSTRAINT planocontas_idempresa_fkey FOREIGN KEY (idempresa) REFERENCES empresas(idempresa);

ALTER TABLE fornecedorempresas
  ADD CONSTRAINT fornecedorempresas_idempresa_fkey FOREIGN KEY (idempresa) REFERENCES empresas(idempresa);
