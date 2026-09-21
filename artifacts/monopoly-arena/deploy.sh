#!/bin/bash
set -e

cd /root/monopoly-arena/artifacts/monopoly-arena

echo "📦 Сборка проекта..."
pnpm build

echo "🚀 Загрузка на reg.ru..."
rsync -avz --delete \
  /root/monopoly-arena/artifacts/monopoly-arena/dist/public/ \
  u3613334@server168.hosting.reg.ru:/var/www/u3613334/data/www/monopoly-arena.ru/

echo "✅ Готово! Сайт обновлён."
