# Monopoly Arena — передача проекта в новый чат

## Стек и инфраструктура

- **Фронт:** React 18 + Vite + TypeScript, один файл `App.tsx` (~8000 строк).
- **Бэк:** Node.js + Express + Socket.IO, один файл `server.js` (~2600 строк).
- **БД:** PostgreSQL 18 на localhost (порт 5432). Пользователь `monopoly_user`, база `monopoly_arena`. Пароль в `.env`.
- **Хостинг:** reg.ru, Ubuntu 26.04, pm2, nginx. Деплой — `deploy` из корня монорепо (собирает фронт и rsync'ит на сервер).
- **PM2:** процесс `server` запускает `server.js` из корня монорепо.
- **Сервер:** 4 vCPU, 6 ГБ RAM, 60 ГБ SSD.

## Расположение файлов

- `~/monopoly-arena/server.js` — весь бэк (правится именно этот файл, не в artifacts).
- `~/monopoly-arena/artifacts/monopoly-arena/src/App.tsx` — весь фронт.
- `~/monopoly-arena/.env` — `DATABASE_URL=postgres://monopoly_user:PASSWORD@127.0.0.1:5432/monopoly_arena`.
- `~/monopoly-arena/schema.sql` — схема БД (13 таблиц).
- `~/monopoly-arena/schema-trades.sql` — таблица `trades`.
- `~/monopoly-arena/schema-quests-v2.sql` — колонки `progress` и `target` в `quest_progress`.
- `~/monopoly-arena/migrate-to-pg.js` — одноразовая миграция JSON → PostgreSQL (уже сделана).
- `~/monopoly-arena/scripts/backup-db.sh` + cron — ежедневный бэкап БД в 03:00 UTC, ротация 7 дней.
- `~/monopoly-arena/backups/` — бэкапы JSON и БД.

## Структура БД (13 таблиц)

- `users` — id, login, password (bcryptjs), name, initials, color, guest, created_at.
- `user_data` — user_id, coins, stats (JSONB), vip_until, minutes_online.
- `inventory` — user_id, market_item_id, item_data (JSONB, снапшот предмета), owned_at. В `item_data` может быть `lockedInTradeId` (заблокирован в обмене) и `tradedAt` (время последнего обмена).
- `active_skins` — user_id, slot_index, inventory_item_id (уникальный id предмета в инвентаре).
- `friendships` — user_id, friend_id, status ('pending' | 'accepted').
- `notifications` — user_id, text, read, created_at.
- `quest_progress` — user_id, day_key (или week_key), quest_id, done, claimed, progress, target.
- `market_listings` — id, seller_id, item_data, price, created_at.
- `market_items` — товары магазина (id, data JSONB).
- `card_designs` — дизайны карточек (id, slot_index, data).
- `admin_cases` — кейсы (id, data).
- `admin_settings` — одна строка (id=1, data).
- `trades` — id, from_user_id, to_user_id, from_items (JSONB), to_items (JSONB), status ('pending' | 'accepted' | 'declined' | 'cancelled'), created_at, resolved_at.
- `transactions` — id, user_id, type, amount, metadata, created_at.

## Что полностью сделано

### Аутентификация
- Регистрация + вход + гостевой режим.
- Пароли хэшируются через `bcryptjs` (10 раундов).
- Гость не может покупать, получать квесты, добавлять друзей. При закрытии вкладки удаляется.

### PostgreSQL
- Полный переход с JSON-файлов на PostgreSQL.
- Все JSON-данные мигрированы.
- Сохранение и загрузка через `saveUserData`, `saveUsers`, `changeBalance`, `logTransaction`.

### Экономика — всё на сервере
Клиент только отображает. Все операции с Coins и предметами идут через сервер:
- Квесты (claim).
- Магазин: покупка карточек, кейсов, VIP.
- Открытие кейса (дроп рандомит сервер).
- Рынок: выставление, покупка, снятие, с комиссией 10%.
- Обмены (трейды).
- Награды за партию (`finalizeGame`).

### changeBalance — единая точка изменения баланса
Все операции идут через неё. Логирует в `transactions`. Возвращает `{ success, newBalance }`.

### finalizeGame — серверные награды за партию
Правила:
- 1 живой → place 1.
- Банкроты → по порядку выбывания.
- Вышел живым (leftAlive) → place 0, без награды.
- VIP ×2 к XP.
- Дроп 25% из активных `market_items`.
- Запись `transactions` типа `game_reward`.
- Эмит `game-rewards` клиенту.

### Транзакции (transactions)
Типы: `quest_claim`, `game_reward`, `shop_buy`, `market_buy`, `market_sell`, `market_buy_refund`, `case_drop`, `deposit` (заготовка).

### Кошелёк
- Модалка `WalletModal` — баланс, приход/расход за 30 дней, фильтры, история.
- Открывается из дропдауна на нике и из профиля.
- Кнопка «Пополнить» — заглушка «Скоро» (ждёт эквайер).

### Обмен предметами
- Асинхронный. Максимум 10 предметов с каждой стороны.
- Партнёр — по ID или из друзей.
- Статусы: pending / accepted / declined / cancelled.
- Заблокированные предметы (`lockedInTradeId`) нельзя продать/обменять.
- После обмена предмет получает `tradedAt` → 2 часа нельзя ни продать, ни обменять.
- Уведомления обеим сторонам.
- Вкладки в Инвентаре: «Обмены» (входящие + исходящие с отменой) и «История» (обмены + дропы).

### Друзья
- Real-time через события `friends-updated` и `friend-requests-updated`.
- Взаимное удаление (если A удалил B — у B тоже пропадает).
- Разделение запросов: «Входящие» и «Исходящие» (с кнопкой отмены).

### Уведомления
- В шапке, колокольчик. Только непрочитанные подсвечиваются.
- События: награды за партию, продажа на рынке, обмены, друзья.
- Функция `notifyUser(userId, text)` на сервере.

### Квесты
- Ежедневные: dailyLogin (5), playGame (10), winGame (20), buyProperty (5), improveProperty (10). Всего 50/день.
- Еженедельные: weeklyWin3 (50), weeklyPlay10 (30), weeklyMonopoly (100), weeklyMarketDeal (20). Всего 200/нед.
- Сброс daily — в полночь по МСК, weekly — в ночь с воскресенья на понедельник.
- Прогресс-бар для квестов с target > 1.
- Вкладки в окне «Задания» на главной.

### Магазин
- Только кейсы и VIP. Прямые продажи карточек убраны (но код закомментирован, `section` всегда `"cases"`).
- Цены настраиваются через админку.

### Рынок
- Комиссия 10% — продавец получает 90% от цены, покупатель платит 100%. В UI показывается расчёт.
- Лимиты цен по редкости: common ≥ 25, rare ≥ 150, epic ≥ 500, legendary ≥ 2000. Максимум безлимит.
- Защита от двойной покупки через `buyLocks`.

### Админ-панель
- Настройки партии (стартовый капитал, налоги, джекпот, ставки).
- Редактор карточек поля (40 слотов).
- Кейсы (создание, редактирование, включение/отключение).
- Товары (карточки, кубики, VIP).
- Дизайны кубиков.

### Технические защиты
- `buyLocks` — Set блокировок покупок на пользователя (защита от двойного клика / React StrictMode).
- `save-user-data` принимает только `stats` и `minutesOnline` от клиента (не inventory, не coins).
- Пароли — bcryptjs.
- AccessGate (пароль на сайт во время теста): `Monopoly2026`, хранится в `localStorage` под ключом `arena-access-granted`.

## Ключевые экономические соглашения

- **Курс:** 1₽ ≈ 5 Coins.
- **VIP:** +20% Coins, ×2 к XP. 7 дней = 99₽ / 500 Coins, 14 дней = 149₽ / 750 Coins, 30 дней = 249₽ / 1250 Coins.
- **Кейсы:** 149₽ / 750 Coins. Внутри: common 60%, rare 25%, epic 12%, legendary 3%.
- **Прямые цены карточек (в рублях, для админки):** common 30-40₽, rare 100-150₽, epic 300-350₽, legendary 600-700₽.
- **Комиссия рынка:** 10% (сжигается, сток Coins).
- **Пакеты Coins (для эквайринга, ещё не подключены):** 500/99₽, 1200/199₽, 2500/399₽, 5000/699₽, 10000/1299₽, 25000/2999₽.

## Что отложено (не делать до запуска)

- Достижения (разовые).
- Топ игроков (лидерборд).
- Полноценный 2×2.
- Боевой пропуск, стартовые наборы, сезонные кейсы.

## Что в плане прямо сейчас

### 1. Три режима игры (СЛЕДУЮЩАЯ ЗАДАЧА)
Игровой стол по полям не меняется, меняется только логика:
- **Классика** — как сейчас.
- **Быстрая игра** — старт 10 000 К, время хода 20 сек, аренда ×1.5, тюрьма 1 попытка, бонусы увеличены.
- **Дуэль** — 1×1, старт 10 000 К, время 20 сек, короткий стол.

Реализация: флаги в `LobbyRoom`, сервер пробрасывает в `settings`, `BoardGame` применяет при расчётах.

### 2. SEO-база
- `index.html`: title, description, keywords, Open Graph, Twitter Card.
- Schema.org (тип VideoGame).
- Лендинговая страница с описанием игры.

### 3. Эквайринг (ждёт ОКВЭД от владельца)
- Кнопка «Пополнить» уже есть (заглушка).
- Тип `deposit` в transactions заготовлен.
- Интеграция — ЮKassa / CloudPayments.

## Правила работы в чате

- Владелец проекта знает код и сервер.
- Деплой: из корня `~/monopoly-arena` командой `deploy` (сборка + rsync на reg.ru).
- Перезапуск сервера: `pm2 restart server`.
- Логи: `pm2 logs server --lines 20 --nostream`.
- БД: `PGPASSWORD='...' psql -h 127.0.0.1 -U monopoly_user -d monopoly_arena`.
- Коммиты: осмысленные, после каждой крупной фичи. `git log --oneline -20` показывает историю.
- Формат работы: 2-3 шага за раз, точные «найди X → замени на Y», проверка после каждого шага.

## Последние коммиты
1c6dd3c Комиссия 10% на рынке + защита от двойной покупки + синхронизация инвентаря с сервера
8529f05 Счётчик входящих обменов на пункте меню Инвентарь
e684bc7 Серверное открытие кейсов + кошелёк и VIP в шапке
fa1c10e active_skins по inventory_item_id: один скин на слот, разные слоты независимы
97ab4ca Полный переход server.js на PostgreSQL: settings, cases, items, designs, listings
eaba657 PostgreSQL: миграция данных, schema, обновлённые .gitignore и server.js

(Полный список: `cd ~/monopoly-arena && git log --oneline -30`)

## Как продолжить работу в новом чате

1. Прикрепи файлы: `server.js`, `App.tsx`, `HANDOFF.md`.
2. Приложи `git log --oneline -20`.
3. Приложи 2-3 скриншота текущего состояния сайта.
4. Напиши: «Прочитай HANDOFF.md, продолжаем с задачи X».

## Известные баги / TODO в коде

- `section` в `Shop` — константа "cases", но переменная осталась, чтобы не ломать JSX. Не трогать.
- Закомментированные блоки с прямыми продажами карточек — держим для возможной реакции, но не активируем.
- В `App.tsx` есть `useLocalStorage` хук, местами дублирующий серверную синхронизацию — со временем уберём.

