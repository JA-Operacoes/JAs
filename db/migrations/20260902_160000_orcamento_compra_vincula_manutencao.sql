ALTER TABLE equipamentoorcamentocompra DROP CONSTRAINT IF EXISTS equipamentoorcamentocompra_idequip_fkey;
ALTER TABLE equipamentoorcamentocompra RENAME COLUMN idequip TO idmanutencao;
ALTER TABLE equipamentoorcamentocompra
  ADD CONSTRAINT equipamentoorcamentocompra_idmanutencao_fkey
  FOREIGN KEY (idmanutencao) REFERENCES equipamentomanutencao(idmanutencao);
