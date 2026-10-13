## 82a1e73 — feat(game): окна подтверждения для «Покинуть игру» и «Сдаться»

**App.tsx:**
- Добавлены стейты `confirmExit`, `confirmSurrender` в BoardGame.
- Кнопка «Покинуть игру» (панель «Ход сейчас») больше не выходит сразу — открывает окно подтверждения с вариантами «Остаться» / «Да, покинуть».
- Попап «Сдаться» (в списке игроков) открывает окно подтверждения с вариантами «Остаться» / «Да, сдаться».
- Если игрок уже банкрот — кнопка «Покинуть игру» ведёт на показ награды как раньше (без подтверждения).
- Защита от случайного выхода при промахе по кнопке «Бросить кубики».

## 55f12c7 — fix(log/auction): единый timestamp логов, детальный лог голосования, авто-выкуп obliged-winner, число джекпота

**1. Порядок логов в чате (единый серверный timestamp).**
- Причина: sender писал лог локально со своим timestamp, остальные получали broadcast с их timestamp. При параллельных событиях порядок разъезжался.
- server.js: `game-log-add` теперь присваивает единый `timestamp: Date.now()` и рассылает ВСЕМ через `io.to(roomId).emit('game-log-add-broadcast', entry)` (было `socket.to` — только остальным).
- App.tsx: `addLog` в мультиплеере больше НЕ пишет локально — только эмитит на сервер, ответ приходит через broadcast. У всех единый источник времени.

**2. Детальный лог голосования без дублей.**
- Причина: голосование стреляет на ВСЕХ клиентах. Каждый писал через `addLogRef` → эмитил `game-log-add` → broadcast летел всем → 3 одинаковых сообщения.
- Fix: пишем ЛОКАЛЬНО через `setLog` (не через `addLogRef`). Формат: «🗳 Голосование за Кек: Лев — за исключение, Onlyup_lg — против. Кек оставлен.»
- Убран дубль смысла («решил оставить» + «оставлен»).

**3. Авто-выкуп obliged-winner в аукционе.**
- Причина: если участник остался один с выигравшей ставкой, отказаться не может. При тайм-ауте раньше аукцион зависал.
- Fix в `handleTimeout`: при обязательном выкупе — если хватает денег, авто-выкуп (`auctionRaiseRef.current()`), иначе авто-банкрот.
- JSX: окно с процентом активов (как при нехватке на аренду) + кнопка «🏳️ Сдаться (обанкротиться)».
- `auctionRaiseRef` — новый ref для вызова из handleTimeout.

**4. Джекпот — раскрытие загаданного числа.**
- В лог победы и проигрыша добавлено: «Было загадано число ${secret}.»
- `secret` и так генерится рандомно `1 + Math.floor(Math.random() * 6)` — просто не отображался.

**Файлы:** artifacts/monopoly-arena/src/App.tsx, server.js.

## 1d4c47d — fix(sync): turn-lock 800ms, request-live-state, лог голосования, votes в payload

Большой пакет по синхронизации и восстановлению состояния. Закрывает три класса проблем.

**1. Защита turn'а от эха (`setTurnLocked`).**
- Причина: после accept/decline инициатор ставил turn локально, но через 100–200 мс приходил эхо-sync от другого клиента с устаревшим turn и перезатирал его. Ход «возвращался» не тому игроку.
- Fix: `lastLocalTurnChangeAtRef` + `TURN_LOCK_MS = 800`. `setTurnLocked(v)` фиксирует момент локального изменения, в `update-remote-state` чужой turn применяется только если лок не активен.
- Заменено 7 вызовов `setTurn` на `setTurnLocked` в: advanceTurn, proposeTrade, trade-proposed-broadcast, trade-resolved-broadcast, accept, decline, handleTimeout (авто-отказ).

**2. `request-live-state` при реконнекте / возврате вкладки.**
- Причина: transient-состояния (активное голосование на сервере, окно аукциона на клиентах) не восстанавливались после засыпания вкладки или разрыва сокета.
- server.js: обработчик `request-live-state` отдаёт запросившему текущий `room.vote` (если есть) и ретранслирует `request-live-state-broadcast` остальным.
- App.tsx: при монтировании эмитим `request-live-state`, слушаем `visibilitychange` (на возврате в видимую вкладку — снова эмит). На `request-live-state-broadcast` сбрасываем `lastSentSyncHashRef` и форсим `setSyncNudge` — снапшот улетает всем.

**3. Детальный лог голосования.**
- Причина: в логе было «0/2 за исключение» — непонятно, кто как голосовал. И votes вообще не передавались с сервера.
- server.js: `vote-resolved` теперь содержит `votes: vote.votes`.
- App.tsx: лог строит строчки вида «Онлиап решил Оставить, Лев решил Исключить. Итог: Кек оставлен.»

**Файлы:** artifacts/monopoly-arena/src/App.tsx, server.js.

## f31c539 — fix(trade): ownersDelta + moneyDelta в broadcast, restoreTurn всем

- **Диагноз:** turn в проекте живёт только на клиентах (сервер его не хранит). После `trade-resolved` restoreTurn применялся только у инициатора. У третьего игрока C оставался turn=targetIdx (прилетел из sync A→B). Любой следующий sync от C откатывал turn у A и B — кнопка «Бросить кубики» у инициатора оставалась заблокированной, поле не перекрашивалось.
- **Fix 1:** `ownersDelta` + `moneyDelta` теперь передаются в `trade-resolved` и пробрасываются сервером в `trade-resolved-broadcast`. В broadcast применяются у всех клиентов (setOwners/setPlayers). Раньше target применял их только локально, инициатор и C ничего не получали.
- **Fix 2:** `restoreTurn` теперь применяется ВСЕМ клиентам (не только инициатору). Восстанавливает setTurn + setDoubleCount + setIsDoubleRoll + setRolled(false).
- **Fix 3:** accept/decline читают `tradeInitiatorRef.current` (ref), а не state — защита от null из-за re-render.
- **Fix 4:** `setSyncNudge` вызывается в accept/decline и в broadcast — форсирует отправку снапшота после операции (suppression-окно < 250 мс иначе глушит sync).
- **server.js:** `trade-resolved` пробрасывает ownersDelta и moneyDelta в broadcast.
- **Файлы:** artifacts/monopoly-arena/src/App.tsx, server.js.

## a385219 — ui: запрет drag/select на клетках стола, запрет вставки картинок в игровой чат

- **Drag/select на клетках стола:** на контейнере клетки в boardCells.map добавлены `userSelect: "none"`, `WebkitUserSelect: "none"`, `draggable={false}`, `onDragStart={e => e.preventDefault()}`. Запрет распространяется на все текстовые и эмодзи-иконки: 🚀 (Старт), 💸 (Налог), 🎲 (Шанс), ⚡ (Испытание), 🔒 (Тюрьма), 👮 (В тюрьму), 🎰 (Джекпот), звёзды улучшений, цифры в полосках цены. Раньше их можно было выделить и перетащить.
- **Запрет вставки картинок в игровой чат:** у `<input>` игрового чата добавлен `onPaste`, который проверяет `clipboardData.items` на `image/*` и делает `preventDefault()`. Текст (Ctrl+V) работает как обычно, картинка — блокируется.
- Раньше лого уже были защищены (пункт из прошлого захода), теперь закрыты и текстовые элементы на доске.
- **Файл:** artifacts/monopoly-arena/src/App.tsx.

## c2ea566 — feat(trade): блокировка броска, таймер 30с, авто-отказ, лимит 2/ход

- **Bug 1 (броски во время договора):** в busy добавлено `|| !!pendingTrade`. Кнопка «Бросить кубики» блокируется у обоих — и у target, и у инициатора.
- **Bug 2 (таймер на договор):**
  - proposeTrade → timer-start 30 сек на target.
  - handleTimeout (новая ветка в начале): timer-expired у target + активный pendingTrade → авто-отказ. Возврат хода инициатору (setTurn/setDoubleCount/setIsDoubleRoll если дубль), эмит trade-resolved с restoreTurn + timer-start 30 сек на инициатора.
  - trade-resolved-broadcast принимает restoreTurn и восстанавливает ход у инициатора.
- **Bug 3 (лимит 2 договора за ход):** tradesThisTurnRef (useRef). Проверка в proposeTrade (>= 2 → лог + return), инкремент при отправке, сброс в advanceTurn.
- **Bug 4 (спиннеры у input[type=number] в окне договора):** классы [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none на оба инпута (myMoney, theirMoney).
- **Bug 5 (остаток окна у target после отказа):**
  - trade-resolved-broadcast чистит trade/pendingTrade/tradeInitiator у ВСЕХ (было только у инициатора).
  - у кнопки «Отказаться» не было socket.emit('trade-resolved') — окно у инициатора висело. Теперь эмитит с payload restoreTurn + timer-start 30 на инициатора.
  - у «Принять» убран дублирующий локальный setTurn/setDoubleCount/setIsDoubleRoll (их ставит broadcast restoreTurn).
- **Выход/сдача во время договора:** в bankruptPlayer и handleVoluntaryLeave отмена договора + trade-resolved если выбывающий initiator или target.
- **server.js:** trade-resolved пробрасывает restoreTurn в trade-resolved-broadcast.
- **Новые refs:** tradeInitiatorRef (через useEffect), tradesThisTurnRef.
- **Файлы:** artifacts/monopoly-arena/src/App.tsx, server.js.

## 190b8b0 — fix(chance): hotels — платим только за свои филиалы

- **Баг:** в событии Шанса «коммунальный сбор» (kind: hotels) игрок платил 500 × ВСЕ улучшения на доске, включая чужие филиалы. По лору — должен платить только за свои.
- **Следствие:** если у Ивана 2 филиала, у Пети 3 — Иван платил 2500 вместо 1000. Если у Ивана 0, но у Пети есть — Иван получал окно «Заплатить», хотя должен видеть «🚫 ничего не должен».
- **Фикс:** считаем myHotelsCount через refs (improvementsRef + ownersRef) — только те улучшения, где owner === cur.id. Через refs, потому что processLanding вызывается внутри afterAnimRef (замыкание на момент броска).
- Файл: artifacts/monopoly-arena/src/App.tsx, блок processLanding case «chance».

## dd4e5ce — fix: договор с залогом, кнопка улучшения, чистка gotojail

- **Договор обмена:** оценка карточки теперь учитывает залог. Хелпер getCardTradeValue(cellIdx) — если поле в залоге, берёт залоговую стоимость (getMortgage, 50%), иначе — обычную цену. Заменено во всех 8 местах: proposeTrade (myVal/theirVal), модалка pendingTrade (myTotal/theirTotal), inline-договор в JSX (блоки Стоимость + валидация overLimit).
- **Чистка:** удалена мёртвая ветка case «gotojail» в confirmAction — setPendingAction({ type: «gotojail» }) нигде не вызывается. В processLanding case «gotojail» остался (это проверка типа клетки №30).
- Файл: artifacts/monopoly-arena/src/App.tsx.

## 590b4e5 — feat(jail): анимация третьего дубля → тюрьма видна всем

- Игрок бросает третий дубль подряд → фишка летит по диагонали с ТЕКУЩЕЙ позиции (Адидас, Nike и т.д.) в клетку №10 «Тюрьма».
- Активный клиент: setDiagonalAnim({ from: currentPos, to: 10, playerId }) + socket.emit('jail-animation').
- Наблюдатели: jail-animation-broadcast → та же анимация, через 1200 мс setPlayers(position: 10, jailTurns, jailAttempts: 0).
- jailTurns = modeConfig.jailAttempts (реально в тюрьму, не в «Отдых»).
- setSyncNudge — страховочный снапшот, как в case «gotojail».
- Файл: artifacts/monopoly-arena/src/App.tsx (блок if (isThirdDouble) в socket.on('server-roll-result')).

# Точки возврата Monopoly Arena

## Текущая рабочая версия

- **ce4bf1a** — fix(doubles): счётчик дублей индивидуально на бросающего
- Дата: 07.10.2026

## Предыдущие

- **ebf2db3** — fix(chance): pay_each списывает/начисляет всем, автосписание
- **0509620** — фиксы полей (гонка покупки, цвет фишки), «Отдых» на №10, тень лого
- **cfafa8d** — анти-фарм: минимальная длительность и броски для полной награды
- **5f296cd** — mp3-сэмплы для казино/пополнения/траты + правки логов
- **d9d674a** — звуки: профили скольжения/траты/пополнения + замок звуков
- **d6d3efc** — фикс join: неавторизованный не зависает и не входит как гость
- **10e589d** — окно договора обмена: плитки логотипов, клик по полю, обводка
- **9200f8f** — тултип «Все предметы» через портал (не обрезается карточкой)
- **b549866** — фикс дублирования лога при третьем дубле
- **c6c7348** — тень логотипов купленных клеток: тёмная вместо белой
- **cef0cf2** — понятные логи джекпота, аренды и налогов
- **7a579c1** — игровой чат: авто-скролл, кнопка «↓», rate-limit, подсветка ников
- **1e25dfe** — fix(db): не писать user_data для гостей (FK user_data_user_id_fkey)
- **48ddbd5** — чат-система: лимиты, авто-скролл, бейджи непрочитанных, история
  - Фронт (App.tsx): ChatPanel — фикс. высота, textarea autosize до 120px,
    break-words; авто-скролл + кнопка «↓» при отдалении >250px; лимит 40 (личка)
    и 300 (общий чат); ACK-обработка; блокировка ввода на 5 сек при rate-limit;
    бейджи непрочитанных (Friends/Dashboard/сайдбар); запрос истории главного чата.
  - Бэк (server.js): ACK + rate-limit для send-friend-message (5/3с) и
    chat-message (5/5с + детект дублей ×3 → 30с); globalChatHistory — кольцевой
    буфер 300 в памяти; get-chat-history — отдаёт последние 20.
- **d8e8a37** — feat(chat): rate-limit, ACK, история общего чата на сервере
- **ed8d612** — звук траты/пополнения привязан к изменению баланса
- **64cc004** — звуки (ход/старт/трата/пополнение/джекпот) + фикс квеста
- **720acd2** — огненный след (4 слоя) + jail-animation для наблюдателей
- **d3f86c1** — улучшения после смены хода + challenge-anim
- **87fccf2** — перенос чата + удалён режим «Без аренды»
- **5919edd** — проверка баланса в джекпот-казино
- **7c038ad** — авто-бросок/авто-выкуп в тюрьме
- **819c2e0** — уведомление о ходе (звук + вспышка)
- **eb3609a** — рента ×2 при монополии
- **4506ef1** — фильтр попапа
- **d8f5f7a** — баланс, сдача, награда
- **a3750b9** — звуки: 30 сек + авто-отказ
