#!/bin/bash
# Restaura o backup mais recente (formato custom do pg_dump -Fc) no banco
# recém-criado. Roda apenas uma vez, no primeiro `up`, enquanto o volume
# db_data está vazio.
set -e

BACKUP_DIR=/docker-entrypoint-initdb.d/backups

# Pega o arquivo .sql mais recente da pasta de backups (ordena por data, pega o 1o).
DUMP=$(ls -t "$BACKUP_DIR"/*.sql 2>/dev/null | head -n 1)

if [ -z "$DUMP" ]; then
  echo ">> AVISO: nenhum backup encontrado em $BACKUP_DIR — banco iniciara VAZIO."
  exit 0
fi

echo ">> Restaurando '$DUMP' em '$POSTGRES_DB'..."
pg_restore \
  --no-owner \
  --no-privileges \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  "$DUMP"
echo ">> Restore concluído."
