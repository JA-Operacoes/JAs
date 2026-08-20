-- Migration: backfill dtcaixinha e chaveitem para registros existentes de caixinha
-- Criada em: 2026-08-18T17:51:49.538Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- A migration que criou dtcaixinha (jsonb) deu DEFAULT '[]' pra TODAS as linhas já
-- existentes, mesmo as que já tinham caixinha no formato antigo (vlrcaixinha/
-- statuscaixinha/desccaixinha/comppgtocaixinha, colunas soltas). Resultado: registro
-- antigo com caixinha autorizada de R$150 aparecia na tabela normalmente (colunas
-- legado ainda existem) mas ao abrir pra editar o checkbox não marcava e a lista
-- ficava vazia, porque o front agora só olha pro array. Este backfill sintetiza UM
-- item a partir do valor antigo, só pra linha que ainda está com array vazio.
UPDATE staffeventos
SET dtcaixinha = jsonb_build_array(
    jsonb_build_object(
        'iditem', 'legacy-' || idstaffevento,
        'valor', vlrcaixinha,
        'status', COALESCE(NULLIF(statuscaixinha, ''), 'Pendente'),
        'justificativa', COALESCE(desccaixinha, ''),
        'data', to_char(COALESCE(
            (SELECT MIN(dtsolicitacao)::date FROM solicitacoes
             WHERE idregistroalterado = staffeventos.idstaffevento AND categoria_log = 'statuscaixinha'),
            CURRENT_DATE
        ), 'YYYY-MM-DD'),
        'comprovante', comppgtocaixinha
    )
)
WHERE (dtcaixinha IS NULL OR dtcaixinha = '[]'::jsonb)
  AND (COALESCE(vlrcaixinha, 0) <> 0 OR COALESCE(statuscaixinha, '') <> '');

-- Solicitações antigas de caixinha (categoria_log='statuscaixinha') não tinham chaveitem
-- (coluna nova, adicionada depois). Sem isso, o próximo save desse registro criaria uma
-- solicitação DUPLICADA em vez de reconhecer/atualizar a existente pelo item sintetizado
-- acima (que usa o mesmo padrão 'legacy-<idstaffevento>' como chave).
UPDATE solicitacoes
SET chaveitem = 'legacy-' || idregistroalterado
WHERE categoria_log = 'statuscaixinha' AND chaveitem IS NULL;
