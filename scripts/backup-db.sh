#!/bin/bash
# Ежедневный бэкап PostgreSQL. Хранит последние 7 копий.
# Запускается из cron: 0 3 * * * /root/monopoly-arena/scripts/backup-db.sh

set -e

# Загружаем DATABASE_URL из .env
source /root/monopoly-arena/.env
export PGPASSWORD=$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')

DB_HOST="127.0.0.1"
DB_PORT="5432"
DB_USER="monopoly_user"
DB_NAME="monopoly_arena"

BACKUP_DIR="/root/monopoly-arena/backups/db"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE="$BACKUP_DIR/monopoly_arena_$TIMESTAMP.sql.gz"

# Делаем дамп и сжимаем
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ Бэкап создан: $BACKUP_FILE ($SIZE)"

# Ротация: удаляем всё старше 7 дней
find "$BACKUP_DIR" -name "monopoly_arena_*.sql.gz" -mtime +7 -delete
echo "[$(date +'%Y-%m-%d %H:%M:%S')] 🧹 Ротация: удалены бэкапы старше 7 дней"
