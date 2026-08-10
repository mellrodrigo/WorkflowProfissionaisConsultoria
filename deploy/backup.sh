#!/usr/bin/env bash
# Backup do banco e dos arquivos enviados.
# Sugestão de agendamento (diário às 2h), via `crontab -e`:
#   0 2 * * * /opt/workflow-ntt/deploy/backup.sh >> /var/log/workflow-backup.log 2>&1

set -euo pipefail

APP_DIR=/opt/workflow-ntt
DEST=/var/backups/workflow-ntt
KEEP_DAYS=30
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$DEST"

# .backup do sqlite3 gera cópia consistente mesmo com a aplicação rodando.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$APP_DIR/server/data/workflow.db" ".backup '$DEST/workflow-$STAMP.db'"
else
  echo "aviso: sqlite3 nao instalado, copiando o arquivo direto"
  cp "$APP_DIR/server/data/workflow.db" "$DEST/workflow-$STAMP.db"
fi

tar -czf "$DEST/uploads-$STAMP.tar.gz" -C "$APP_DIR/server" uploads

# Remove backups antigos.
find "$DEST" -type f -mtime +$KEEP_DAYS -delete

echo "[$(date -Is)] backup concluido: $DEST/workflow-$STAMP.db"
