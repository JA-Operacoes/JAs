-- Migration: adiciona idstaffeventopago e comprovante em staffajustefinanceiro
-- Criada em: 2026-07-30T13:57:31.277Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- idstaffeventopago: evento onde o credito/debito foi efetivamente PAGO (marcado na tela
-- de Vencimentos do Main). So e preenchido quando status vira 'Pago' -- ate la, o lancamento
-- e considerado "em aberto" e aparece em todos os eventos do funcionario (ver rotaStaff.js).
-- Distinto de idstaffeventoorigem, que e o evento onde o lancamento foi GERADO.
--
-- comprovante: caminho do arquivo (imagem/PDF) anexado ao credito/debito, mesmo padrao
-- dos demais comprovantes do sistema (uploads/staff_comprovantes).

ALTER TABLE staffajustefinanceiro ADD COLUMN IF NOT EXISTS idstaffeventopago INTEGER REFERENCES staffeventos(idstaffevento);
ALTER TABLE staffajustefinanceiro ADD COLUMN IF NOT EXISTS comprovante TEXT;

