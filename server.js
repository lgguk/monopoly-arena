const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;

// ---- ГЛОБАЛЬНОЕ ХРАНИЛИЩЕ НАСТРОЕК И ДИЗАЙНОВ ----
let adminSettings = {
  startCapital: 15000,
  passStart: 200,
  rentPercent: 100,
  thirdDieChance: 15,
  voteDuration: 30,
  voteYesPercent: 50,
  adminPassword: "admin123",
  taxAmount1: 500,
  taxAmount2: 500,
  jackpotBet1: 350,
  jackpotWin1: 3000,
  jackpotBet2: 700,
  jackpotWin2: 2000,
  jackpotBet3: 1000,
  jackpotWin3: 1000,
  startBonus: 1000,
};

let cardDesigns = [];
let marketItems = [];
let adminCases = [];
try { if (fs.existsSync('admin-cases.json')) adminCases = JSON.parse(fs.readFileSync('admin-cases.json')); } catch (e) {}
let marketListings = [];
try { if (fs.existsSync('market-listings.json')) marketListings = JSON.parse(fs.readFileSync('market-listings.json')); } catch (e) {}
function saveMarketListings() {
  try { fs.writeFileSync('market-listings.json', JSON.stringify(marketListings, null, 2)); } catch (err) { console.error('Ошибка сохранения объявлений:', err); }
}
function saveMarketItems() {
  try { fs.writeFileSync('market-items.json', JSON.stringify(marketItems, null, 2)); } catch (err) { console.error('Ошибка сохранения товаров:', err); }
}

// Загрузка из файлов (добавь в try/catch в начале, как для cardDesigns)
try { if (fs.existsSync('market-items.json')) marketItems = JSON.parse(fs.readFileSync('market-items.json')); } catch (e) {}

const SETTINGS_FILE = path.join(__dirname, 'admin-settings.json');
const DESIGNS_FILE = path.join(__dirname, 'card-designs.json');

// ---- ХРАНИЛИЩЕ ПОЛЬЗОВАТЕЛЕЙ ----
let users = []; // { id, login, password, name, initials, color, guest, createdAt }
let userData = {}; // { userId: { inventory: [], coins: 2400, stats: {...}, friends: [], ... } }

const USERS_FILE = path.join(__dirname, 'users.json');
const USER_DATA_FILE = path.join(__dirname, 'user-data.json');

// Загрузка при старте
try {
  if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    console.log(`✅ Пользователи загружены: ${users.length}`);
  }
} catch (err) {
  console.error('Ошибка загрузки пользователей:', err);
}

// Одноразовая миграция: хэшируем все plain-text пароли.
// Хэш bcrypt всегда начинается с "$2b$" — по этому признаку отличаем уже захэшированные.
(async () => {
  let migrated = 0;
  for (const u of users) {
    if (u.password && !u.password.startsWith('$2')) {
      u.password = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
      migrated++;
    }
  }
  if (migrated > 0) {
    saveUsers();
    console.log(`🔐 Захэшировано старых паролей: ${migrated}`);
  }
})();

try {
  if (fs.existsSync(USER_DATA_FILE)) {
    userData = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf8'));
    console.log(`✅ Данные пользователей загружены: ${Object.keys(userData).length}`);
  }
} catch (err) {
  console.error('Ошибка загрузки данных пользователей:', err);
}

// Функция сохранения в файлы (вызывается после изменения)
function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Ошибка сохранения пользователей:', err);
  }
}

function saveUserData() {
  try {
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(userData, null, 2));
  } catch (err) {
    console.error('Ошибка сохранения данных пользователей:', err);
  }
}

// Загрузка при старте
try {
  if (fs.existsSync(SETTINGS_FILE)) {
    adminSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    console.log('✅ Настройки администратора загружены');
  }
} catch (err) {
  console.error('Ошибка загрузки настроек:', err);
}

try {
  if (fs.existsSync(DESIGNS_FILE)) {
    cardDesigns = JSON.parse(fs.readFileSync(DESIGNS_FILE, 'utf8'));
    console.log(`✅ Дизайнов карточек: ${cardDesigns.length}`);
  }
} catch (err) {
  console.error('Ошибка загрузки дизайнов:', err);
}

const app = express();
app.use(cors({ origin: "*" }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Хранилище лобби и игровых сессий
let rooms = [];
// { roomId: [playerObj, playerObj, ...] }
let gameRooms = {};
// Таймеры отключения: ключ `${roomId}:${playerId}` → timeoutId
const disconnectTimers = new Map();
const DISCONNECT_GRACE_MS = 2 * 60 * 1000; // 2 минуты
// Когда начался текущий ход в каждой комнате: roomId -> timestamp
const roomTurnStart = {};
const TURN_DURATION_SEC = 45; // длительность хода в секундах

// Уникальный токен, генерируется при каждом запуске сервера.
// Клиенты используют его, чтобы понять, что сервер перезапустился.
const SERVER_START_TOKEN = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 10);

// Статус сервера, управляется админом: "online" | "maintenance"
let serverStatus = "online";
// Онлайн-пользователи: userId -> socketId
const onlineUsers = new Map();
// 5 fixed, maximally-distinct player slot colors
const PLAYER_COLORS = ["#e63946", "#2ecc71", "#3a86ff", "#9b5de5", "#f77f00"];

// Уведомляем всех друзей игрока о смене его online-статуса
function notifyFriendsStatus(userId, isOnline) {
  if (!userId || !userData[userId]) return;
  const friends = userData[userId].friends || [];
  friends.forEach(fid => {
    const friendSocketId = onlineUsers.get(fid);
    if (friendSocketId) {
      io.to(friendSocketId).emit('friend-status-changed', { userId, online: isOnline });
    }
  });
}

// ============ ЕЖЕДНЕВНЫЕ КВЕСТЫ ============
const QUEST_DEFS = [
  { id: 'dailyLogin',      title: 'Заходи каждый день',   reward: 50,  icon: '📅' },
  { id: 'playGame',        title: 'Сыграй 1 партию',      reward: 100, icon: '🎲' },
  { id: 'winGame',         title: 'Победи в партии',      reward: 250, icon: '🏆' },
  { id: 'buyProperty',     title: 'Купи 1 поле',          reward: 50,  icon: '🏠' },
  { id: 'improveProperty', title: 'Улучши 1 поле',        reward: 100, icon: '⭐' },
];

// Ключ дня по московскому времени (UTC+3), формат "YYYY-MM-DD"
function getMoscowDayKey() {
  const now = new Date();
  const msk = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return msk.toISOString().slice(0, 10);
}

// Lazy-сброс: если dayKey у игрока не совпадает с текущим — обнуляем
function ensureQuestsFresh(userId) {
  if (!userData[userId]) return;
  const today = getMoscowDayKey();
  const q = userData[userId].quests;
  if (!q || q.dayKey !== today) {
    userData[userId].quests = {
      dayKey: today,
      items: {
        dailyLogin:      { done: true,  claimed: false }, // заход уже случился
        playGame:        { done: false, claimed: false },
        winGame:         { done: false, claimed: false },
        buyProperty:     { done: false, claimed: false },
        improveProperty: { done: false, claimed: false },
      },
    };
    saveUserData();
  }
}

// Помечаем квест выполненным (если сегодня ещё не выполнен)
function markQuestDone(userId, questId) {
  if (!userData[userId]) return;
  ensureQuestsFresh(userId);
  const q = userData[userId].quests;
  if (q.items[questId] && !q.items[questId].done) {
    q.items[questId].done = true;
    saveUserData();
    // Обновляем клиенту список квестов
    const socketId = onlineUsers.get(userId);
    if (socketId) {
      io.to(socketId).emit('quests-updated', { dayKey: q.dayKey, items: q.items });
    }
  }
}

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

    // Сообщаем клиенту токен старта — если у него сохранён другой,
    // значит сервер перезапустился и клиенту нужно сделать hard reload.
    socket.emit('server-start-token', SERVER_START_TOKEN);

    // Отдаём клиенту текущий статус сервера
    socket.emit('server-status', serverStatus);

    // На случай, если клиент подключился раньше, чем повесил listener
    socket.on('get-server-start-token', () => {
      socket.emit('server-start-token', SERVER_START_TOKEN);
    });

    socket.on('get-server-status', () => {
      socket.emit('server-status', serverStatus);
    });

    // Админ меняет статус — рассылаем всем
    socket.on('admin-update-server-status', (newStatus) => {
      if (newStatus !== 'online' && newStatus !== 'maintenance') return;
      // Защита от дублированных эмитов: эмитим только если статус реально изменился
      if (serverStatus === newStatus) return;
      serverStatus = newStatus;
      io.emit('server-status-updated', serverStatus);
      console.log(`⚙️ Статус сервера изменён на: ${serverStatus}`);
    });

    socket.emit('update-rooms', rooms);
    socket.on('update-user-xp', (data) => {
  const { userId, xp, stats } = data;
  if (!userId || !userData[userId]) return;
  
  if (stats) {
    userData[userId].stats = stats;
  } else {
    userData[userId].stats.xp += xp;
  }
  
  // Пересчитываем уровень на основе XP (level = floor(xp / 1000))
  userData[userId].stats.level = Math.floor(userData[userId].stats.xp / 1000);
  
  saveUserData();
  socket.emit('user-data-updated', userData[userId]);
});

    // ---- АУТЕНТИФИКАЦИЯ ----
socket.on('register', async (data, callback) => {
  const { login, password, name, guest } = data;

  // Если это гость - пропускаем проверку логина/пароля
  if (!guest && (!login || !password || !name)) {
    if (callback) callback({ success: false, error: 'Заполни все поля' });
    return;
  }
  if (guest && (!name || !name.trim())) {
    if (callback) callback({ success: false, error: 'Введи ник' });
    return;
  }

  if (guest) {
    // ГОСТЬ: проверяем что ник реально свободен
    const trimmed = name.trim().toLowerCase();
    const busy = users.some(u => {
      if (u.name.toLowerCase() !== trimmed) return false;
      // Занято, если это зарегистрированный игрок или онлайн-гость
      if (!u.guest) return true;
      return onlineUsers.has(u.id);
    });
    if (busy) {
      if (callback) callback({ success: false, error: 'Этот ник уже занят' });
      return;
    }
  } else {
    // ОБЫЧНЫЙ ИГРОК: логин должен быть свободен
    const existing = users.find(u => u.login === login);
    if (existing) {
      if (callback) callback({ success: false, error: 'Этот логин уже занят' });
      return;
    }
    // И ник тоже не должен совпадать с чужим
    const trimmed = name.trim().toLowerCase();
    const nameTaken = users.some(u => u.name.toLowerCase() === trimmed);
    if (nameTaken) {
      if (callback) callback({ success: false, error: 'Этот ник уже занят' });
      return;
    }
  }
  let newId = 'MA-' + Math.floor(1000 + Math.random() * 9000);
while (users.find(u => u.id === newId)) {
    newId = 'MA-' + Math.floor(1000 + Math.random() * 9000);
}

const user = {
    id: newId,
    login: guest ? null : login,
    password: guest ? null : await bcrypt.hash(password, BCRYPT_ROUNDS),
    name,
    initials: name.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase(),
    color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
    guest: !!guest,
    createdAt: Date.now()
};

 users.push(user);
  // Гостей НЕ сохраняем в файл — они существуют только в памяти пока онлайн
  if (!guest) {
    saveUsers();
  }

  // Инициализируем данные игрока по умолчанию
  userData[user.id] = { inventory: [], coins: 2400, stats: { games: 0, wins: 0, xp: 0, level: 1 }, friends: [], activeSkins: {}, vipUntil: null };
  saveUserData();
  onlineUsers.set(user.id, socket.id);
  notifyFriendsStatus(user.id, true);
  ensureQuestsFresh(user.id); // создаём квесты на сегодня

  if (callback) callback({ success: true, user, data: userData[user.id] });
});

socket.on('login', async (data, callback) => {
  const { login, password } = data;
  const user = users.find(u => u.login === login);
  if (!user) {
    if (callback) callback({ success: false, error: 'Неправильный логин или пароль' });
    return;
  }
  const passwordOk = await bcrypt.compare(password, user.password);
  if (!passwordOk) {
    if (callback) callback({ success: false, error: 'Неправильный логин или пароль' });
    return;
  }
  if (!userData[user.id]) {
    userData[user.id] = { inventory: [], coins: 2400, stats: { games: 0, wins: 0, xp: 0, level: 1 }, friends: [], activeSkins: {}, vipUntil: null };
    saveUserData();
  }
  onlineUsers.set(user.id, socket.id);
  notifyFriendsStatus(user.id, true);
  ensureQuestsFresh(user.id); // обновляем квесты по текущему дню МСК
  if (callback) callback({ success: true, user, data: userData[user.id] });
});

// Восстановление сессии после рестарта сервера или переподключения сокета.
// Клиент уже залогинен в localStorage — заново вводить пароль не нужно.
socket.on('reconnect-session', ({ userId }, callback) => {
  if (!userId) return callback?.({ success: false });
  const user = users.find(u => u.id === userId);
  if (!user) return callback?.({ success: false });
  onlineUsers.set(userId, socket.id);
  notifyFriendsStatus(userId, true);
  ensureQuestsFresh(userId); // обновляем квесты по текущему дню МСК
  console.log(`♻️ Восстановлена сессия: ${user.name}`);
  if (callback) callback({ success: true, user, data: userData[userId] });
});

// Событие для сохранения игровых данных (вызывается с клиента при изменении)
socket.on('save-user-data', (data, callback) => {
  const { userId, newData } = data;
  if (!userId || !newData) return;
  // MERGE — сохраняем поля, которых нет в newData (например, activeSkins)
  userData[userId] = { ...userData[userId], ...newData };
  saveUserData();
  // Отправляем обновление всем подключениям этого пользователя (для синхронизации)
  if (onlineUsers.has(userId)) {
    io.to(onlineUsers.get(userId)).emit('user-inventory-updated', userData[userId].inventory || []);
  }
  if (callback) callback({ success: true });
});

socket.on('get-user-inventory', (userId, callback) => {
  if (!userId || !userData[userId]) return callback?.({ success: false, error: 'User not found' });
  callback?.({ success: true, inventory: userData[userId].inventory || [] });
});

// Событие для получения игровых данных (если нужно)
socket.on('get-user-data', (userId, callback) => {
  if (userData[userId]) {
    if (callback) callback({ success: true, data: userData[userId] });
  } else {
    if (callback) callback({ success: false, error: 'Данные не найдены' });
  }
});

  // Отправляем актуальные настройки и карточки при подключении
  socket.emit('admin-settings', adminSettings);
  socket.emit('card-designs', cardDesigns);

  // Обработчик: админ меняет настройки
  socket.on('admin-update-settings', (newSettings) => {
    if (!newSettings || typeof newSettings !== 'object') return;
    adminSettings = newSettings;
    try {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(adminSettings, null, 2));
    } catch (err) {
      console.error('Ошибка сохранения настроек:', err);
    }
    io.emit('admin-settings-updated', adminSettings);
    console.log('⚙️ Админ обновил настройки партии');
  });

  // Обработчик: админ меняет дизайны карточек
  socket.on('admin-update-card-designs', (newDesigns) => {
    if (!Array.isArray(newDesigns)) return;
    cardDesigns = newDesigns;
    try {
      fs.writeFileSync(DESIGNS_FILE, JSON.stringify(cardDesigns, null, 2));
    } catch (err) {
      console.error('Ошибка сохранения дизайнов:', err);
    }
    io.emit('card-designs-updated', cardDesigns);
    console.log(`🎨 Админ обновил дизайны (${cardDesigns.length})`);
  });

  // Запросы на получение данных (для свежих подключений)
  socket.on('get-admin-settings', () => {
    socket.emit('admin-settings', adminSettings);
  });

  socket.on('get-card-designs', () => {
    socket.emit('card-designs', cardDesigns);
  });

  socket.on('get-custom-items', () => socket.emit('custom-items-updated', marketItems));
  socket.on('save-custom-items', (newItems) => {
  marketItems = newItems;
  saveMarketItems();
  io.emit('custom-items-updated', marketItems);
});
  // --- РЫНОК / ОБЪЯВЛЕНИЯ ---
socket.on('get-market-listings', () => {
  socket.emit('market-listings', marketListings);
});

socket.on('add-market-listing', (data, callback) => {
  if (!data || !data.item || !data.price) return;
  // data: { item, price, seller, sellerId }
  const newListing = {
    id: `listing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    item: data.item,
    seller: data.seller,
    sellerId: data.sellerId,
    price: data.price,
    createdAt: Date.now()
  };
  marketListings.push(newListing);
  saveMarketListings();
  io.emit('market-listings-updated', marketListings);
  if (callback) callback({ success: true, listing: newListing });
});

socket.on('remove-market-listing', (data, callback) => {
  const { listingId, userId } = data;
  const idx = marketListings.findIndex(l => l.id === listingId);
  if (idx === -1) return;
  const listing = marketListings[idx];
  // Удалить может только владелец
  if (listing.sellerId !== userId) {
    if (callback) callback({ success: false, error: 'Нет прав' });
    return;
  }
  // ВОЗВРАЩАЕМ предмет в инвентарь продавца
  if (userData[userId]) {
    if (!userData[userId].inventory) userData[userId].inventory = [];
    userData[userId].inventory.push(listing.item);
    saveUserData();
    const tSocket = onlineUsers.get(userId);
    if (tSocket) {
      io.to(tSocket).emit('user-inventory-updated', userData[userId].inventory);
      io.to(tSocket).emit('user-data-updated', userData[userId]);
    }
  }
    marketListings.splice(idx, 1);
  saveMarketListings();
  io.emit('market-listings-updated', marketListings);
  if (callback) callback({ success: true, inventory: userData[userId]?.inventory || [] });
});

socket.on('buy-market-listing', (data, callback) => {
  // data: { listingId, buyerId }
  const listing = marketListings.find(l => l.id === data.listingId);
  if (!listing) return callback?.({ success: false, error: 'Объявление не найдено' });

  const buyerId = data.buyerId;
  const sellerId = listing.sellerId;

  // Проверяем покупателя
  const buyer = userData[buyerId];
  if (!buyer) return callback?.({ success: false, error: 'Покупатель не найден' });

  // Проверяем баланс покупателя
  if (buyer.coins < listing.price) {
    return callback?.({ success: false, error: 'Недостаточно средств' });
  }

  // Проверяем продавца
  const seller = userData[sellerId];
  if (!seller) return callback?.({ success: false, error: 'Продавец не найден' });

  // Переводим монеты
  buyer.coins -= listing.price;
  seller.coins += listing.price;

  // Если это VIP-товар, продлеваем VIP, иначе добавляем в инвентарь
  if (listing.item.category === "vip") {
    // Определяем текущую дату окончания VIP или текущее время
    const currentVipUntil = buyer.vipUntil ? new Date(buyer.vipUntil) : null;
    let baseTime = (currentVipUntil && currentVipUntil > new Date()) ? currentVipUntil.getTime() : Date.now();
    const vipEnd = new Date(baseTime + (listing.item.vipDuration || 7) * 24 * 60 * 60 * 1000);
    buyer.vipUntil = vipEnd.toISOString();
  } else {
    // Обычный предмет - добавляем в инвентарь покупателя
    buyer.inventory.push(listing.item);
  }

  // Сохраняем изменения
  saveUserData();

  // Удаляем объявление
  marketListings = marketListings.filter(l => l.id !== data.listingId);
  saveMarketListings();
  io.emit('market-listings-updated', marketListings);

  // Уведомляем покупателя и продавца об обновлении их данных
  if (onlineUsers.has(buyerId)) io.to(onlineUsers.get(buyerId)).emit('user-data-updated', buyer);
  if (onlineUsers.has(sellerId)) io.to(onlineUsers.get(sellerId)).emit('user-data-updated', seller);

  if (callback) callback({ success: true, item: listing.item });
});

socket.on('admin-save-cases', (newCases) => {
    adminCases = newCases;
    fs.writeFileSync('admin-cases.json', JSON.stringify(adminCases));
    io.emit('admin-cases-updated', adminCases);
});
socket.on('get-admin-cases', () => socket.emit('admin-cases-updated', adminCases));


  socket.on('game-chat-message', (data) => {
    console.log(`[Чат комнаты ${data.roomId}] ${data.from}: ${data.text}`);
    io.to(data.roomId).emit('game-chat-message-broadcast', data);
  });

  socket.on('sync-game-state', (data) => {
    // Сохраняем актуальное состояние игроков на сервере —
    // это нужно, чтобы при переподключении игрок получил свежие позиции,
    // а не те, что были при первом входе.
    if (data.roomId && Array.isArray(data.players) && gameRooms[data.roomId]) {
      data.players.forEach((p) => {
        if (!p || !p.id) return;
        const existing = gameRooms[data.roomId].find(x => x.id === p.id);
        if (existing) {
          existing.position = p.position ?? existing.position;
          existing.money = p.money ?? existing.money;
          existing.bankrupt = p.bankrupt ?? existing.bankrupt;
          existing.jailTurns = p.jailTurns ?? existing.jailTurns;
          existing.jailAttempts = p.jailAttempts ?? existing.jailAttempts;
        }
      });
    }
    socket.to(data.roomId).emit('update-remote-state', data);
  });

  socket.on('create-room', (roomData) => {
  const newRoom = {
    ...roomData,
    id: Math.random().toString(36).slice(2, 7).toUpperCase(),
    players: 1,
    hostId: socket.id,
    playerNames: [roomData.host || "Гость"],
    playerSockets: { [socket.id]: roomData.host || "Гость" },
    createdAt: Date.now(),
    started: false
  };
    rooms.push(newRoom);
    socket.emit('room-created', newRoom);
    socket.join(newRoom.id);
    io.emit('update-rooms', rooms);
    console.log(`Комната ${newRoom.name} создана. Всего комнат: ${rooms.length}`);
  });

    socket.on('join-room', ({ roomId, password, playerName }) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return socket.emit('join-error', 'Комната не найдена');
    if (room.password && room.password !== password) return socket.emit('join-error', 'Неверный пароль');
    if (room.players >= room.maxPlayers) return socket.emit('join-error', 'Комната заполнена');
    if (room.hostId === socket.id) return socket.emit('join-error', 'Вы не можете присоединиться к своему лобби');

    room.players += 1;
    if (!room.playerNames) room.playerNames = [];
    if (!room.playerSockets) room.playerSockets = {};
    room.playerNames.push(playerName || "Игрок");
    room.playerSockets[socket.id] = playerName || "Игрок";
    socket.join(roomId);
    socket.emit('joined-room', room);
    io.emit('update-rooms', rooms);

    if (room.players === room.maxPlayers) {
      io.to(roomId).emit('start-game', room);
      console.log(`Игра в комнате ${room.name} начинается!`);
    }
    console.log(`Игрок присоединился к ${room.name}. Игроков: ${room.players}/${room.maxPlayers}`);
  });

  // --- НОВЫЕ ОБРАБОТЧИКИ ДЛЯ ИГРОВОГО СТОЛА ---
    socket.on('enter-game-room', ({ roomId, playerData }) => {
    socket.join(roomId);
    if (!gameRooms[roomId]) gameRooms[roomId] = [];

    // Сначала ищем игрока по УНИКАЛЬНОМУ id (не по socketId!) — это нужно для переподключения
    const existing = gameRooms[roomId].find(p => p.id === playerData.id);

    if (!existing) {
      // Новый игрок
      const colorIndex = gameRooms[roomId].length % PLAYER_COLORS.length;
      playerData.color = PLAYER_COLORS[colorIndex];
      playerData.activeSkins = playerData.activeSkins || {};
      playerData.isVip = playerData.isVip || false;
      playerData.disconnected = false;
      gameRooms[roomId].push({ ...playerData, socketId: socket.id });
    } else {
      // Переподключение — обновляем socketId и снимаем флаг
      existing.socketId = socket.id;
      existing.disconnected = false;
      existing.activeSkins = playerData.activeSkins || existing.activeSkins || {};
      existing.isVip = playerData.isVip || existing.isVip || false;
      // ВАЖНО: игрок вернулся — снимаем флаг "вышел" (на случай ложного срабатывания leave-game)
      if (!existing.bankrupt) existing.leftAlive = false;
      // Отменяем таймер авто-банкротства
      const timerKey = `${roomId}:${existing.id}`;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey));
        disconnectTimers.delete(timerKey);
      }
      console.log(`♻️ Игрок ${existing.name} переподключился к комнате ${roomId}`);
    }

    io.to(roomId).emit('update-game-players', gameRooms[roomId]);

    // Отдаём переподключившемуся игроку актуальный остаток таймера хода
    if (roomTurnStart[roomId]) {
      const elapsed = Math.floor((Date.now() - roomTurnStart[roomId]) / 1000);
      const remaining = Math.max(0, TURN_DURATION_SEC - elapsed);
      socket.emit('sync-timer-broadcast', remaining);
      console.log(`⏱ ${playerData.name} получил остаток таймера: ${remaining}s`);
    }
  });

  // Возвращаем активную игру игрока (если он в ней остался)
  socket.on('get-active-game', (userId, callback) => {
    if (!userId) return callback?.({ success: false });
    for (const roomId in gameRooms) {
      const p = gameRooms[roomId].find(x => x.id === userId);
      if (!p) continue;
      // Игрок вышел навсегда — не предлагаем переподключение
      if (p.leftAlive) continue;
      // Игра завершена (0 или 1 живой) — тоже не предлагаем
      const alive = gameRooms[roomId].filter(x => !x.bankrupt);
      if (alive.length <= 1) continue;

      const lobby = rooms.find(r => r.id === roomId);
      return callback?.({
        success: true,
        room: {
          roomId,
          roomName: lobby?.name || `Комната ${roomId}`,
          disconnected: !!p.disconnected,
        },
      });
    }
    callback?.({ success: false, room: null });
  });

  // --- СИНХРОНИЗАЦИЯ БРОСКА КУБИКОВ ---
  socket.on('roll-dice-request', ({ roomId, playerId }) => {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    io.to(roomId).emit('server-roll-result', { d1, d2, playerId });
  });

    socket.on('delete-room', (roomId) => {
    const roomIndex = rooms.findIndex(r => r.id === roomId);
    if (roomIndex === -1) return;
    rooms.splice(roomIndex, 1);
    io.emit('update-rooms', rooms);
    console.log(`Лобби ${roomId} удалено хостом`);
  });

  socket.on('chat-message', (msg) => {
    io.emit('chat-message', msg);
  });

  // Обработчик игрового лога (чтобы все видели действия друг друга)
  socket.on('game-log-add', (data) => {
    if (!data.roomId || !data.entry) return;
    // socket.to(roomId) отправляет всем в комнате, КРОМЕ отправителя (убирает дубли)
    socket.to(data.roomId).emit('game-log-add-broadcast', data.entry);
  });
  socket.on('trade-proposed', ({ roomId, initiatorId, trade }) => {
    socket.to(roomId).emit('trade-proposed-broadcast', { initiatorId, trade });
  });
    socket.on('trade-resolved', ({ roomId, initiatorId }) => {
    socket.to(roomId).emit('trade-resolved-broadcast', { initiatorId });
  });
  // Событие синхронизации таймера (отправляется всем в комнате, кроме отправителя)
  socket.on('sync-timer', (data) => {
    // Запоминаем момент старта текущего хода — пригодится при реконнекте
    roomTurnStart[data.roomId] = Date.now();
    socket.to(data.roomId).emit('sync-timer-broadcast', data.timeLeft);
  });

  socket.on('leave-game', (data) => {
    // Поддерживаем оба формата: старый (строка) и новый ({ roomId, userId })
    const roomId = typeof data === 'string' ? data : data?.roomId;
    const userId = typeof data === 'object' && data ? data.userId : null;
    if (!roomId || !gameRooms[roomId]) return;

    // Ищем игрока — сначала по userId, потом по socketId, потом через onlineUsers
    let player = null;
    if (userId) player = gameRooms[roomId].find(p => p.id === userId);
    if (!player) player = gameRooms[roomId].find(p => p.socketId === socket.id);
    if (!player) {
      for (const [uid, sId] of onlineUsers.entries()) {
        if (sId === socket.id) {
          player = gameRooms[roomId].find(x => x.id === uid);
          if (player) break;
        }
      }
    }

    if (!player) {
      console.log(`⚠️ leave-game: игрок не найден в комнате ${roomId}`);
      return;
    }

    // Помечаем как вышедшего окончательно
    player.bankrupt = true;
    player.leftAlive = true;
    player.money = 0;
    player.socketId = null;
    player.disconnected = false;

    // Удаляем таймер отключения, если он был
    const timerKey = `${roomId}:${player.id}`;
    if (disconnectTimers.has(timerKey)) {
      clearTimeout(disconnectTimers.get(timerKey));
      disconnectTimers.delete(timerKey);
    }

    socket.leave(roomId);
    io.to(roomId).emit('update-game-players', gameRooms[roomId]);
    socket.to(roomId).emit('player-left', player.id);
    console.log(`🚪 ${player.name} покинул комнату ${roomId}`);

    const remainingAlive = gameRooms[roomId].filter(p => !p.bankrupt).length;
    if (remainingAlive <= 1) {
      io.to(roomId).emit('game-ended');
      // Планируем удаление комнаты, чтобы не висел баннер переподключения
      setTimeout(() => {
        delete gameRooms[roomId];
        delete roomTurnStart[roomId];
        console.log(`🗑 Комната ${roomId} удалена после завершения игры`);
      }, 8000);
    }
  });

    // --- ДРУЗЬЯ ---
  socket.on('get-friends', (userId, callback) => {
    if (!userId || !userData[userId]) return callback?.({ success: false, error: 'User data not found' });
    const friendIds = userData[userId].friends || [];
    const friends = friendIds.map(fid => {
      const user = users.find(u => u.id === fid);
      return user ? { id: user.id, name: user.name, online: onlineUsers.has(fid) } : null;
    }).filter(Boolean);
    callback?.({ success: true, friends });
  });

  socket.on('search-users', (query, callback) => {
    const q = (query || '').toLowerCase();
    const results = users
      .filter(u => !u.guest && (u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)))
      .slice(0, 10)
      .map(u => ({ id: u.id, name: u.name, online: onlineUsers.has(u.id) }));
    callback?.({ success: true, results });
  });

    socket.on('send-friend-request', ({ userId, friendId }, callback) => {
    if (!userId || !friendId || !userData[userId]) return callback?.({ success: false, error: 'Invalid request' });
    const targetUser = users.find(u => u.id === friendId);
    if (!targetUser || targetUser.guest) return callback?.({ success: false, error: 'User not found or is guest' });
    if (userId === friendId) return callback?.({ success: false, error: 'Cannot add yourself' });
    if ((userData[userId].friends || []).includes(friendId)) return callback?.({ success: false, error: 'Already friends' });

    if (!userData[friendId].friendRequests) userData[friendId].friendRequests = [];
    if (!userData[userId].friendRequests) userData[userId].friendRequests = [];

    if (userData[friendId].friendRequests.some(r => r.fromId === userId)) {
      return callback?.({ success: false, error: 'Запрос уже отправлен' });
    }

    const incoming = userData[userId].friendRequests.find(r => r.fromId === friendId);
    if (incoming) {
      userData[userId].friendRequests = userData[userId].friendRequests.filter(r => r.fromId !== friendId);
      userData[userId].friends = [...(userData[userId].friends || []), friendId];
      userData[friendId].friends = [...(userData[friendId].friends || []), userId];
      saveUserData();
      const initiator = users.find(u => u.id === userId);
      if (!userData[friendId].notifications) userData[friendId].notifications = [];
      userData[friendId].notifications.push({ text: `${initiator?.name || 'Игрок'} принял ваш запрос в друзья`, timestamp: Date.now(), read: false });
      saveUserData();
      const tSocket = onlineUsers.get(friendId);
      if (tSocket) io.to(tSocket).emit('new-notification', userData[friendId].notifications);
      return callback?.({ success: true, autoAccepted: true });
    }

    const initiator = users.find(u => u.id === userId);
    userData[friendId].friendRequests.push({ fromId: userId, fromName: initiator?.name || 'Игрок', timestamp: Date.now() });
    saveUserData();

    if (!userData[friendId].notifications) userData[friendId].notifications = [];
    userData[friendId].notifications.push({ text: `${initiator?.name || 'Игрок'} отправил вам запрос в друзья`, timestamp: Date.now(), read: false });
    saveUserData();
    const tSocket = onlineUsers.get(friendId);
    if (tSocket) io.to(tSocket).emit('new-notification', userData[friendId].notifications);

    callback?.({ success: true });
  });

  socket.on('get-friend-requests', (userId, callback) => {
    if (!userId || !userData[userId]) return callback?.({ success: false, error: 'User not found' });
    const requests = (userData[userId].friendRequests || []).map(r => ({ ...r, fromOnline: onlineUsers.has(r.fromId) }));
    callback?.({ success: true, requests });
  });

  socket.on('accept-friend-request', ({ userId, fromId }, callback) => {
    if (!userId || !fromId || !userData[userId]) return callback?.({ success: false, error: 'Invalid request' });
    if (!userData[userId].friendRequests) userData[userId].friendRequests = [];
    const request = userData[userId].friendRequests.find(r => r.fromId === fromId);
    if (!request) return callback?.({ success: false, error: 'Запрос не найден' });

    userData[userId].friendRequests = userData[userId].friendRequests.filter(r => r.fromId !== fromId);
    if (!userData[userId].friends) userData[userId].friends = [];
    if (!userData[fromId].friends) userData[fromId].friends = [];
    if (!userData[userId].friends.includes(fromId)) userData[userId].friends.push(fromId);
    if (!userData[fromId].friends.includes(userId)) userData[fromId].friends.push(userId);
    saveUserData();

    const accepter = users.find(u => u.id === userId);
    if (!userData[fromId].notifications) userData[fromId].notifications = [];
    userData[fromId].notifications.push({ text: `${accepter?.name || 'Игрок'} принял ваш запрос в друзья`, timestamp: Date.now(), read: false });
    saveUserData();
    const tSocket = onlineUsers.get(fromId);
    if (tSocket) io.to(tSocket).emit('new-notification', userData[fromId].notifications);

    callback?.({ success: true });
  });

  socket.on('decline-friend-request', ({ userId, fromId }, callback) => {
    if (!userId || !fromId || !userData[userId]) return callback?.({ success: false, error: 'Invalid request' });
    if (!userData[userId].friendRequests) userData[userId].friendRequests = [];
    userData[userId].friendRequests = userData[userId].friendRequests.filter(r => r.fromId !== fromId);
    saveUserData();
    callback?.({ success: true });
  });

  socket.on('remove-friend', ({ userId, friendId }, callback) => {
    if (!userId || !friendId || !userData[userId]) return callback?.({ success: false, error: 'Invalid request' });
    userData[userId].friends = (userData[userId].friends || []).filter(fid => fid !== friendId);
    saveUserData();
    const initiator = users.find(u => u.id === userId);
    if (userData[friendId]) {
        userData[friendId].notifications = [
            ...(userData[friendId].notifications || []),
            { text: `${initiator?.name || 'Игрок'} удалил вас из друзей`, timestamp: Date.now(), read: false }
        ];
        saveUserData();
        const targetSocketId = onlineUsers.get(friendId);
        if (targetSocketId) io.to(targetSocketId).emit('new-notification', userData[friendId].notifications);
    }
    callback?.({ success: true });
  });

  socket.on('get-notifications', (userId, callback) => {
    if (!userId || !userData[userId]) return callback?.({ success: false, error: 'User data not found' });
    callback?.({ success: true, notifications: userData[userId].notifications || [] });
  });
    socket.on('mark-notifications-read', (userId) => {
    if (!userId || !userData[userId]) return;
    if (!userData[userId].notifications) return;
    userData[userId].notifications = userData[userId].notifications.map(n => ({ ...n, read: true }));
    saveUserData();
    const tSocket = onlineUsers.get(userId);
    if (tSocket) io.to(tSocket).emit('new-notification', userData[userId].notifications);
  });

  socket.on('clear-notifications', (userId) => {
    if (!userId || !userData[userId]) return;
    userData[userId].notifications = [];
    saveUserData();
    const tSocket = onlineUsers.get(userId);
    if (tSocket) io.to(tSocket).emit('new-notification', []);
  });

    // ---- ЕЖЕДНЕВНЫЕ КВЕСТЫ (запрос и получение награды) ----
  socket.on('get-quests', (userId, callback) => {
    if (!userId || !userData[userId]) return callback?.({ success: false });
    ensureQuestsFresh(userId);
    const q = userData[userId].quests;
    const items = QUEST_DEFS.map(def => ({
      id: def.id,
      title: def.title,
      reward: def.reward,
      icon: def.icon,
      done: q.items[def.id]?.done || false,
      claimed: q.items[def.id]?.claimed || false,
    }));
    callback?.({ success: true, dayKey: q.dayKey, items });
  });

  socket.on('claim-quest', ({ userId, questId }, callback) => {
    if (!userId || !questId || !userData[userId]) return callback?.({ success: false });
    ensureQuestsFresh(userId);
    const q = userData[userId].quests;
    const item = q.items[questId];
    if (!item || !item.done || item.claimed) {
      return callback?.({ success: false, error: 'Награда недоступна' });
    }
    const def = QUEST_DEFS.find(d => d.id === questId);
    if (!def) return callback?.({ success: false, error: 'Квест не найден' });

    item.claimed = true;
    userData[userId].coins = (userData[userId].coins || 0) + def.reward;
    saveUserData();
    console.log(`💰 ${userId} забрал ${def.reward} Coins за "${questId}" (баланс: ${userData[userId].coins})`);

    // Уведомляем клиента об обновлении данных и квестов
    const sId = onlineUsers.get(userId);
    if (sId) {
      io.to(sId).emit('user-data-updated', userData[userId]);
      io.to(sId).emit('quests-updated', { dayKey: q.dayKey, items: q.items });
    }
    if (callback) callback({ success: true, reward: def.reward, coins: userData[userId].coins });
  });

  // Клиент сообщает о выполнении квеста (playGame, winGame, buyProperty, improveProperty)
  socket.on('quest-event', ({ userId, questId }) => {
    if (!userId || !questId) return;
    markQuestDone(userId, questId);
  });

      socket.on('update-active-skins', ({ userId, activeSkins }) => {
    if (!userId || !userData[userId]) return;
    userData[userId].activeSkins = activeSkins;
    saveUserData();
    // Обновляем игрока во всех игровых комнатах, где он сейчас играет
    for (const roomId in gameRooms) {
      const player = gameRooms[roomId].find(p => p.id === userId);
      if (player) {
        player.activeSkins = activeSkins;
        io.to(roomId).emit('update-game-players', gameRooms[roomId]);
        console.log(`🎨 Обновлены скины игрока ${userId} в комнате ${roomId}`);
      }
    }
});

  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);

    // НЕ удаляем игрока — помечаем как disconnected и запускаем таймер на 2 минуты
    for (const roomId in gameRooms) {
      const p = gameRooms[roomId].find(x => x.socketId === socket.id);
      if (!p) continue;

      // Если игрок уже банкрот или вышел — просто удаляем, ничего страшного
      if (p.bankrupt) {
        p.socketId = null;
        p.disconnected = true;
        io.to(roomId).emit('update-game-players', gameRooms[roomId]);
        continue;
      }

      p.disconnected = true;
      p.disconnectedAt = Date.now();
      io.to(roomId).emit('update-game-players', gameRooms[roomId]);
      console.log(`⚠️ ${p.name} отключился — 2 минуты на переподключение`);

      const timerKey = `${roomId}:${p.id}`;
      if (disconnectTimers.has(timerKey)) clearTimeout(disconnectTimers.get(timerKey));
      disconnectTimers.set(timerKey, setTimeout(() => {
        const room = gameRooms[roomId];
        if (!room) return;
        const player = room.find(x => x.id === p.id);
        if (!player || !player.disconnected) return; // уже вернулся или вышел
        // Авто-банкротство по таймауту
        player.bankrupt = true;
        player.money = 0;
        player.socketId = null;
        player.disconnected = false;
        io.to(roomId).emit('update-game-players', room);
        io.to(roomId).emit('player-left', player.id);
        console.log(`⏰ ${player.name} не переподключился — авто-банкрот`);

        const remainingAlive = room.filter(x => !x.bankrupt).length;
        if (remainingAlive <= 1) {
          io.to(roomId).emit('game-ended');
          delete roomTurnStart[roomId];
          setTimeout(() => {
            delete gameRooms[roomId];
            console.log(`🗑 Комната ${roomId} удалена после авто-банкрота`);
          }, 8000);
        }
        disconnectTimers.delete(timerKey);
      }, DISCONNECT_GRACE_MS));
    }
        // Удаляем комнату, если это было лобби хоста (не начавшееся)
    for (let i = rooms.length - 1; i >= 0; i--) {
      const room = rooms[i];
      if (!room.started && room.hostId === socket.id) {
        rooms.splice(i, 1);
        io.emit('update-rooms', rooms);
        continue;
      }
      // Иначе убираем игрока из списка
      if (!room.started && room.playerSockets && room.playerSockets[socket.id]) {
        const name = room.playerSockets[socket.id];
        delete room.playerSockets[socket.id];
        if (room.playerNames) {
          const idx = room.playerNames.indexOf(name);
          if (idx !== -1) room.playerNames.splice(idx, 1);
        }
        room.players = Math.max(0, room.players - 1);
        io.emit('update-rooms', rooms);
      }
    }
        for (const [userId, sId] of onlineUsers.entries()) {
      if (sId === socket.id) {
        onlineUsers.delete(userId);
        // Уведомляем друзей, что игрок ушёл в оффлайн
        notifyFriendsStatus(userId, false);
        // Если это гость — полностью удаляем из памяти (ник освобождается)
        const u = users.find(x => x.id === userId);
        if (u && u.guest) {
          users = users.filter(x => x.id !== userId);
          delete userData[userId];
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log('Сервер запущен на порту ' + PORT));