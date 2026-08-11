-- Migration: criar table meiospagamento
--
-- Tabela de referencia fixa (codigos definidos pela Receita, campo tPag dos
-- leiautes fiscais nacionais) — nao e um cadastro livre do usuario. Usada
-- hoje so para controle interno de conciliacao financeira: a NFS-e de Sao
-- Paulo emitida na pratica NAO carrega esse campo (dados bancarios e
-- vencimento vao em texto livre na descricao do servico), entao isso nao e
-- obrigatorio para a emissao em si.

CREATE TABLE IF NOT EXISTS meiospagamento (
  codigo      VARCHAR(2) PRIMARY KEY,
  descricao   VARCHAR(60) NOT NULL
);

INSERT INTO meiospagamento (codigo, descricao) VALUES
  ('01','Dinheiro'),
  ('02','Cheque'),
  ('03','Cartão de crédito'),
  ('04','Cartão de débito'),
  ('05','Crédito loja'),
  ('10','Vale alimentação'),
  ('11','Vale refeição'),
  ('12','Vale presente'),
  ('13','Vale combustível'),
  ('15','Boleto bancário'),
  ('16','Depósito bancário'),
  ('17','PIX'),
  ('18','Transferência bancária / carteira digital'),
  ('19','Programa de fidelidade / cashback / crédito virtual'),
  ('90','Sem pagamento'),
  ('99','Outros')
ON CONFLICT (codigo) DO NOTHING;
