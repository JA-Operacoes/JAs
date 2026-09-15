-- Migration: corrige_separacao_presa_sem_unidade_no_evento
-- Criada em: 2026-09-14T09:00:00.000Z
--
-- idevento_separacao só deve ficar preenchido enquanto a unidade está de fato
-- no evento (status='evento'). Registros com idevento_separacao preenchido mas
-- status diferente de 'evento' são sobra de versões antigas do fluxo de
-- separação (que marcavam o campo sem mover a unidade, ou que retornavam a
-- unidade ao estoque sem limpar o campo). Cura esse estado inconsistente.

UPDATE equipamentounidade
   SET idevento_separacao = NULL, separado_em = NULL, separado_por = NULL
 WHERE idevento_separacao IS NOT NULL
   AND status <> 'evento';
