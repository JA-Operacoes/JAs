-- Migration: adiciona_area_funcionario_em_almoxarifadogeralhistorico
-- Criada em: 2026-09-30T17:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Não dá pra inferir do cadastro do funcionário se ele é do Pavilhão ou do
-- Escritório (não existe esse campo lá, e não é o caso de criar um — quem
-- retira hoje pode estar noutra função amanhã). Fica um switch manual na hora
-- do consumo mesmo, específico dessa tela: quem está registrando marca pra
-- qual time é a retirada. Só faz sentido quando tem um funcionário
-- selecionado (idfuncionario_solicitante preenchido), por isso fica opcional.
ALTER TABLE almoxarifadogeralhistorico
ADD COLUMN IF NOT EXISTS area_funcionario VARCHAR(20)
    CHECK (area_funcionario IN ('Pavilhão', 'Escritório'));
