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
