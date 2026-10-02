-- Migration: cria_relatoriopreferencias
-- Criada em: 2026-10-01
--
-- Relatórios > Fechamento de Staff: colunas (e blocos Utilização de Diárias / Contingência) que o
-- usuário escolheu NÃO imprimir. Na tela elas continuam aparecendo esmaecidas; só saem da
-- impressão e do Excel. A escolha vale por usuário + empresa + tipo de relatório, para o
-- Financeiro não precisar desmarcar tudo de novo a cada acesso nem em outro computador.
-- `ocultas` = lista JSON com os rótulos de coluna do cabeçalho do relatório (ex.: "STATUS
-- COMPROVANTE") e os marcadores "_util" e "_cont" dos dois blocos.
CREATE TABLE IF NOT EXISTS relatoriopreferencias (
  idusuario     INTEGER NOT NULL REFERENCES usuarios(idusuario) ON DELETE CASCADE,
  idempresa     INTEGER NOT NULL REFERENCES empresas(idempresa) ON DELETE CASCADE,
  tiporelatorio VARCHAR(30) NOT NULL,
  ocultas       JSONB NOT NULL DEFAULT '[]'::jsonb,
  atualizadoem  TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (idusuario, idempresa, tiporelatorio)
);
