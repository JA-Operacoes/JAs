-- Migration: adiciona idempresaemissora em orcamentos
--
-- Qual empresa (da tabela empresas) emite a Nota Fiscal deste orcamento —
-- os dados dela (CNPJ, inscricao municipal, regime tributario) e que vao
-- como emitente na NFS-e. Nao e necessariamente a mesma empresa vinculada
-- em orcamentoempresas (aquela e "de qual empresa e o orcamento" pro
-- contexto/permissao do sistema; esta e "quem fatura pro cliente").
--
-- Nullable: orcamentos antigos nao tem isso preenchido, e a escolha so
-- passa a ser exigida daqui pra frente pela tela.

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS idempresaemissora INTEGER REFERENCES empresas(idempresa);
