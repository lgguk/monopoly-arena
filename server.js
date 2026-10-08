require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const BCRYPT_ROUNDS = 10;

// Пул подключений к PostgreSQL. Держит несколько коннектов
// и переиспользует их — стандарт для Node.js.
const db = new Pool({ connectionString: process.env.DATABASE_URL });
db.on('error', (err) => console.error('❌ PostgreSQL pool error:', err));

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
// Загружаем admin_cases из БД. JSON — fallback.
async function loadAdminCases() {
  try {
    const res = await db.query('SELECT id, data FROM admin_cases ORDER BY id');
    if (res.rows.length > 0) {
      adminCases = res.rows.map((r) => r.data);
      console.log(`✅ Кейсы загружены из БД: ${adminCases.length}`);
      return;
    }
  } catch (err) {
    console.error('Ошибка загрузки кейсов из БД:', err.message);
  }
  try {
    if (fs.existsSync('admin-cases.json')) {
      adminCases = JSON.parse(fs.readFileSync('admin-cases.json'));
      console.log(`✅ Кейсы загружены из JSON (fallback): ${adminCases.length}`);
    }
  } catch (e) {}
}
async function loadMarketItems() {
  try {
    const res = await db.query('SELECT id, data FROM market_items ORDER BY id');
    if (res.rows.length > 0) {
      marketItems = res.rows.map((r) => r.data);
      console.log(`✅ Товары загружены из БД: ${marketItems.length}`);
      return;
    }
  } catch (err) {
    console.error('Ошибка загрузки товаров из БД:', err.message);
  }
  try {
    if (fs.existsSync('market-items.json')) {
      marketItems = JSON.parse(fs.readFileSync('market-items.json'));
      console.log(`✅ Товары загружены из JSON (fallback): ${marketItems.length}`);
    }
  } catch (e) {}
}
let marketListings = [];
async function loadMarketListings() {
  try {
    const res = await db.query('SELECT id, seller_id, item_data, price, created_at FROM market_listings ORDER BY created_at');
    if (res.rows.length > 0) {
      marketListings = res.rows.map((r) => ({
        id: r.id,
        sellerId: r.seller_id,
        item: r.item_data,
        price: Number(r.price),
        createdAt: Number(r.created_at),
      }));
      console.log(`✅ Объявления загружены из БД: ${marketListings.length}`);
      return;
    }
  } catch (err) {
    console.error('Ошибка загрузки объявлений из БД:', err.message);
  }
  try {
    if (fs.existsSync('market-listings.json')) {
      marketListings = JSON.parse(fs.readFileSync('market-listings.json'));
      console.log(`✅ Объявления загружены из JSON (fallback): ${marketListings.length}`);
    }
  } catch (e) {}
}

// ---- ТРЕЙДЫ (ОБМЕНЫ) ----
let trades = []; // массив в памяти, синхронизируется с БД

async function loadTrades() {
  try {
    const res = await db.query(
      `SELECT id, from_user_id, to_user_id, from_items, to_items, status, created_at, resolved_at
       FROM trades
       WHERE status = 'pending'
       ORDER BY created_at DESC`
    );
    trades = res.rows.map((r) => ({
      id: String(r.id),
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
      fromItems: r.from_items || [],
      toItems: r.to_items || [],
      status: r.status,
      createdAt: new Date(r.created_at).getTime(),
      resolvedAt: r.resolved_at ? new Date(r.resolved_at).getTime() : null,
    }));
    console.log(`✅ Обмены загружены из БД: ${trades.length}`);
  } catch (err) {
    console.error('❌ Ошибка загрузки trades из БД:', err.message);
    trades = [];
  }
}

async function saveTradeToDb(trade) {
  try {
    const res = await db.query(
      `INSERT INTO trades (from_user_id, to_user_id, from_items, to_items, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        trade.fromUserId,
        trade.toUserId,
        JSON.stringify(trade.fromItems || []),
        JSON.stringify(trade.toItems || []),
        trade.status || 'pending',
      ]
    );
    return String(res.rows[0].id);
  } catch (err) {
    console.error('❌ Ошибка сохранения трейда в БД:', err);
    return null;
  }
}

async function updateTradeStatusInDb(tradeId, status) {
  try {
    await db.query(
      `UPDATE trades SET status = $1, resolved_at = NOW() WHERE id = $2`,
      [status, Number(tradeId)]
    );
  } catch (err) {
    console.error('❌ Ошибка обновления статуса трейда в БД:', err);
  }
}

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

async function loadUserDataFromDb() {
  try {
    const usersRes = await db.query('SELECT id FROM users');
    const userIds = usersRes.rows.map((r) => r.id);

    for (const uid of userIds) {
      // Основные поля
      const udRes = await db.query('SELECT * FROM user_data WHERE user_id = $1', [uid]);
      const base = udRes.rows[0] || {};

      // Инвентарь + дедупликация по item.id (защита от старых багов с race condition).
      const invRes = await db.query(
        'SELECT market_item_id, item_data, owned_at FROM inventory WHERE user_id = $1',
        [uid]
      );
      const seenItemIds = new Set();
      const inventory = [];
      let dupsSkipped = 0;
      for (const r of invRes.rows) {
        const itemId = String(r.item_data?.id || '');
        if (itemId && seenItemIds.has(itemId)) {
          dupsSkipped++;
          continue;
        }
        if (itemId) seenItemIds.add(itemId);
        inventory.push({
          ...r.item_data,
          marketItemId: r.market_item_id || r.item_data?.marketItemId,
          ownedAt: r.owned_at ? new Date(r.owned_at).toISOString() : undefined,
        });
      }
      if (dupsSkipped > 0) {
        console.log(`🧹 ${uid}: пропущено дублей в инвентаре: ${dupsSkipped} (будут удалены из БД при следующем сохранении)`);
      }

      // Активные скины. Храним inventory_item_id (уникальный id предмета в инвентаре),
      // а не market_item_id. Так у двух одинаковых Intel будет только один активный.
      const skinsRes = await db.query(
        'SELECT slot_index, inventory_item_id FROM active_skins WHERE user_id = $1',
        [uid]
      );
      const inventoryIds = new Set(
        inventory.map((it) => String(it.id || '')).filter(Boolean)
      );
      const activeSkins = {};
      skinsRes.rows.forEach((r) => {
        if (inventoryIds.has(String(r.inventory_item_id))) {
          activeSkins[r.slot_index] = r.inventory_item_id;
        }
      });

      // Друзья (accepted)
      const friendsRes = await db.query(
        "SELECT friend_id FROM friendships WHERE user_id = $1 AND status = 'accepted'",
        [uid]
      );
      const friends = friendsRes.rows.map((r) => r.friend_id);

      // Входящие заявки (pending, где я — получатель)
      const reqsRes = await db.query(
        "SELECT user_id, created_at FROM friendships WHERE friend_id = $1 AND status = 'pending'",
        [uid]
      );
      const friendRequests = reqsRes.rows.map((r) => ({
        fromId: r.user_id,
        timestamp: new Date(r.created_at).getTime(),
      }));

      // Квесты
      const questsRes = await db.query(
        'SELECT day_key, quest_id, done, claimed, progress, target FROM quest_progress WHERE user_id = $1',
        [uid]
      );
      let quests = null;
      if (questsRes.rows.length > 0) {
        const daily = {};
        const weekly = {};
        let dayKey = null;
        let weekKey = null;
        const dailyIds = new Set(DAILY_QUESTS.map((d) => d.id));
        questsRes.rows.forEach((r) => {
          const item = {
            done: r.done,
            claimed: r.claimed,
            progress: Number(r.progress) || 0,
            target: Number(r.target) || 0,
          };
          if (dailyIds.has(r.quest_id)) {
            daily[r.quest_id] = item;
            dayKey = r.day_key;
          } else {
            weekly[r.quest_id] = item;
            weekKey = r.day_key;
          }
        });
        quests = { dayKey, weekKey, daily, weekly };
      }

      // Уведомления
      const notifRes = await db.query(
        'SELECT text, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
        [uid]
      );
      const notifications = notifRes.rows.map((r) => ({
        text: r.text,
        read: r.read,
        timestamp: new Date(r.created_at).getTime(),
      }));

      userData[uid] = {
        coins: Number(base.coins) || 2400,
        stats: base.stats || { games: 0, wins: 0, xp: 0, level: 0 },
        vipUntil: base.vip_until ? new Date(base.vip_until).toISOString() : null,
        minutesOnline: Number(base.minutes_online) || 0,
        inventory,
        activeSkins,
        friends,
        friendRequests,
        quests,
        notifications,
      };
    }
    console.log(`✅ Данные пользователей загружены из БД: ${Object.keys(userData).length}`);

    // Миграция: пересчитываем stats.level по новой прогрессивной шкале.
    // Раньше уровень считался как floor(xp/1000), теперь через getLevelFromXp.
    let migratedLevels = 0;
    for (const uid of Object.keys(userData)) {
      const s = userData[uid]?.stats;
      if (!s) continue;
      const correct = getLevelFromXp(s.xp || 0);
      if (s.level !== correct) {
        s.level = correct;
        migratedLevels++;
      }
    }
    if (migratedLevels > 0) {
      console.log(`📈 Пересчитано уровней: ${migratedLevels}`);
    }

    // Чистим дубли в inventory и пересохраняем всех игроков.
    // saveUserData делает DELETE + INSERT — дубликаты исчезнут из БД.
    let resaved = 0;
    for (const uid of Object.keys(userData)) {
      if (!userData[uid]) continue;
      await saveUserData(uid);
      resaved++;
    }
    console.log(`💾 Пересохранено игроков после миграции: ${resaved}`);
  } catch (err) {
    console.error('❌ Ошибка загрузки userData из БД, fallback на JSON:', err.message);
    try {
      if (fs.existsSync(USER_DATA_FILE)) {
        userData = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf8'));
        console.log(`⚠️  Данные пользователей загружены из JSON (fallback): ${Object.keys(userData).length}`);
      }
    } catch (e) {}
  }
}

// Сохранение users в БД. Всё, что было в памяти, синхронизируется через UPSERT.
// JSON-файл больше не трогаем — оставляем его как резервную копию на случай отката.
async function saveUsers() {
  try {
    for (const u of users) {
      await db.query(
        `INSERT INTO users (id, login, password, name, initials, color, guest, created_at, avatar)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET
           login = EXCLUDED.login,
           password = EXCLUDED.password,
           name = EXCLUDED.name,
           initials = EXCLUDED.initials,
           color = EXCLUDED.color,
           guest = EXCLUDED.guest,
           avatar = EXCLUDED.avatar`,
        [
          u.id,
          u.login || null,
          u.password || null,
          u.name || "Игрок",
          u.initials || null,
          u.color || null,
          !!u.guest,
          u.createdAt || Date.now(),
          u.avatar || null,
        ]
      );
    }
  } catch (err) {
    console.error('❌ Ошибка сохранения users в БД:', err);
  }
}

// Очередь сериализации saveUserData. Для каждого uid держим промис,
// чтобы два параллельных вызова не наложились DELETE/INSERT друг на друга
// (иначе в inventory получались дубликаты).
const saveQueues = new Map(); // uid -> Promise

function enqueueSave(uid, fn) {
  const prev = saveQueues.get(uid) || Promise.resolve();
  const next = prev.then(fn, fn); // продолжаем даже если предыдущий упал
  saveQueues.set(uid, next);
  // Чистим очередь, когда работа завершена и это последний таск
  next.finally(() => {
    if (saveQueues.get(uid) === next) saveQueues.delete(uid);
  });
  return next;
}

// Сохраняем user_data + все связанные сущности в БД.
// Если userId не задан — сохраняем всех. Если задан — только одного
// (быстрее и безопаснее, когда меняем данные одного игрока).
// Возвращает промис, который резолвится, когда все записи реально завершены.
async function saveUserData(userId = null) {
  // Для массового сохранения фильтруем «сирот»: если игрока нет в users
  // (гость удалён при disconnect, а userData остался) — не пытаемся писать
  // его в БД, иначе падает FK constraint user_data_user_id_fkey.
  const validIdSet = userId ? null : new Set(users.map(u => u.id));
  const ids = userId
    ? [userId]
    : Object.keys(userData).filter(uid => validIdSet.has(uid));
  const tasks = [];
  for (const uid of ids) {
    // Сериализуем сохранение для каждого uid через очередь.
    tasks.push(enqueueSave(uid, () => saveUserDataOne(uid)));
  }
  return Promise.all(tasks);
}

// Внутренняя функция — сохраняет одного игрока. Вызывается только через очередь.
async function saveUserDataOne(uid) {
  {
    const d = userData[uid];
    if (!d) return;
    // Гости в таблицу users не пишутся (см. register) — значит, писать их
    // user_data нельзя: FK user_data_user_id_fkey падает.
    // Гости эфемерны, их данные живут только в памяти до disconnect.
    const u = users.find((x) => x.id === uid);
    if (!u || u.guest) return;
    try {
      // ===== user_data (плоские поля) =====
      await db.query(
        `INSERT INTO user_data (user_id, coins, stats, vip_until, minutes_online)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id) DO UPDATE SET
           coins = EXCLUDED.coins,
           stats = EXCLUDED.stats,
           vip_until = EXCLUDED.vip_until,
           minutes_online = EXCLUDED.minutes_online,
           updated_at = NOW()`,
        [
          uid,
          Number(d.coins) || 0,
          JSON.stringify(d.stats || { games: 0, wins: 0, xp: 0, level: 0 }),
          d.vipUntil ? new Date(d.vipUntil) : null,
          Number(d.minutesOnline) || 0,
        ]
      );

      // ===== inventory (delete + insert) =====
      await db.query('DELETE FROM inventory WHERE user_id = $1', [uid]);
      const inv = Array.isArray(d.inventory) ? d.inventory : [];
      for (const item of inv) {
        const mId = item.marketItemId || null;
        const itemData = { ...item };
        await db.query(
          `INSERT INTO inventory (user_id, market_item_id, item_data, owned_at)
           VALUES ($1,$2,$3,$4)`,
          [
            uid,
            mId,
            JSON.stringify(itemData),
            item.ownedAt ? new Date(item.ownedAt) : new Date(),
          ]
        );
      }

      // ===== active_skins =====
      await db.query('DELETE FROM active_skins WHERE user_id = $1', [uid]);
      const skins = d.activeSkins || {};
      const invIds = new Set((d.inventory || []).map((it) => String(it.id || '')));
      for (const slotKey of Object.keys(skins)) {
        const slot = Number(slotKey);
        if (Number.isNaN(slot)) continue;
        const itemId = String(skins[slotKey]);
        // Сохраняем только если предмет реально есть в инвентаре
        if (!invIds.has(itemId)) continue;
        await db.query(
          `INSERT INTO active_skins (user_id, slot_index, inventory_item_id)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [uid, slot, itemId]
        );
      }

      // ===== friendships (только accepted) =====
      await db.query(
        `DELETE FROM friendships WHERE user_id = $1 AND status = 'accepted'`,
        [uid]
      );
      const friends = Array.isArray(d.friends) ? d.friends : [];
      for (const fid of friends) {
        await db.query(
          `INSERT INTO friendships (user_id, friend_id, status)
           VALUES ($1,$2,'accepted') ON CONFLICT DO NOTHING`,
          [uid, fid]
        );
      }

      // ===== quest_progress =====
      // Храним и daily, и weekly. Ключ дня — "YYYY-MM-DD", недели — "YYYY-Www".
      if (d.quests) {
        await db.query('DELETE FROM quest_progress WHERE user_id = $1', [uid]);
        const writeBucket = async (bucket, periodKey) => {
          if (!bucket || !periodKey) return;
          for (const qid of Object.keys(bucket)) {
            const it = bucket[qid] || {};
            await db.query(
              `INSERT INTO quest_progress (user_id, day_key, quest_id, done, claimed, progress, target)
               VALUES ($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT (user_id, day_key, quest_id) DO UPDATE SET
                 done = EXCLUDED.done,
                 claimed = EXCLUDED.claimed,
                 progress = EXCLUDED.progress,
                 target = EXCLUDED.target`,
              [
                uid,
                periodKey,
                qid,
                !!it.done,
                !!it.claimed,
                Number(it.progress) || 0,
                Number(it.target) || 0,
              ]
            );
          }
        };
        await writeBucket(d.quests.daily, d.quests.dayKey);
        await writeBucket(d.quests.weekly, d.quests.weekKey);
      }

      // ===== notifications (delete + insert) =====
      await db.query('DELETE FROM notifications WHERE user_id = $1', [uid]);
      const notifs = Array.isArray(d.notifications) ? d.notifications : [];
      for (const n of notifs) {
        if (!n || !n.text) continue;
        await db.query(
          `INSERT INTO notifications (user_id, text, read, created_at)
           VALUES ($1,$2,$3,$4)`,
          [uid, n.text, !!n.read, n.timestamp ? new Date(n.timestamp) : new Date()]
        );
      }
    } catch (err) {
      console.error(`❌ Ошибка сохранения user_data для ${uid}:`, err);
    }
  }
}

// Запись в журнал транзакций. Вызываем при каждом изменении баланса Coins.
// amount > 0 — начисление, amount < 0 — списание.
async function logTransaction(userId, type, amount, metadata = {}) {
  try {
    await db.query(
      `INSERT INTO transactions (user_id, type, amount, metadata)
       VALUES ($1, $2, $3, $4)`,
      [userId, type, Math.round(amount), JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error(`❌ Ошибка записи транзакции (${type} для ${userId}):`, err);
  }
}

// Единая точка изменения баланса Coins.
// Все операции (квесты, магазин, рынок, VIP, будущие депозиты) идут через неё.
// Возвращает { success, newBalance } или { success: false, error }.
async function changeBalance(userId, type, amount, metadata = {}) {
  const d = userData[userId];
  if (!d) return { success: false, error: 'Игрок не найден' };

  const current = Number(d.coins) || 0;
  const next = current + amount;

  // Не даём уйти в минус (для списаний). Для начислений — без ограничений.
  if (next < 0) {
    return { success: false, error: 'Недостаточно Coins' };
  }

  d.coins = next;
  await logTransaction(userId, type, amount, metadata);
  return { success: true, newBalance: next };
}

// Проверяет, можно ли предмет положить в обмен.
// Возвращает null, если всё ок, либо строку с ошибкой.
function canItemBeTraded(userId, item) {
  if (!item) return 'Предмет не найден';
  if (item.lockedInTradeId) return 'Предмет уже участвует в другом обмене';
  // Запрет на обмен предмета, полученного от обмена, в течение 2 часов
  if (item.tradedAt) {
    const elapsed = Date.now() - new Date(item.tradedAt).getTime();
    if (elapsed < 2 * 60 * 60 * 1000) {
      return 'Предмет нельзя обменять в течение 2 часов после получения';
    }
  }
  return null;
}

// Блокирует предметы (ставит метку lockedInTradeId). Не сохраняет в БД.
function lockItemsForTrade(userId, itemIds, tradeId) {
  const inv = userData[userId]?.inventory || [];
  inv.forEach((it) => {
    if (itemIds.includes(it.id)) it.lockedInTradeId = tradeId;
  });
}

// Снимает блокировку (удаляет поле lockedInTradeId)
function unlockItemsFromTrade(userId, itemIds) {
  const inv = userData[userId]?.inventory || [];
  inv.forEach((it) => {
    if (itemIds.includes(it.id)) delete it.lockedInTradeId;
  });
}

// ============ ФИНАЛИЗАЦИЯ ПАРТИИ ============
// Coins за партию — намеренно низкие, основной доход с квестов (~500/нед).
// XP — прогресс уровня, не валюта. VIP: +50% XP, +20% Coins (см. finalizeGame).
const PLACE_REWARDS = [
  { coins: 15, xp: 150 },
  { coins: 12, xp: 120 },
  { coins: 10, xp: 90 },
  { coins: 10, xp: 50 },
  { coins: 10, xp: 50 },
];

// Прогрессивная шкала уровней: порог перехода на уровень L = 1000 + 200·(L−1).
// Пороги: L1=1000, L2=2200, L3=3600, L4=5200, L5=7000 …
function getLevelFromXp(xp) {
  let level = 0;
  let remaining = Number(xp) || 0;
  while (level < 200) {
    const cost = 1000 + 200 * level;
    if (remaining < cost) break;
    remaining -= cost;
    level++;
  }
  return level;
}

// Начисляет награды по итогам партии. Вызывается один раз на комнату.
// Правила мест:
//  - 1 живой → place 1
//  - Остальные банкроты → по порядку выбывания (последний выбывший — следующий после победителя)
//  - leftAlive → place 0 (без награды)
//  - 0 живых, все leftAlive → всем place 0
async function finalizeGame(roomId) {
  const room = gameRooms[roomId];
  if (!room || room.finalized) return;

  const players = room.filter(p => p && p.id);
  if (players.length === 0) return;

  const aliveCount = players.filter(p => !p.bankrupt).length;
  if (aliveCount > 1) return;

  room.finalized = true;

  // === АНТИ-ФАРМ ===
  // Полная (полноценная) партия требует ОБА условия:
  //   1) длительность >= 5 минут;
  //   2) каждый живой на момент финализации сделал >= 7 бросков.
  // Плюс победитель должен быть живым — это гарантируется тем, что
  // place 1 получает только игрок из `alive` (см. ниже). Если все
  // вышли живыми или все банкроты — place 1 никому не присваивается.
  //
  // Если хотя бы одно из условий не выполнено — партия считается
  // короткой: всем не-leftAlive даётся 1 coin + 10 xp без VIP-бонусов
  // и без дропа.
  const startedAt = Number(room.startedAt) || 0;
  const gameDurationMs = startedAt > 0 ? Date.now() - startedAt : 0;
  const durationOk = gameDurationMs >= 5 * 60 * 1000;
  const rollsByPlayer = room.rollsByPlayer || {};
  const finalAlive = players.filter(p => !p.bankrupt && !p.leftAlive);
  const rollsOk =
    finalAlive.length === 1 &&
    finalAlive.every(p => (rollsByPlayer[p.id] || 0) > 6);
  const isFullGame = durationOk && rollsOk;

  console.log(
    `🏁 Финализация партии ${roomId}. Живых: ${aliveCount}. ` +
    `Длительность: ${Math.round(gameDurationMs / 1000)}с (${durationOk ? "≥5мин" : "<5мин"}). ` +
    `Броски: ${finalAlive.map(p => `${p.name}:${rollsByPlayer[p.id] || 0}`).join(", ") || "—"}. ` +
    `Полная партия: ${isFullGame ? "ДА" : "НЕТ"}`,
  );

  const eliminationOrder = Array.isArray(room.eliminationOrder) ? room.eliminationOrder : [];
  const alive = players.filter(p => !p.bankrupt);
  const placeMap = {};

  // Живой победитель (или последний живой)
  if (alive.length === 1) {
    placeMap[alive[0].id] = 1;
  }

  // Банкроты: последний в eliminationOrder получает место (alive?2:1),
  // предпоследний — на одно больше и т.д.
  const reversed = [...eliminationOrder].reverse();
  const basePlace = alive.length === 1 ? 2 : 1;
  reversed.forEach((pid, idx) => {
    placeMap[pid] = basePlace + idx;
  });

  const SHORT_GAME_COINS = 1;
  const SHORT_GAME_XP = 10;

  const results = [];
  for (const p of players) {
    const place = placeMap[p.id] || 0;

    // leftAlive или никому не присвоено место — награду не получает.
    if (place === 0) {
      results.push({
        userId: p.id,
        place: 0,
        coins: 0,
        xp: 0,
        dropName: null,
        leftAlive: !!p.leftAlive,
        shortGame: false,
      });
      continue;
    }

    let coins;
    let xp;
    let dropName = null;

    if (isFullGame) {
      const reward = PLACE_REWARDS[Math.min(place - 1, PLACE_REWARDS.length - 1)] || { coins: 0, xp: 0 };
      const isVip = p.vipUntil ? new Date(p.vipUntil) > new Date() : false;
      xp = isVip ? Math.round(reward.xp * 1.5) : reward.xp;
      coins = isVip ? Math.round(reward.coins * 1.2) : reward.coins;

      // Дроп — только в полной партии, шанс 25%.
      const realItems = marketItems.filter(i => i.isActive === true);
      if (Math.random() < 0.10 && realItems.length > 0) {
        const drop = realItems[Math.floor(Math.random() * realItems.length)];
        if (drop.category === 'vip') {
          const days = Number(drop.vipDuration) || 7;
          const now = Date.now();
          const currentUntil = userData[p.id]?.vipUntil ? new Date(userData[p.id].vipUntil).getTime() : 0;
          const baseTime = currentUntil > now ? currentUntil : now;
          const vipEnd = new Date(baseTime + days * 24 * 60 * 60 * 1000);
          if (userData[p.id]) userData[p.id].vipUntil = vipEnd.toISOString();
          dropName = `${drop.name} (VIP +${days} дн.)`;
        } else {
          const ownedItem = {
            id: `${drop.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: drop.name,
            type: drop.category === 'dice' ? 'dice' : 'board',
            rarity: drop.rarity,
            color: '#29233e',
            price: drop.price,
            description: drop.description || (drop.category === 'dice' ? 'Скин кубиков' : 'Карточка поля'),
            ownedAt: new Date().toISOString(),
            slotIndex: drop.slotIndex,
            imageDataUrl: drop.imageDataUrl,
            marketItemId: drop.id,
            cardWidth: drop.cardWidth,
            cardHeight: drop.cardHeight,
            imageHeight: drop.imageHeight,
            shopScale: drop.shopScale,
          };
          if (userData[p.id]) {
            if (!userData[p.id].inventory) userData[p.id].inventory = [];
            userData[p.id].inventory.push(ownedItem);
          }
          dropName = drop.name;
        }
      }
    } else {
      // Короткая партия — утешительная награда, без VIP-бонусов, без дропа.
      coins = SHORT_GAME_COINS;
      xp = SHORT_GAME_XP;
    }

    // Начисляем Coins
    const change = await changeBalance(p.id, 'game_reward', coins, {
      place,
      dropName,
      shortGame: !isFullGame,
    });
    if (change.success) {
      const d = userData[p.id];
      if (d) {
        if (!d.stats) d.stats = { games: 0, wins: 0, xp: 0, level: 0 };
        d.stats.games = (d.stats.games || 0) + 1;
        if (place === 1) d.stats.wins = (d.stats.wins || 0) + 1;
        d.stats.xp = (d.stats.xp || 0) + xp;
        d.stats.level = getLevelFromXp(d.stats.xp);
      }
      markQuestProgress(p.id, 'playGame');
      if (place === 1) markQuestProgress(p.id, 'winGame');
      await saveUserData(p.id);

      const placeWord = place === 1 ? "1 место" : `${place}-е место`;
      const dropInfo = dropName ? ` Дроп: «${dropName}».` : "";
      const shortNote = !isFullGame
        ? " Партия короткая — утешительная награда."
        : "";
      await notifyUser(
        p.id,
        `🏆 Партия завершена: ${placeWord}, +${coins} Coins, +${xp} XP.${dropInfo}${shortNote}`,
      );
    }

    results.push({
      userId: p.id,
      place,
      coins,
      xp,
      dropName,
      leftAlive: false,
      shortGame: !isFullGame,
    });
    console.log(
      `🏆 ${p.id} → place ${place}, +${coins} Coins, +${xp} XP` +
      `${dropName ? ', дроп: ' + dropName : ''}` +
      `${!isFullGame ? ' (короткая партия)' : ''}`,
    );
  }

  if (gameRooms[roomId]) {
    gameRooms[roomId].finalResults = results;
  }
  io.to(roomId).emit('game-rewards', { roomId, results });
}

// Проверяем: если живых ≤ 1, запускаем финализацию
function maybeFinalize(roomId) {
  const room = gameRooms[roomId];
  if (!room || room.finalized) return;
  const players = room.filter(p => p && p.id);
  if (players.length === 0) return;
  const aliveCount = players.filter(p => !p.bankrupt).length;
  if (aliveCount <= 1) finalizeGame(roomId);
}
// Отправляет игроку уведомление: пишет в БД и эмитит socket, если он онлайн.
// Используется для событий, которые игрок не инициировал сам:
// - награда за партию
// - продажа предмета на рынке
// - обмены (запрос, принятие, отклонение, отмена)
// - друзья (заявки, принятие)
async function notifyUser(userId, text) {
  if (!userId || !userData[userId]) return;
  try {
    if (!userData[userId].notifications) userData[userId].notifications = [];
    const notif = { text, timestamp: Date.now(), read: false };
    userData[userId].notifications.push(notif);
    // Держим последние 50 уведомлений
    if (userData[userId].notifications.length > 50) {
      userData[userId].notifications = userData[userId].notifications.slice(-50);
    }

    // Пишем в БД
    await db.query(
      `INSERT INTO notifications (user_id, text, read, created_at)
       VALUES ($1, $2, false, NOW())`,
      [userId, text]
    );

    // Эмитим онлайн-игроку
    const sId = onlineUsers.get(userId);
    if (sId) {
      io.to(sId).emit('new-notification', userData[userId].notifications);
    }
  } catch (err) {
    console.error(`❌ Ошибка notifyUser для ${userId}:`, err);
  }
}

// Загрузка admin_settings из БД. JSON остаётся fallback'ом, если БД недоступна.
async function loadAdminSettings() {
  try {
    const res = await db.query('SELECT data FROM admin_settings WHERE id = 1');
    if (res.rows.length > 0) {
      adminSettings = res.rows[0].data;
      console.log('✅ Настройки загружены из БД');
      return;
    }
  } catch (err) {
    console.error('Ошибка загрузки настроек из БД:', err.message);
  }
  // Fallback — из JSON
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      adminSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      console.log('✅ Настройки загружены из JSON (fallback)');
    }
  } catch (err) {
    console.error('Ошибка загрузки настроек из JSON:', err);
  }
}


async function loadCardDesigns() {
  try {
    const res = await db.query('SELECT id, slot_index, data FROM card_designs ORDER BY slot_index');
    if (res.rows.length > 0) {
      cardDesigns = res.rows.map((r) => r.data);
      console.log(`✅ Дизайны загружены из БД: ${cardDesigns.length}`);
      return;
    }
  } catch (err) {
    console.error('Ошибка загрузки дизайнов из БД:', err.message);
  }
  try {
    if (fs.existsSync(DESIGNS_FILE)) {
      cardDesigns = JSON.parse(fs.readFileSync(DESIGNS_FILE, 'utf8'));
      console.log(`✅ Дизайны загружены из JSON (fallback): ${cardDesigns.length}`);
    }
  } catch (err) {
    console.error('Ошибка загрузки дизайнов из JSON:', err);
  }
}

const app = express();
app.use(cors({ origin: "*" }));
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 25 * 1024 * 1024, // 25 МБ — с запасом на крупные сжатые картинки
});

// Хранилище лобби и игровых сессий
let rooms = [];
// { roomId: [playerObj, playerObj, ...] }
let gameRooms = {};
// roomId -> { mode, maxPlayers } — сохраняется до создания gameRooms,
// чтобы знать maxPlayers после удаления лобби из rooms.
const roomMeta = {};
// Таймеры отключения: ключ `${roomId}:${playerId}` → timeoutId
const disconnectTimers = new Map();
const DISCONNECT_GRACE_MS = 2 * 60 * 1000; // 2 минуты
// Когда начался текущий ход в каждой комнате: roomId -> timestamp
const roomTurnStart = {};
const TURN_DURATION_CLASSIC = 45;
const TURN_DURATION_FAST = 30;
function getTurnDuration(mode) {
  return (mode === "Быстрая" || mode === "Дуэль") ? TURN_DURATION_FAST : TURN_DURATION_CLASSIC;
}
function isFastMode(mode) {
  return mode === "Быстрая" || mode === "Дуэль";
}

// ============ ИГРОВОЙ ТАЙМЕР (серверный, единый источник истины) ============
// roomId -> { timeoutId, endsAt, playerId }
// Клиент шлёт timer-start, сервер рассылает всем абсолютное endsAt,
// каждый клиент считает остаток = endsAt - Date.now(). Это исключает
// рассинхрон между вкладками и троттлинг setInterval в фоне.
const turnTimers = new Map();

function clearTurnTimer(roomId) {
  const t = turnTimers.get(roomId);
  if (t && t.timeoutId) clearTimeout(t.timeoutId);
  turnTimers.delete(roomId);
}

function startTurnTimer(roomId, durationSec, playerId) {
  if (!roomId || !gameRooms[roomId]) return;
  clearTurnTimer(roomId);
  const dur = Math.max(1, Math.min(300, Number(durationSec) || TURN_DURATION_CLASSIC));
  const endsAt = Date.now() + dur * 1000;
  roomTurnStart[roomId] = Date.now();

  const timeoutId = setTimeout(() => {
    // Сервер сам фиксирует истечение и рассылает всем единое событие.
    const t = turnTimers.get(roomId);
    if (!t || t.endsAt !== endsAt) return; // таймер уже перезапущен
    turnTimers.delete(roomId);
    const room = gameRooms[roomId];
    if (!room) return;
    const p = room.find(x => x.id === playerId);
    console.log(`⏰ Таймер ${roomId} истёк у ${p?.name || playerId}`);
    io.to(roomId).emit('timer-expired', { roomId, playerId });
  }, dur * 1000);

  turnTimers.set(roomId, { timeoutId, endsAt, playerId });
  io.to(roomId).emit('timer-start', { roomId, endsAt, durationSec: dur, playerId });
}

function pauseTurnTimer(roomId) {
  if (!roomId || !gameRooms[roomId]) return;
  clearTurnTimer(roomId);
  io.to(roomId).emit('timer-pause', { roomId });
}

// Уникальный токен, генерируется при каждом запуске сервера.
// Клиенты используют его, чтобы понять, что сервер перезапустился.
const SERVER_START_TOKEN = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 10);

// Статус сервера, управляется админом: "online" | "maintenance"
let serverStatus = "online";
// Онлайн-пользователи: userId -> socketId
const onlineUsers = new Map();
// Защита от параллельных покупок одного игрока (двойной клик/React StrictMode).
const buyLocks = new Set();

// Rate limit для личных сообщений: не больше 5 сообщений за 3 секунды.
// Защита от спама и от перегрузки socket-ретрансляции при большом онлайне.
// Ключ — userId отправителя. Запись перезаписывается при следующем сообщении.
const friendMsgRate = new Map();
const FRIEND_MSG_LIMIT = 5;
const FRIEND_MSG_WINDOW_MS = 3000;

function checkFriendMsgRate(userId) {
  const now = Date.now();
  const rec = friendMsgRate.get(userId);
  if (!rec || now > rec.resetAt) {
    friendMsgRate.set(userId, { count: 1, resetAt: now + FRIEND_MSG_WINDOW_MS });
    return true;
  }
  if (rec.count >= FRIEND_MSG_LIMIT) return false;
  rec.count++;
  return true;
}
// Rate limit для общего чата на главной. Порог выше, чем в личке —
// там пишут чаще. 10 сообщений за 5 секунд. Ключ — socket.id
// (для глобала у гостей нет userId).
const chatMsgRate = new Map();
const CHAT_MSG_LIMIT = 5;
const CHAT_MSG_WINDOW_MS = 5000;

// Детект дублей в общем чате. Считаем подряд идущие одинаковые сообщения
// (после нормализации: lowercase, без пунктуации, одиночные пробелы).
// 3 подряд → блок на 30 секунд.
const chatMsgHistory = new Map();
const CHAT_DUP_LIMIT = 3;
const CHAT_DUP_BLOCK_MS = 30000;

function normalizeChatText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Возвращает { ok: true } либо { ok: false, blockMs }.
// Хранит только последнее сообщение + счётчик повторов подряд на socketId.
function checkChatDupes(socketId, text) {
  const norm = normalizeChatText(text);
  if (!norm) return { ok: true };
  const last = chatMsgHistory.get(socketId) || { text: null, count: 0 };
  if (last.text === norm) {
    last.count += 1;
  } else {
    last.text = norm;
    last.count = 1;
  }
  chatMsgHistory.set(socketId, last);
  // 1-е сообщение — count=1 (ok). 2-е одинаковое — count=2 (ok).
  // 3-е одинаковое подряд — count=3 → блок.
  if (last.count >= CHAT_DUP_LIMIT) {
    chatMsgHistory.set(socketId, { text: null, count: 0 });
    return { ok: false, blockMs: CHAT_DUP_BLOCK_MS };
  }
  return { ok: true };
}

// Rate limit для игрового чата (внутри партии). Ключ — socket.id.
// 5 сообщений за 3 секунды, лимит истории не нужен — комната живёт партию.
const gameChatRate = new Map();
const GAME_CHAT_LIMIT = 5;
const GAME_CHAT_WINDOW_MS = 3000;

function checkGameChatRate(socketId) {
  const now = Date.now();
  const rec = gameChatRate.get(socketId);
  if (!rec || now > rec.resetAt) {
    gameChatRate.set(socketId, { count: 1, resetAt: now + GAME_CHAT_WINDOW_MS });
    return true;
  }
  if (rec.count >= GAME_CHAT_LIMIT) return false;
  rec.count++;
  return true;
}

// История общего чата на главной. Храним последние 300 сообщений
// в памяти процесса (не в БД — при рестарте сервера история сбрасывается).
// Клиент при заходе на главную запрашивает последние 20, чтобы чат
// не был пустым после F5. Полная история с сервера не отдаётся.
const globalChatHistory = [];
const GLOBAL_CHAT_HISTORY_MAX = 300;
const GLOBAL_CHAT_HISTORY_SEND = 20;

function checkChatMsgRate(socketId) {
  const now = Date.now();
  const rec = chatMsgRate.get(socketId);
  if (!rec || now > rec.resetAt) {
    chatMsgRate.set(socketId, { count: 1, resetAt: now + CHAT_MSG_WINDOW_MS });
    return true;
  }
  if (rec.count >= CHAT_MSG_LIMIT) return false;
  rec.count++;
  return true;
}
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

// ============ КВЕСТЫ ============
// Ежедневные — сбрасываются в полночь (МСК).
// Еженедельные — сбрасываются в ночь с воскресенья на понедельник.
// target = сколько раз нужно сделать. progress = сколько сделано.
const DAILY_QUESTS = [
  { id: 'dailyLogin',      title: 'Заходи каждый день',   reward: 5,  icon: '📅', target: 1, event: 'login' },
  { id: 'playGame',        title: 'Сыграй 1 партию',      reward: 10, icon: '🎲', target: 1, event: 'playGame' },
  { id: 'winGame',         title: 'Победи в партии',      reward: 20, icon: '🏆', target: 1, event: 'winGame' },
  { id: 'buyProperty',     title: 'Купи 1 поле',          reward: 5,  icon: '🏠', target: 1, event: 'buyProperty' },
  { id: 'improveProperty', title: 'Улучши 1 поле',        reward: 10, icon: '⭐', target: 1, event: 'improveProperty' },
];

const WEEKLY_QUESTS = [
  { id: 'weeklyWin3',        title: 'Победи 3 раза',            reward: 50,  icon: '🥇', target: 3, event: 'winGame' },
  { id: 'weeklyPlay10',      title: 'Сыграй 10 партий',         reward: 30,  icon: '🎯', target: 10, event: 'playGame' },
  { id: 'weeklyMonopoly',    title: 'Собери монополию',         reward: 100, icon: '🏛', target: 1, event: 'monopoly' },
  { id: 'weeklyMarketDeal',  title: 'Соверши сделку на рынке',  reward: 20,  icon: '💱', target: 1, event: 'marketDeal' },
];

const QUEST_DEFS = [...DAILY_QUESTS, ...WEEKLY_QUESTS];

// Ключ дня по московскому времени (UTC+3), формат "YYYY-MM-DD"
function getMoscowDayKey() {
  const now = new Date();
  const msk = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return msk.toISOString().slice(0, 10);
}

// Ключ недели по МСК. Формат "YYYY-Www" (ISO week).
// Неделя начинается с понедельника, сбрасывается в ночь с воскресенья на понедельник.
function getMoscowWeekKey() {
  const now = new Date();
  const msk = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  // ISO week number
  const target = new Date(msk.valueOf());
  const dayNr = (msk.getUTCDay() + 6) % 7; // Пн=0, Вс=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // четверг той же недели
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Гарантирует, что у игрока есть свежие daily и weekly квесты.
// Сбрасывает просроченные (по МСК).
// НЕ сохраняет в БД сам — вызывающий код должен вызвать saveUserData после.
function ensureQuestsFresh(userId) {
  if (!userData[userId]) return false;
  const dayKey = getMoscowDayKey();
  const weekKey = getMoscowWeekKey();
  const q = userData[userId].quests;
  let changed = false;

  if (!q) {
    userData[userId].quests = { dayKey, weekKey, daily: {}, weekly: {} };
    changed = true;
  } else {
    if (q.dayKey !== dayKey) {
      q.dayKey = dayKey;
      q.daily = {};
      changed = true;
    }
    if (q.weekKey !== weekKey) {
      q.weekKey = weekKey;
      q.weekly = {};
      changed = true;
    }
  }

  // Инициализируем отсутствующие записи.
  // dailyLogin сразу помечаем выполненным — игрок уже зашёл.
  const qq = userData[userId].quests;
  for (const def of DAILY_QUESTS) {
    if (!qq.daily[def.id]) {
      qq.daily[def.id] = {
        progress: def.id === 'dailyLogin' ? 1 : 0,
        target: def.target,
        done: def.id === 'dailyLogin',
        claimed: false,
      };
      changed = true;
    }
  }
  for (const def of WEEKLY_QUESTS) {
    if (!qq.weekly[def.id]) {
      qq.weekly[def.id] = {
        progress: 0,
        target: def.target,
        done: false,
        claimed: false,
      };
      changed = true;
    }
  }
  return changed;
}

// Увеличивает прогресс квеста по событию.
// Событие — строковый идентификатор (например, 'winGame', 'playGame', 'monopoly', 'marketDeal').
// Ищет все активные квесты (daily + weekly), у которых event совпадает, и наращивает progress.
function markQuestProgress(userId, event) {
  if (!userData[userId] || !event) return;
  ensureQuestsFresh(userId);
  const qq = userData[userId].quests;
  let changed = false;

  const applyTo = (bucket, defs) => {
    for (const def of defs) {
      if (def.event !== event) continue;
      const it = bucket[def.id];
      if (!it || it.claimed) continue;
      if (it.done) continue;
      it.progress = Math.min((it.progress || 0) + 1, it.target);
      if (it.progress >= it.target) {
        it.done = true;
      }
      changed = true;
    }
  };

  applyTo(qq.daily, DAILY_QUESTS);
  applyTo(qq.weekly, WEEKLY_QUESTS);

  if (changed) {
    saveUserData(userId);
    const socketId = onlineUsers.get(userId);
    if (socketId) {
      io.to(socketId).emit('quests-updated', {
        dayKey: qq.dayKey,
        weekKey: qq.weekKey,
        daily: qq.daily,
        weekly: qq.weekly,
      });
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

    // Клиент просит актуальный список комнат (кнопка «Обновить список»).
    // Без этого обработчика запрос просто игнорировался.
    socket.on('get-rooms', () => {
      socket.emit('update-rooms', rooms);
    });

    socket.on('update-user-xp', (data) => {
  const { userId, xp, stats } = data;
  if (!userId || !userData[userId]) return;
  
  if (stats) {
    userData[userId].stats = stats;
  } else {
    userData[userId].stats.xp += xp;
  }
  
  // Пересчитываем уровень по прогрессивной шкале
  userData[userId].stats.level = getLevelFromXp(userData[userId].stats.xp);
  
  saveUserData(userId);
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
    createdAt: Date.now(),
    avatar: null,
};

 users.push(user);
  // Гостей НЕ сохраняем в файл — они существуют только в памяти пока онлайн
  if (!guest) {
    saveUsers();
  }

  // Инициализируем данные игрока по умолчанию
  userData[user.id] = { inventory: [], coins: 2400, stats: { games: 0, wins: 0, xp: 0, level: 0 }, friends: [], activeSkins: {}, vipUntil: null };
  saveUserData(user.id);
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
    userData[user.id] = { inventory: [], coins: 2400, stats: { games: 0, wins: 0, xp: 0, level: 0 }, friends: [], activeSkins: {}, vipUntil: null };
    saveUserData(user.id);
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
// ВАЖНО: клиент не имеет права менять inventory, coins, activeSkins, vipUntil,
// quests, friends, notifications — это серверные поля. Из newData берём только
// безопасные (статистику, минуты онлайн).
socket.on('save-user-data', (data, callback) => {
  const { userId, newData } = data;
  if (!userId || !newData || !userData[userId]) return;

  const CLIENT_WRITABLE = ['stats', 'minutesOnline'];
  for (const key of CLIENT_WRITABLE) {
    if (newData[key] !== undefined) {
      userData[userId][key] = newData[key];
    }
  }
  saveUserData(userId);
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

// Публичная часть инвентаря — для обменов.
// Отдаём только безопасные поля, без цен, служебных меток, дат владения.
socket.on('get-user-inventory-public', (targetUserId, callback) => {
  if (!targetUserId || !userData[targetUserId]) {
    return callback?.({ success: false, error: 'Игрок не найден' });
  }
  const safeItems = (userData[targetUserId].inventory || []).map((it) => ({
    id: it.id,
    name: it.name,
    imageDataUrl: it.imageDataUrl,
    slotIndex: it.slotIndex,
    rarity: it.rarity,
    type: it.type,
    marketItemId: it.marketItemId,
    cardWidth: it.cardWidth,
    cardHeight: it.cardHeight,
    imageHeight: it.imageHeight,
    shopScale: it.shopScale,
  }));
  callback?.({ success: true, inventory: safeItems });
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
  socket.on('admin-update-settings', async (newSettings) => {
    if (!newSettings || typeof newSettings !== 'object') return;
    adminSettings = newSettings;
    try {
      await db.query(
        `INSERT INTO admin_settings (id, data) VALUES (1, $1)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [JSON.stringify(adminSettings)]
      );
    } catch (err) {
      console.error('Ошибка сохранения настроек в БД:', err);
    }
    io.emit('admin-settings-updated', adminSettings);
    console.log('⚙️ Админ обновил настройки партии');
  });

  // Обработчик: админ меняет дизайны карточек
  socket.on('admin-update-card-designs', async (newDesigns) => {
    if (!Array.isArray(newDesigns)) return;
    cardDesigns = newDesigns;
    try {
      await db.query('DELETE FROM card_designs');
      for (const d of cardDesigns) {
        await db.query(
          'INSERT INTO card_designs (id, slot_index, data) VALUES ($1, $2, $3)',
          [d.id, Number(d.slotIndex) || 0, JSON.stringify(d)]
        );
      }
    } catch (err) {
      console.error('Ошибка сохранения дизайнов в БД:', err);
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
  socket.on('save-custom-items', async (newItems) => {
    if (!Array.isArray(newItems)) return;
    marketItems = newItems;
    try {
      // Только добавляем/обновляем. Удаление — отдельным событием.
      for (const it of marketItems) {
        await db.query(
          `INSERT INTO market_items (id, data) VALUES ($1, $2)
           ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
          [it.id, JSON.stringify(it)]
        );
      }
      // В памяти оставляем только то, что реально есть в БД
      const dbIdsRes = await db.query('SELECT id FROM market_items');
      const dbIds = new Set(dbIdsRes.rows.map(r => r.id));
      marketItems = marketItems.filter(i => dbIds.has(i.id));
    } catch (err) {
      console.error('Ошибка сохранения товаров в БД:', err);
    }
    io.emit('custom-items-updated', marketItems);
    console.log(`🛍  Админ обновил товары (${marketItems.length})`);
  });

  // Отдельное событие для явного удаления товара
  socket.on('delete-market-item', async ({ itemId }, callback) => {
    if (!itemId) return callback?.({ success: false, error: 'Нет itemId' });
    try {
      await db.query('DELETE FROM market_items WHERE id = $1', [itemId]);
      marketItems = marketItems.filter(i => i.id !== itemId);
      io.emit('custom-items-updated', marketItems);
      console.log(`🗑  Удалён товар ${itemId}`);
      callback?.({ success: true });
    } catch (err) {
      console.error('Ошибка удаления товара:', err);
      callback?.({ success: false, error: 'Ошибка сервера' });
    }
  });
  
  // ---- ПОКУПКА КАРТОЧКИ ИЗ МАГАЗИНА ----
  socket.on('shop-buy-card', async ({ userId, marketItemId }, callback) => {
    if (!userId || !marketItemId) return callback?.({ success: false, error: 'Некорректный запрос' });
    if (!userData[userId]) return callback?.({ success: false, error: 'Игрок не найден' });
    if (buyLocks.has(userId)) return callback?.({ success: false, error: 'Подождите, обрабатывается другая покупка' });
    buyLocks.add(userId);
    try {

    // Проверяем, что товар есть и активен
    const item = marketItems.find((m) => m.id === marketItemId && m.isActive !== false);
    if (!item || item.category !== 'card') {
      return callback?.({ success: false, error: 'Товар недоступен' });
    }

    // Слот, который заменяет карточка
    const slot = Number(item.slotIndex);

    // Списываем Coins через changeBalance
    const change = await changeBalance(userId, 'shop_buy', -item.price, {
      itemId: item.id,
      itemName: item.name,
      category: 'card',
    });
    if (!change.success) {
      return callback?.({ success: false, error: change.error });
    }

    // Добавляем предмет в инвентарь
    const ownedItem = {
      id: `${item.id}-${Date.now()}`,
      name: item.name,
      type: 'board',
      rarity: item.rarity,
      color: '#29233e',
      price: item.price,
      description: `Заменяет слот ${slot}`,
      ownedAt: new Date().toISOString(),
      slotIndex: slot,
      imageDataUrl: item.imageDataUrl,
      marketItemId: item.id,
      cardWidth: item.cardWidth,
      cardHeight: item.cardHeight,
      imageHeight: item.imageHeight,
      shopScale: item.shopScale,
    };
    if (!userData[userId].inventory) userData[userId].inventory = [];
    userData[userId].inventory.push(ownedItem);

    saveUserData(userId);

    console.log(`🛍  ${userId} купил карточку «${item.name}» за ${item.price} (баланс: ${change.newBalance})`);

    // Обновляем клиента
    const sId = onlineUsers.get(userId);
    if (sId) {
      io.to(sId).emit('user-data-updated', userData[userId]);
      io.to(sId).emit('user-inventory-updated', userData[userId].inventory);
    }

    callback?.({
      success: true,
      newBalance: change.newBalance,
      ownedItem,
      userData: userData[userId],
    });
    } finally {
      buyLocks.delete(userId);
    }
  });
  
  // ---- ПОКУПКА КЕЙСА ИЗ МАГАЗИНА ----
  socket.on('shop-buy-case', async ({ userId, caseId }, callback) => {
    if (!userId || !caseId) return callback?.({ success: false, error: 'Некорректный запрос' });
    if (!userData[userId]) return callback?.({ success: false, error: 'Игрок не найден' });
    if (buyLocks.has(userId)) return callback?.({ success: false, error: 'Подождите, обрабатывается другая покупка' });
    buyLocks.add(userId);
    try {

    // Ищем кейс в adminCases по id
    const caseData = adminCases.find((c) => c.id === caseId && c.isActive !== false);
    if (!caseData) return callback?.({ success: false, error: 'Кейс недоступен' });

    const price = Number(caseData.price) || 100;

    // Списываем Coins
    const change = await changeBalance(userId, 'shop_buy', -price, {
      itemId: caseData.id,
      itemName: caseData.name,
      category: 'case',
    });
    if (!change.success) {
      return callback?.({ success: false, error: change.error });
    }

    // Кладём кейс в инвентарь как предмет
    const caseItem = {
      id: `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: caseData.name,
      type: 'board',
      rarity: 'Кейс',
      color: caseData.color || '#29233e',
      price,
      description: caseData.desc || 'Кейс с предметами',
      ownedAt: new Date().toISOString(),
      imageDataUrl: caseData.imageDataUrl,
      cardWidth: caseData.cardWidth,
      cardHeight: caseData.cardHeight,
      imageHeight: caseData.imageHeight,
      shopScale: caseData.shopScale,
    };
    if (!userData[userId].inventory) userData[userId].inventory = [];
    userData[userId].inventory.push(caseItem);

    saveUserData(userId);

    console.log(`📦 ${userId} купил кейс «${caseData.name}» за ${price} (баланс: ${change.newBalance})`);

    const sId = onlineUsers.get(userId);
    if (sId) {
      io.to(sId).emit('user-data-updated', userData[userId]);
      io.to(sId).emit('user-inventory-updated', userData[userId].inventory);
    }

    callback?.({
      success: true,
      newBalance: change.newBalance,
      ownedItem: caseItem,
    });
    } finally {
      buyLocks.delete(userId);
    }
  });
  
  // ---- ПОКУПКА VIP-СТАТУСА ----
  socket.on('shop-buy-vip', async ({ userId, marketItemId }, callback) => {
    if (!userId || !marketItemId) return callback?.({ success: false, error: 'Некорректный запрос' });
    if (!userData[userId]) return callback?.({ success: false, error: 'Игрок не найден' });
    if (buyLocks.has(userId)) return callback?.({ success: false, error: 'Подождите, обрабатывается другая покупка' });
    buyLocks.add(userId);
    try {
      const item = marketItems.find((m) => m.id === marketItemId && m.isActive !== false);
      if (!item || item.category !== 'vip') {
        return callback?.({ success: false, error: 'VIP-товар недоступен' });
      }

      const days = Number(item.vipDuration) || 7;
      const price = Number(item.price) || 0;

      const change = await changeBalance(userId, 'shop_buy', -price, {
        itemId: item.id,
        itemName: item.name,
        category: 'vip',
        days,
      });
      if (!change.success) {
        return callback?.({ success: false, error: change.error });
      }

      // Продлеваем VIP: если уже активен — прибавляем к текущей дате
      const now = Date.now();
      const currentUntil = userData[userId].vipUntil ? new Date(userData[userId].vipUntil).getTime() : 0;
      const baseTime = currentUntil > now ? currentUntil : now;
      const vipEnd = new Date(baseTime + days * 24 * 60 * 60 * 1000);
      userData[userId].vipUntil = vipEnd.toISOString();

      saveUserData(userId);

      console.log(`👑 ${userId} купил VIP «${item.name}» на ${days} дн. за ${price} (до ${vipEnd.toISOString()})`);

      const sId = onlineUsers.get(userId);
      if (sId) {
        io.to(sId).emit('user-data-updated', userData[userId]);
      }

      callback?.({
        success: true,
        newBalance: change.newBalance,
        vipUntil: userData[userId].vipUntil,
      });
    } finally {
      buyLocks.delete(userId);
    }
  });
  
  // ---- ОТКРЫТИЕ КЕЙСА ИЗ ИНВЕНТАРЯ ----
  socket.on('open-case', async ({ userId, caseItemId }, callback) => {
    if (!userId || !caseItemId) return callback?.({ success: false, error: 'Некорректный запрос' });
    if (!userData[userId]) return callback?.({ success: false, error: 'Игрок не найден' });
    if (buyLocks.has(userId)) return callback?.({ success: false, error: 'Подождите, обрабатывается другая операция' });
    buyLocks.add(userId);
    try {
      const inv = userData[userId].inventory || [];
      const caseIdx = inv.findIndex((it) => it.id === caseItemId && it.rarity === 'Кейс');
      if (caseIdx === -1) return callback?.({ success: false, error: 'Кейс не найден в инвентаре' });

      const caseItem = inv[caseIdx];
      // Ищем кейс по имени (в adminCases id у кейса — timestamp, а у предмета — свой id)
      const caseData = adminCases.find((c) => c.name === caseItem.name && c.isActive !== false);
      if (!caseData) return callback?.({ success: false, error: 'Кейс недоступен' });

      // Ищем доступные предметы для дропа
      const availableItems = (caseData.items || [])
        .map((id) => marketItems.find((m) => m.id === id && m.isActive !== false))
        .filter(Boolean);
      if (availableItems.length === 0) {
        return callback?.({ success: false, error: 'В кейсе нет доступных предметов' });
      }

      // Рандомим дроп
      const drop = availableItems[Math.floor(Math.random() * availableItems.length)];

      let dropName = drop.name;
      let dropItem = null;

      if (drop.category === 'vip') {
        // VIP — продлеваем, в инвентарь не кладём
        const days = Number(drop.vipDuration) || 7;
        const now = Date.now();
        const currentUntil = userData[userId].vipUntil ? new Date(userData[userId].vipUntil).getTime() : 0;
        const baseTime = currentUntil > now ? currentUntil : now;
        const vipEnd = new Date(baseTime + days * 24 * 60 * 60 * 1000);
        userData[userId].vipUntil = vipEnd.toISOString();
        dropName = `${drop.name} (VIP +${days} дн.)`;
      } else {
        // Обычный предмет — в инвентарь
        dropItem = {
          id: `${drop.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: drop.name,
          type: drop.category === 'dice' ? 'dice' : 'board',
          rarity: drop.rarity,
          color: '#29233e',
          price: drop.price,
          description: drop.description || (drop.category === 'dice' ? 'Скин кубиков' : (drop.slotIndex !== undefined ? `Заменяет слот ${drop.slotIndex}` : 'Карточка поля')),
          ownedAt: new Date().toISOString(),
          slotIndex: drop.slotIndex,
          imageDataUrl: drop.imageDataUrl,
          marketItemId: drop.id,
          cardWidth: drop.cardWidth,
          cardHeight: drop.cardHeight,
          imageHeight: drop.imageHeight,
          shopScale: drop.shopScale,
        };
      }

      // Убираем кейс из инвентаря
      inv.splice(caseIdx, 1);
      // Добавляем дроп, если это не VIP
      if (dropItem) inv.push(dropItem);

      // Логируем дроп в transactions (без изменения баланса, amount = 0)
      await logTransaction(userId, 'case_drop', 0, {
        caseName: caseData.name,
        dropName: drop.name,
        dropCategory: drop.category,
      });

      saveUserData(userId);

      console.log(`🎁 ${userId} открыл кейс «${caseData.name}» → «${dropName}»`);

      const sId = onlineUsers.get(userId);
      if (sId) {
        io.to(sId).emit('user-data-updated', userData[userId]);
        io.to(sId).emit('user-inventory-updated', userData[userId].inventory);
      }

      callback?.({
        success: true,
        dropItem,
        dropName,
        userData: userData[userId],
      });
    } finally {
      buyLocks.delete(userId);
    }
  });

  
  // ============ ОБМЕНЫ (ТРЕЙДЫ) ============

  // Получить все мои активные обмены (отправленные + полученные)
  socket.on('get-trades', (userId, callback) => {
    if (!userId || !userData[userId]) return callback?.({ success: false });
    const myTrades = trades.filter(
      (t) => (t.fromUserId === userId || t.toUserId === userId) && t.status === 'pending'
    );
    const outgoing = myTrades.filter((t) => t.fromUserId === userId);
    const incoming = myTrades.filter((t) => t.toUserId === userId);
    callback?.({ success: true, outgoing, incoming });
  });

  // Создать предложение обмена
  socket.on('trade-create', async (payload, callback) => {
    const { fromUserId, toUserId, myItemIds, theirItemIds } = payload || {};
    if (!fromUserId || !toUserId || !Array.isArray(myItemIds) || !Array.isArray(theirItemIds)) {
      return callback?.({ success: false, error: 'Некорректный запрос' });
    }
    if (fromUserId === toUserId) return callback?.({ success: false, error: 'Нельзя обменяться с самим собой' });
    if (!userData[fromUserId] || !userData[toUserId]) {
      return callback?.({ success: false, error: 'Игрок не найден' });
    }
    if (myItemIds.length === 0 && theirItemIds.length === 0) {
      return callback?.({ success: false, error: 'Обмен пустой' });
    }
    if (myItemIds.length > 10 || theirItemIds.length > 10) {
      return callback?.({ success: false, error: 'Максимум 10 предметов с каждой стороны' });
    }

    const myInv = userData[fromUserId].inventory || [];
    const theirInv = userData[toUserId].inventory || [];

    const myItems = myItemIds.map((id) => myInv.find((it) => it.id === id)).filter(Boolean);
    const theirItems = theirItemIds.map((id) => theirInv.find((it) => it.id === id)).filter(Boolean);

    if (myItems.length !== myItemIds.length) {
      return callback?.({ success: false, error: 'Некоторые ваши предметы не найдены' });
    }
    if (theirItems.length !== theirItemIds.length) {
      return callback?.({ success: false, error: 'Некоторые предметы партнёра не найдены' });
    }

    // Проверяем, что все предметы можно обменять
    for (const it of myItems) {
      const err = canItemBeTraded(fromUserId, it);
      if (err) return callback?.({ success: false, error: `Ваш предмет «${it.name}»: ${err}` });
    }
    for (const it of theirItems) {
      const err = canItemBeTraded(toUserId, it);
      if (err) return callback?.({ success: false, error: `Предмет партнёра «${it.name}»: ${err}` });
    }

    // Проверяем, что у игроков нет других активных обменов с теми же предметами
    const tradeId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Блокируем предметы
    lockItemsForTrade(fromUserId, myItemIds, tradeId);
    lockItemsForTrade(toUserId, theirItemIds, tradeId);

    const trade = {
      id: tradeId,
      fromUserId,
      toUserId,
      fromItems: myItems.map((it) => ({ id: it.id, name: it.name, imageDataUrl: it.imageDataUrl, slotIndex: it.slotIndex, rarity: it.rarity })),
      toItems: theirItems.map((it) => ({ id: it.id, name: it.name, imageDataUrl: it.imageDataUrl, slotIndex: it.slotIndex, rarity: it.rarity })),
      status: 'pending',
      createdAt: Date.now(),
      resolvedAt: null,
    };

    // Сохраняем в БД (используем реальный id из БД)
    const dbId = await saveTradeToDb(trade);
    if (!dbId) {
      // Откатываем блокировку
      unlockItemsFromTrade(fromUserId, myItemIds);
      unlockItemsFromTrade(toUserId, theirItemIds);
      return callback?.({ success: false, error: 'Не удалось сохранить обмен' });
    }
    trade.id = dbId;
    // Обновляем lockedInTradeId на реальный id из БД
    lockItemsForTrade(fromUserId, myItemIds, dbId);
    lockItemsForTrade(toUserId, theirItemIds, dbId);
    trades.push(trade);

    saveUserData(fromUserId);
    saveUserData(toUserId);

    console.log(`🤝 ${fromUserId} → ${toUserId}: обмен #${dbId} (${myItems.length}/${theirItems.length})`);

    // Уведомляем обе стороны в реальном времени
    const fromSocket = onlineUsers.get(fromUserId);
    const toSocket = onlineUsers.get(toUserId);
    if (fromSocket) io.to(fromSocket).emit('trades-updated');
    if (toSocket) io.to(toSocket).emit('trades-updated');

    // Уведомление получателю о новом обмене
    const myItemsText = myItems.map((it) => it.name).join(", ") || "ничего";
    const theirItemsText = theirItems.map((it) => it.name).join(", ") || "ничего";
    await notifyUser(
      toUserId,
      `🤝 Новый обмен от ${userData[fromUserId].name}: вы отдаёте [${theirItemsText}], получаете [${myItemsText}].`
    );

    callback?.({ success: true, tradeId: dbId });
  });

  // Принять обмен (только получатель)
  socket.on('trade-accept', async ({ userId, tradeId }, callback) => {
    if (!userId || !tradeId) return callback?.({ success: false, error: 'Некорректный запрос' });
    const idx = trades.findIndex((t) => t.id === String(tradeId));
    if (idx === -1) return callback?.({ success: false, error: 'Обмен не найден' });
    const trade = trades[idx];
    if (trade.toUserId !== userId) return callback?.({ success: false, error: 'Нет прав' });
    if (trade.status !== 'pending') return callback?.({ success: false, error: 'Обмен уже неактуален' });

    const fromInv = userData[trade.fromUserId]?.inventory || [];
    const toInv = userData[trade.toUserId]?.inventory || [];

    // Проверяем, что все предметы на месте
    const fromItems = trade.fromItems.map((it) => fromInv.find((x) => x.id === it.id)).filter(Boolean);
    const toItems = trade.toItems.map((it) => toInv.find((x) => x.id === it.id)).filter(Boolean);
    if (fromItems.length !== trade.fromItems.length || toItems.length !== trade.toItems.length) {
      // Откатываем
      trades.splice(idx, 1);
      await updateTradeStatusInDb(trade.id, 'cancelled');
      unlockItemsFromTrade(trade.fromUserId, trade.fromItems.map((i) => i.id));
      unlockItemsFromTrade(trade.toUserId, trade.toItems.map((i) => i.id));
      saveUserData(trade.fromUserId);
      saveUserData(trade.toUserId);
      return callback?.({ success: false, error: 'Предметы уже не в инвентаре' });
    }

    const now = new Date().toISOString();

    // Убираем предметы из инвентарей
    userData[trade.fromUserId].inventory = fromInv.filter((it) => !trade.fromItems.some((x) => x.id === it.id));
    userData[trade.toUserId].inventory = toInv.filter((it) => !trade.toItems.some((x) => x.id === it.id));

    // Добавляем предметы другому игроку (с флагом tradedAt и снятой блокировкой)
    for (const it of toItems) {
      const copy = { ...it };
      delete copy.lockedInTradeId;
      copy.tradedAt = now;
      userData[trade.fromUserId].inventory.push(copy);
    }
    for (const it of fromItems) {
      const copy = { ...it };
      delete copy.lockedInTradeId;
      copy.tradedAt = now;
      userData[trade.toUserId].inventory.push(copy);
    }

    trade.status = 'accepted';
    trade.resolvedAt = Date.now();
    trades.splice(idx, 1);
    await updateTradeStatusInDb(trade.id, 'accepted');

    saveUserData(trade.fromUserId);
    saveUserData(trade.toUserId);

    console.log(`✅ Обмен #${trade.id} принят`);

    // Уведомление отправителю — обмен принят
    await notifyUser(
      trade.fromUserId,
      `✅ Обмен принят! Предметы переехали в ваш инвентарь.`
    );

    // Уведомляем обе стороны
    const fromSocket = onlineUsers.get(trade.fromUserId);
    const toSocket = onlineUsers.get(trade.toUserId);
    if (fromSocket) {
      io.to(fromSocket).emit('trades-updated');
      io.to(fromSocket).emit('user-data-updated', userData[trade.fromUserId]);
      io.to(fromSocket).emit('user-inventory-updated', userData[trade.fromUserId].inventory);
    }
    if (toSocket) {
      io.to(toSocket).emit('trades-updated');
      io.to(toSocket).emit('user-data-updated', userData[trade.toUserId]);
      io.to(toSocket).emit('user-inventory-updated', userData[trade.toUserId].inventory);
    }

    callback?.({ success: true });
  });

  // Отклонить обмен (только получатель)
  socket.on('trade-decline', async ({ userId, tradeId }, callback) => {
    if (!userId || !tradeId) return callback?.({ success: false, error: 'Некорректный запрос' });
    const idx = trades.findIndex((t) => t.id === String(tradeId));
    if (idx === -1) return callback?.({ success: false, error: 'Обмен не найден' });
    const trade = trades[idx];
    if (trade.toUserId !== userId) return callback?.({ success: false, error: 'Нет прав' });

    unlockItemsFromTrade(trade.fromUserId, trade.fromItems.map((i) => i.id));
    unlockItemsFromTrade(trade.toUserId, trade.toItems.map((i) => i.id));
    trade.status = 'declined';
    trade.resolvedAt = Date.now();
    trades.splice(idx, 1);
    await updateTradeStatusInDb(trade.id, 'declined');
    saveUserData(trade.fromUserId);
    saveUserData(trade.toUserId);

    console.log(`❌ Обмен #${trade.id} отклонён`);

    // Уведомление отправителю
    await notifyUser(
      trade.fromUserId,
      `❌ Обмен отклонён. Предметы разблокированы.`
    );

    const fromSocket = onlineUsers.get(trade.fromUserId);
    const toSocket = onlineUsers.get(trade.toUserId);
    if (fromSocket) io.to(fromSocket).emit('trades-updated');
    if (toSocket) io.to(toSocket).emit('trades-updated');

    callback?.({ success: true });
  });

  // Отменить обмен (только отправитель)
  socket.on('trade-cancel', async ({ userId, tradeId }, callback) => {
    if (!userId || !tradeId) return callback?.({ success: false, error: 'Некорректный запрос' });
    const idx = trades.findIndex((t) => t.id === String(tradeId));
    if (idx === -1) return callback?.({ success: false, error: 'Обмен не найден' });
    const trade = trades[idx];
    if (trade.fromUserId !== userId) return callback?.({ success: false, error: 'Нет прав' });

    unlockItemsFromTrade(trade.fromUserId, trade.fromItems.map((i) => i.id));
    unlockItemsFromTrade(trade.toUserId, trade.toItems.map((i) => i.id));
    trade.status = 'cancelled';
    trade.resolvedAt = Date.now();
    trades.splice(idx, 1);
    await updateTradeStatusInDb(trade.id, 'cancelled');
    saveUserData(trade.fromUserId);
    saveUserData(trade.toUserId);

    console.log(`🚫 Обмен #${trade.id} отменён`);

    // Уведомление получателю
    await notifyUser(
      trade.toUserId,
      `🚫 Отправитель отменил обмен.`
    );

    const fromSocket = onlineUsers.get(trade.fromUserId);
    const toSocket = onlineUsers.get(trade.toUserId);
    if (fromSocket) io.to(fromSocket).emit('trades-updated');
    if (toSocket) io.to(toSocket).emit('trades-updated');

    callback?.({ success: true });
  });
  
  // ============ КОШЕЛЁК (ИСТОРИЯ ТРАНЗАКЦИЙ) ============

  // UI-фильтры маппятся в SQL-условия по типу транзакции.
  const WALLET_FILTER_MAP = {
    all: null,
    rewards: ['quest_claim', 'game_reward'],
    shop: ['shop_buy'],
    market: ['market_buy', 'market_sell', 'market_buy_refund'],
    deposit: ['deposit'],
  };

  socket.on('get-transactions', ({ userId, filter = 'all', limit = 20, offset = 0 }, callback) => {
    if (!userId) return callback?.({ success: false, error: 'Нет userId' });
    (async () => {
      try {
        const params = [userId];
        let where = "user_id = $1 AND type != 'case_drop'"; // дропы — не в кошельке

        const typeList = WALLET_FILTER_MAP[filter];
        if (Array.isArray(typeList)) {
          params.push(typeList);
          where += ` AND type = ANY($${params.length})`;
        }

        const res = await db.query(
          `SELECT id, type, amount, metadata, created_at
           FROM transactions
           WHERE ${where}
           ORDER BY created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, Number(limit) || 20, Number(offset) || 0]
        );

        const countRes = await db.query(
          `SELECT COUNT(*) FROM transactions WHERE ${where}`,
          params
        );

        callback?.({
          success: true,
          transactions: res.rows.map((r) => ({
            id: String(r.id),
            type: r.type,
            amount: Number(r.amount),
            metadata: r.metadata || {},
            createdAt: new Date(r.created_at).getTime(),
          })),
          total: Number(countRes.rows[0].count),
        });
      } catch (err) {
        console.error('❌ Ошибка get-transactions:', err);
        callback?.({ success: false, error: 'Ошибка загрузки' });
      }
    })();
  });

  socket.on('get-wallet-summary', (userId, callback) => {
    if (!userId) return callback?.({ success: false });
    (async () => {
      try {
        const res = await db.query(
          `SELECT
             COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
             COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS expense
           FROM transactions
           WHERE user_id = $1
             AND type != 'case_drop'
             AND created_at > NOW() - INTERVAL '30 days'`,
          [userId]
        );
        callback?.({
          success: true,
          income: Number(res.rows[0].income),
          expense: Number(res.rows[0].expense),
        });
      } catch (err) {
        console.error('❌ Ошибка get-wallet-summary:', err);
        callback?.({ success: false });
      }
    })();
  });
  
  // ============ ИСТОРИЯ (ОБМЕНЫ + ДРОПЫ) ============

  // Завершённые обмены игрока. Отдаём последние 30.
  socket.on('get-trade-history', (userId, callback) => {
    if (!userId) return callback?.({ success: false });
    (async () => {
      try {
        const res = await db.query(
          `SELECT id, from_user_id, to_user_id, from_items, to_items, status, created_at, resolved_at
           FROM trades
           WHERE (from_user_id = $1 OR to_user_id = $1)
             AND status != 'pending'
           ORDER BY resolved_at DESC NULLS LAST
           LIMIT 30`,
          [userId]
        );
        callback?.({
          success: true,
          trades: res.rows.map((r) => ({
            id: String(r.id),
            fromUserId: r.from_user_id,
            toUserId: r.to_user_id,
            fromItems: r.from_items || [],
            toItems: r.to_items || [],
            status: r.status,
            createdAt: new Date(r.created_at).getTime(),
            resolvedAt: r.resolved_at ? new Date(r.resolved_at).getTime() : null,
          })),
        });
      } catch (err) {
        console.error('❌ Ошибка get-trade-history:', err);
        callback?.({ success: false });
      }
    })();
  });

  // Дропы из кейсов. Тянем из transactions (type = 'case_drop').
  // Отдаём последние 50.
  socket.on('get-case-drops', (userId, callback) => {
    if (!userId) return callback?.({ success: false });
    (async () => {
      try {
        const res = await db.query(
          `SELECT id, metadata, created_at
           FROM transactions
           WHERE user_id = $1 AND type = 'case_drop'
           ORDER BY created_at DESC
           LIMIT 50`,
          [userId]
        );
        callback?.({
          success: true,
          drops: res.rows.map((r) => ({
            id: String(r.id),
            caseName: r.metadata?.caseName || '?',
            dropName: r.metadata?.dropName || '?',
            dropCategory: r.metadata?.dropCategory || 'card',
            createdAt: new Date(r.created_at).getTime(),
          })),
        });
      } catch (err) {
        console.error('❌ Ошибка get-case-drops:', err);
        callback?.({ success: false });
      }
    })();
  });

  // --- РЫНОК / ОБЪЯВЛЕНИЯ ---
socket.on('get-market-listings', () => {
  socket.emit('market-listings', marketListings);
});

socket.on('add-market-listing', async (data, callback) => {
  if (!data || !data.item || !data.price || !data.sellerId) {
    return callback?.({ success: false, error: 'Некорректные данные' });
  }
  const sellerId = data.sellerId;
  if (!userData[sellerId]) return callback?.({ success: false, error: 'Продавец не найден' });

  // Ищем предмет в инвентаре продавца
  const inv = userData[sellerId].inventory || [];
  const idx = inv.findIndex((it) => it.id === data.item.id);
  if (idx === -1) {
    return callback?.({ success: false, error: 'Предмет не найден в инвентаре' });
  }

  // Проверяем блокировки
  const itemToSell = inv[idx];
  if (itemToSell.lockedInTradeId) {
    return callback?.({ success: false, error: 'Предмет участвует в активном обмене' });
  }
  if (itemToSell.tradedAt) {
    const elapsed = Date.now() - new Date(itemToSell.tradedAt).getTime();
    if (elapsed < 2 * 60 * 60 * 1000) {
      const minsLeft = Math.ceil((2 * 60 * 60 * 1000 - elapsed) / 60000);
      return callback?.({ success: false, error: `После обмена продажа недоступна ещё ${minsLeft} мин.` });
    }
  }

  // Проверяем лимит цены по редкости. Максимум — безлимит.
  const PRICE_MIN_BY_RARITY = {
    common: 25,
    rare: 150,
    epic: 500,
    legendary: 2000,
  };
  const rarityKey = String(itemToSell.rarity || 'common').toLowerCase();
  const minPrice = PRICE_MIN_BY_RARITY[rarityKey] || 1;
  const priceNum = Number(data.price);
  if (!Number.isFinite(priceNum) || priceNum < minPrice) {
    return callback?.({
      success: false,
      error: `Минимальная цена для «${itemToSell.rarity}» — ${minPrice} Coins`,
    });
  }

  // Удаляем из инвентаря в памяти (сервер — источник правды)
  inv.splice(idx, 1);
  saveUserData(sellerId);

  const newListing = {
    id: `listing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    item: data.item,
    seller: data.seller,
    sellerId,
    price: data.price,
    createdAt: Date.now()
  };
  marketListings.push(newListing);

  try {
    await db.query(
      `INSERT INTO market_listings (id, seller_id, item_data, price, created_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [newListing.id, newListing.sellerId, JSON.stringify(newListing.item), newListing.price, newListing.createdAt]
    );
  } catch (err) {
    console.error('Ошибка сохранения объявления в БД:', err);
  }

  // Обновляем инвентарь продавца на клиенте
  const sId = onlineUsers.get(sellerId);
  if (sId) {
    io.to(sId).emit('user-inventory-updated', inv);
    io.to(sId).emit('user-data-updated', userData[sellerId]);
  }

  io.emit('market-listings-updated', marketListings);
  console.log(`📦 ${sellerId} выставил на рынок «${data.item.name}» за ${data.price}`);
  if (callback) callback({ success: true, listing: newListing });
});

socket.on('remove-market-listing', async (data, callback) => {
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
    saveUserData(userId);
    const tSocket = onlineUsers.get(userId);
    if (tSocket) {
      io.to(tSocket).emit('user-inventory-updated', userData[userId].inventory);
      io.to(tSocket).emit('user-data-updated', userData[userId]);
    }
  }
  marketListings.splice(idx, 1);
  try {
    await db.query('DELETE FROM market_listings WHERE id = $1', [listingId]);
  } catch (err) {
    console.error('Ошибка удаления объявления из БД:', err);
  }
  io.emit('market-listings-updated', marketListings);
  if (callback) callback({ success: true, inventory: userData[userId]?.inventory || [] });
});

socket.on('buy-market-listing', async (data, callback) => {
  // data: { listingId, buyerId }
  const buyerId = data.buyerId;
  if (!buyerId) return callback?.({ success: false, error: 'Некорректный запрос' });

  // Защита от двойного клика / React StrictMode
  if (buyLocks.has(buyerId)) return callback?.({ success: false, error: 'Подождите, обрабатывается другая операция' });
  buyLocks.add(buyerId);

  try {
    const listing = marketListings.find(l => l.id === data.listingId);
    if (!listing) return callback?.({ success: false, error: 'Объявление не найдено' });
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

  // Комиссия платформы 10%. Продавец получает 90%, остальное сжигается.
  const COMMISSION = 0.10;
  const sellerPayout = Math.round(listing.price * (1 - COMMISSION));

  // Покупатель платит полную стоимость
  const buyResult = await changeBalance(buyerId, 'market_buy', -listing.price, {
    listingId: listing.id,
    itemName: listing.item?.name,
  });
  if (!buyResult.success) {
    return callback?.({ success: false, error: buyResult.error });
  }

  // Продавец получает 90%
  const sellResult = await changeBalance(sellerId, 'market_sell', sellerPayout, {
    listingId: listing.id,
    itemName: listing.item?.name,
    commission: listing.price - sellerPayout,
    grossPrice: listing.price,
  });
  if (!sellResult.success) {
    // Откатываем списание покупателя — редко, но возможно
    await changeBalance(buyerId, 'market_buy_refund', listing.price, {
      reason: 'seller_credit_failed',
      listingId: listing.id,
    });
    return callback?.({ success: false, error: sellResult.error });
  }

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
  saveUserData(buyerId);
  saveUserData(sellerId);

  // Удаляем объявление
  marketListings = marketListings.filter(l => l.id !== data.listingId);
  try {
    await db.query('DELETE FROM market_listings WHERE id = $1', [data.listingId]);
  } catch (err) {
    console.error('Ошибка удаления объявления из БД:', err);
  }
  io.emit('market-listings-updated', marketListings);

  // Уведомляем покупателя и продавца об обновлении данных и инвентаря
  if (onlineUsers.has(buyerId)) {
    io.to(onlineUsers.get(buyerId)).emit('user-data-updated', buyer);
    io.to(onlineUsers.get(buyerId)).emit('user-inventory-updated', buyer.inventory);
  }
  if (onlineUsers.has(sellerId)) {
    io.to(onlineUsers.get(sellerId)).emit('user-data-updated', seller);
    io.to(onlineUsers.get(sellerId)).emit('user-inventory-updated', seller.inventory);
  }

  // Уведомление продавцу — кто-то купил его предмет
  await notifyUser(
    sellerId,
    `💵 Ваш предмет «${listing.item?.name || "?"}» куплен за ${listing.price} Coins.`
  );

  // Квест «сделка на рынке» — обеим сторонам
  markQuestProgress(buyerId, 'marketDeal');
  markQuestProgress(sellerId, 'marketDeal');

  if (callback) callback({ success: true, item: listing.item });
  } finally {
    buyLocks.delete(buyerId);
  }
});

socket.on('admin-save-cases', async (newCases) => {
    if (!Array.isArray(newCases)) return;
    adminCases = newCases;
    try {
      // Полная замена: удаляем всё, вставляем заново.
      // Кейсов мало (единицы), это дёшево и безопасно.
      await db.query('DELETE FROM admin_cases');
      for (const c of adminCases) {
        await db.query(
          'INSERT INTO admin_cases (id, data) VALUES ($1, $2)',
          [c.id, JSON.stringify(c)]
        );
      }
    } catch (err) {
      console.error('Ошибка сохранения кейсов в БД:', err);
    }
    io.emit('admin-cases-updated', adminCases);
    console.log(`📦 Админ обновил кейсы (${adminCases.length})`);
});
socket.on('get-admin-cases', () => socket.emit('admin-cases-updated', adminCases));


  socket.on('game-chat-message', (data, callback) => {
    if (!data || !data.roomId || typeof data.text !== 'string' || !data.text.trim()) {
      return callback?.({ ok: false, error: 'invalid' });
    }
    if (!checkGameChatRate(socket.id)) {
      const rec = gameChatRate.get(socket.id);
      const until = rec ? rec.resetAt : (Date.now() + GAME_CHAT_WINDOW_MS);
      return callback?.({ ok: false, error: 'rate-limit', until });
    }
    const safe = {
      roomId: data.roomId,
      from: String(data.from || 'Игрок').slice(0, 40),
      text: String(data.text).trim().slice(0, 500),
      timestamp: data.timestamp || Date.now(),
    };
    io.to(data.roomId).emit('game-chat-message-broadcast', safe);
    callback?.({ ok: true });
  });

    // ============ ГОЛОСОВАНИЕ ЗА ИСКЛЮЧЕНИЕ ============
  // Клиент-инициатор шлёт vote-start. Сервер хранит голосование в room.vote,
  // рассылает vote-state всем, принимает vote-cast от каждого один раз.
  // По таймеру или когда проголосовали все — resolveVote, шлёт vote-resolved.
  // Само банкротство применяют клиенты через bankruptPlayer (чтобы ход
  // корректно перешёл к следующему). Сервер только сообщает результат.
  function resolveVote(roomId) {
    const room = gameRooms[roomId];
    if (!room || !room.vote) return;
    const vote = room.vote;
    delete room.vote;
    if (room.voteTimer) { clearTimeout(room.voteTimer); delete room.voteTimer; }

    const yes = Object.values(vote.votes).filter(v => v === 'yes').length;
    const total = Object.keys(vote.votes).length;
    const threshold = adminSettings.voteYesPercent || 50;
    const percent = total > 0 ? (yes / total) * 100 : 0;
    // Решение об исключении — строго больше порога.
    // При 50/50 (напр., 1 из 2 при 3 игроках) игрок остаётся.
    const kicked = percent > threshold;

    const target = room.find(p => p.id === vote.targetId);
    const targetName = target?.name || '?';
    console.log(`🗳 Голосование ${roomId}: ${yes}/${total} за кик ${targetName} → ${kicked ? 'ИСКЛЮЧЁН' : 'оставлен'}`);

    io.to(roomId).emit('vote-resolved', {
      targetId: vote.targetId,
      targetName,
      yes, total, kicked,
    });

    // После голосования клиенты сами сделают advanceTurn и пришлют
    // timer-start. Но на случай гонки — снимаем старый таймер,
    // чтобы он не «выстрелил» в момент перехода хода.
    clearTurnTimer(roomId);
  }

  socket.on('vote-start', ({ roomId, targetId, reason, duration }) => {
    if (!roomId || !gameRooms[roomId]) return;
    const room = gameRooms[roomId];
    if (room.vote) return; // уже идёт
    const target = room.find(p => p.id === targetId);
    if (!target || target.bankrupt) return;

    const dur = Math.max(5, Math.min(120, Number(duration) || 30));
    room.vote = {
      targetId,
      reason: reason || 'решение стола',
      votes: {},
      endsAt: Date.now() + dur * 1000,
    };
    io.to(roomId).emit('vote-state', {
      targetId,
      reason: room.vote.reason,
      votes: {},
      endsAt: room.vote.endsAt,
    });

    // Ход перекрыт голосованием — игровой таймер снимаем.
    // Новый запустится только после vote-resolved, когда ход перейдёт.
    clearTurnTimer(roomId);

    if (room.voteTimer) clearTimeout(room.voteTimer);
    room.voteTimer = setTimeout(() => resolveVote(roomId), dur * 1000);
    console.log(`🗳 Голосование ${roomId}: за кик ${target.name}, ${dur}с`);
  });

  socket.on('vote-cast', ({ roomId, voterId, value }) => {
    if (!roomId || !gameRooms[roomId]) return;
    const room = gameRooms[roomId];
    if (!room.vote) return;
    if (voterId === room.vote.targetId) return;
    if (room.vote.votes[voterId]) return;
    if (value !== 'yes' && value !== 'no') return;

    const voter = room.find(p => p.id === voterId);
    if (!voter || voter.bankrupt) return;

    room.vote.votes[voterId] = value;
    io.to(roomId).emit('vote-state', {
      targetId: room.vote.targetId,
      reason: room.vote.reason,
      votes: room.vote.votes,
      endsAt: room.vote.endsAt,
    });

    const aliveVoters = room.filter(p => !p.bankrupt && p.id !== room.vote.targetId);
    if (Object.keys(room.vote.votes).length >= aliveVoters.length) {
      if (room.voteTimer) clearTimeout(room.voteTimer);
      resolveVote(roomId);
    }
  });

  socket.on('sync-game-state', (data) => {
    // Сохраняем актуальное состояние игроков на сервере —
    // это нужно, чтобы при переподключении игрок получил свежие позиции,
    // а не те, что были при первом входе.
    if (data.roomId && Array.isArray(data.players) && gameRooms[data.roomId]) {
      const room = gameRooms[data.roomId];
      if (!Array.isArray(room.eliminationOrder)) room.eliminationOrder = [];

      data.players.forEach((p) => {
        if (!p || !p.id) return;
        const existing = room.find(x => x.id === p.id);
        if (existing) {
          const wasBankrupt = !!existing.bankrupt;
          const wasLeftAlive = !!existing.leftAlive;

          existing.position = p.position ?? existing.position;
          existing.money = p.money ?? existing.money;
          existing.bankrupt = p.bankrupt ?? existing.bankrupt;
          existing.leftAlive = p.leftAlive ?? existing.leftAlive;
          existing.jailTurns = p.jailTurns ?? existing.jailTurns;
          existing.jailAttempts = p.jailAttempts ?? existing.jailAttempts;

          // Детект нового выбывания: false → true
          if (!wasBankrupt && existing.bankrupt) {
            // leftAlive (вышел живым) не попадает в eliminationOrder — без награды
            if (existing.leftAlive) {
              console.log(`🚪 ${existing.name} вышел живым — без награды`);
            } else {
              if (!room.eliminationOrder.includes(p.id)) {
                room.eliminationOrder.push(p.id);
                console.log(`💀 ${existing.name} обанкротился — запись #${room.eliminationOrder.length} в порядке выбывания`);
              }
            }
          }
        }
      });

      // Может, партия уже закончилась?
      maybeFinalize(data.roomId);
    }
    socket.to(data.roomId).emit('update-remote-state', data);
  });

  socket.on('create-room', (roomData) => {
  const VALID_MODES = ["Классический", "Быстрая", "Дуэль"];
  const requestedMode = roomData.mode || "Классический";
  const mode = VALID_MODES.includes(requestedMode) ? requestedMode : "Классический";
  // Дуэль всегда 1×1, остальные — 2..5 игроков (значение приходит с клиента).
  const maxPlayers =
    mode === "Дуэль"
      ? 2
      : Math.min(5, Math.max(2, Number(roomData.maxPlayers) || 4));
  const newRoom = {
    ...roomData,
    mode,
    maxPlayers,
    id: Math.random().toString(36).slice(2, 7).toUpperCase(),
    players: 1,
    hostId: socket.id,
    playerNames: [roomData.host || "Гость"],
    playerSockets: { [socket.id]: roomData.host || "Гость" },
    createdAt: Date.now(),
    started: false,
    turnDurationSec: getTurnDuration(mode),
  };
    rooms.push(newRoom);
    roomMeta[newRoom.id] = { mode, maxPlayers };
    socket.emit('room-created', newRoom);
    socket.join(newRoom.id);
    io.emit('update-rooms', rooms);
    console.log(`Комната ${newRoom.name} создана. Всего комнат: ${rooms.length}`);
  });

    socket.on('join-room', ({ roomId, password, playerName }) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return socket.emit('join-error', 'Комната не найдена');
    if (room.password && room.password !== password) return socket.emit('join-error', 'Неверный пароль');
    // Если этот socket уже в комнате (повторный клик «Присоединиться»),
    // не увеличиваем счётчик — просто подтверждаем.
    if (room.playerSockets && room.playerSockets[socket.id]) {
      return socket.emit('joined-room', room);
    }
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
      room.started = true;
      io.to(roomId).emit('start-game', room);
      // Убираем лобби из общего списка — игра началась.
      rooms = rooms.filter(r => r.id !== roomId);
      io.emit('update-rooms', rooms);
      console.log(`Игра в комнате ${room.name} начинается!`);
    }
    console.log(`Игрок присоединился к ${room.name}. Игроков: ${room.players}/${room.maxPlayers}`);
  });

  // --- НОВЫЕ ОБРАБОТЧИКИ ДЛЯ ИГРОВОГО СТОЛА ---
        socket.on('enter-game-room', ({ roomId, playerData }) => {
    socket.join(roomId);
    if (!gameRooms[roomId]) {
      gameRooms[roomId] = [];
      // Мета-данные игровой сессии (не массив игроков, а объект рядом).
      gameRooms[roomId].eliminationOrder = [];
      gameRooms[roomId].finalized = false;
    }

    // Определяем режим и maxPlayers комнаты (сохраняем при первом заходе).
    // Лобби к этому моменту уже удалено из rooms — берём из roomMeta.
    if (!gameRooms[roomId].mode) {
      const meta = roomMeta[roomId];
      gameRooms[roomId].mode = meta?.mode || "Классический";
      gameRooms[roomId].maxPlayers = meta?.maxPlayers || 2;
    }
    const roomMode = gameRooms[roomId].mode;
    const fast = isFastMode(roomMode);

    // Отдаём клиенту настройки режима
    // Быстрая и Дуэль: аренда ×1.5, 1 попытка в тюрьме, бонусы Старта выше.
    socket.emit('room-settings', {
      mode: roomMode,
      maxPlayers: gameRooms[roomId].maxPlayers || 2,
      turnDurationSec: getTurnDuration(roomMode),
      fastMode: fast,
      rentMultiplier: fast ? 1.5 : 1.0,
      jailAttempts: fast ? 1 : 3,
      passStartBonus: fast ? 3000 : 2000,
      landStartBonus: fast ? 4500 : 3000,
    });

    // Сначала ищем игрока по УНИКАЛЬНОМУ id (не по socketId!) — это нужно для переподключения
    const existing = gameRooms[roomId].find(p => p.id === playerData.id);

    if (!existing) {
      // Новый игрок
      const colorIndex = gameRooms[roomId].length % PLAYER_COLORS.length;
      playerData.color = PLAYER_COLORS[colorIndex];
      playerData.activeSkins = playerData.activeSkins || {};
      playerData.isVip = playerData.isVip || false;
      playerData.disconnected = false;
      // Стартовый капитал по режиму: быстрые = 10 000, классика = из adminSettings
      playerData.money = fast ? 10000 : (adminSettings.startCapital || 15000);
      gameRooms[roomId].push({ ...playerData, socketId: socket.id });

      // Когда все игроки зашли — шафлим порядок, чтобы первый ход был
      // у случайного игрока, а не у того, чей сокет дошёл первым.
      if (
        !gameRooms[roomId].shuffled &&
        gameRooms[roomId].length === gameRooms[roomId].maxPlayers
      ) {
        const arr = gameRooms[roomId];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        gameRooms[roomId].shuffled = true;
        // Момент старта партии — для проверки минимальной длительности
        // при финализации (анти-фарм). Плюс обнуляем счётчики бросков.
        gameRooms[roomId].startedAt = Date.now();
        gameRooms[roomId].rollsByPlayer = {};
        const order = arr.map(p => p.name).join(' → ');
        console.log(`🎲 Комната ${roomId}: порядок хода — ${order}`);

        // Авто-старт таймера на первого игрока (у него turn=0).
        // Без этого партия начнётся, но никто не запустит отсчёт:
        // advanceTurn при старте не вызывается, pendingAction пусто,
        // клиент ждёт timer-start от сервера.
        const firstPlayer = arr[0];
        startTurnTimer(roomId, getTurnDuration(roomMode), firstPlayer.id);
        console.log(`⏱ Авто-старт таймера: ${firstPlayer.name}, ${getTurnDuration(roomMode)}с`);
      }
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

    // Если партия уже финализирована — отдаём этому игроку его награду
    // персонально, чтобы он не пропустил game-rewards пока был offline.
    const finalResults = gameRooms[roomId].finalResults;
    if (gameRooms[roomId].finalized && Array.isArray(finalResults)) {
      socket.emit('game-rewards', { roomId, results: finalResults });
    }

    // Отдаём переподключившемуся игроку актуальный остаток таймера.
    // Берём из серверного хранилища — там точный endsAt, а не расчёт от старта.
    const t = turnTimers.get(roomId);
    if (t) {
      const remaining = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
      socket.emit('timer-start', {
        roomId,
        endsAt: t.endsAt,
        durationSec: remaining,
        playerId: t.playerId,
      });
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

    // Анти-фарм: считаем броски каждого игрока за партию.
    // Используется в finalizeGame, чтобы отсеять «зашли-вышли-забрали».
    if (roomId && playerId && gameRooms[roomId]) {
      const room = gameRooms[roomId];
      if (!room.rollsByPlayer) room.rollsByPlayer = {};
      room.rollsByPlayer[playerId] = (room.rollsByPlayer[playerId] || 0) + 1;
    }

    io.to(roomId).emit('server-roll-result', { d1, d2, playerId });
  });

    socket.on('delete-room', (roomId) => {
    const roomIndex = rooms.findIndex(r => r.id === roomId);
    if (roomIndex === -1) return;
    rooms.splice(roomIndex, 1);
    io.emit('update-rooms', rooms);
    // Если в комнате кто-то был — выгоняем и её из игровых сессий.
    if (gameRooms[roomId]) {
      delete gameRooms[roomId];
      delete roomTurnStart[roomId];
      delete roomMeta[roomId];
      clearTurnTimer(roomId);
    }
    console.log(`Лобби ${roomId} удалено хостом`);
  });

  // Выход из лобби (до старта партии). Игрок сам решил уйти.
  socket.on('leave-room', ({ roomId }) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room || room.started) return;
    const name = room.playerSockets?.[socket.id];
    if (!name) return;
    delete room.playerSockets[socket.id];
    if (room.playerNames) {
      const idx = room.playerNames.indexOf(name);
      if (idx !== -1) room.playerNames.splice(idx, 1);
    }
    room.players = Math.max(0, room.players - 1);
    socket.leave(roomId);
    io.emit('update-rooms', rooms);
  });

  socket.on('chat-message', (msg, callback) => {
    if (!msg || typeof msg.text !== 'string' || !msg.text.trim()) {
      return callback?.({ ok: false, error: 'invalid' });
    }
    if (!checkChatMsgRate(socket.id)) {
      const rec = chatMsgRate.get(socket.id);
      const until = rec ? rec.resetAt : (Date.now() + CHAT_MSG_WINDOW_MS);
      return callback?.({ ok: false, error: 'rate-limit', until });
    }
    // Детект дублей — 3 одинаковых подряд → блок 30 секунд.
    const dup = checkChatDupes(socket.id, msg.text);
    if (!dup.ok) {
      return callback?.({
        ok: false,
        error: 'rate-limit',
        reason: 'duplicate',
        until: Date.now() + dup.blockMs,
      });
    }
    // Санитизация: обрезаем nickname и text, чтобы нельзя было
    // протащить гигантские строки и подделать формат.
    const safe = {
      nickname: String(msg.nickname || 'Гость клуба').slice(0, 40),
      text: String(msg.text).trim().slice(0, 500),
      timestamp: msg.timestamp || new Date().toISOString(),
    };
    io.emit('chat-message', safe);
    // Кладём в буфер истории. Обрезаем до последних 300.
    globalChatHistory.push(safe);
    if (globalChatHistory.length > GLOBAL_CHAT_HISTORY_MAX) {
      globalChatHistory.splice(
        0,
        globalChatHistory.length - GLOBAL_CHAT_HISTORY_MAX,
      );
    }
    callback?.({ ok: true });
  });

  // Клиент запрашивает последние 20 сообщений при заходе на главную
  // (после F5 или после переключения вкладок).
  socket.on('get-chat-history', () => {
    socket.emit(
      'chat-history',
      globalChatHistory.slice(-GLOBAL_CHAT_HISTORY_SEND),
    );
  });

  // Обработчик игрового лога (чтобы все видели действия друг друга)
  socket.on('game-log-add', (data) => {
    if (!data.roomId || !data.entry) return;
    // socket.to(roomId) отправляет всем в комнате, КРОМЕ отправителя (убирает дубли)
    socket.to(data.roomId).emit('game-log-add-broadcast', data.entry);
  });

  // Анимация испытания: активный игрок попал на клетку «Испытание»,
  // отдаём наблюдателям координаты {from, to} для огненного следа.
  socket.on('challenge-animation', (data) => {
    console.log('[challenge-anim] server got', data);
    if (!data || !data.roomId || !data.playerId) return;
    socket.to(data.roomId).emit('challenge-animation-broadcast', data);
    console.log('[challenge-anim] server broadcast to room', data.roomId);
  });

  // Анимация «В тюрьму»: диагональное перемещение от клетки 30 к клетке 10.
  // Наблюдатели воспроизводит ту же последовательность.
  socket.on('jail-animation', (data) => {
    if (!data || !data.roomId || !data.playerId) return;
    socket.to(data.roomId).emit('jail-animation-broadcast', data);
  });
  socket.on('trade-proposed', ({ roomId, initiatorId, trade }) => {
    socket.to(roomId).emit('trade-proposed-broadcast', { initiatorId, trade });
  });
    socket.on('trade-resolved', ({ roomId, initiatorId, restoreTurn, ownersDelta, moneyDelta }) => {
    socket.to(roomId).emit('trade-resolved-broadcast', {
      initiatorId,
      restoreTurn,
      ownersDelta,
      moneyDelta,
    });
  });
  // Клиент просит запустить таймер на новое ожидаемое действие.
  // Событие шлёт один клиент (тот, кто инициировал переход), сервер
  // рассылает абсолютное endsAt ВСЕМ, включая инициатора — так рассинхрон
  // в миллисекундах минимален.
  socket.on('timer-start', ({ roomId, durationSec, playerId }) => {
    if (!roomId || !gameRooms[roomId]) return;
    startTurnTimer(roomId, durationSec, playerId);
  });

  // Клиент просит поставить таймер на паузу (анимация броска, движение фишки).
  // Сервер отменяет setTimeout и рассылает timer-pause всем.
  socket.on('timer-pause', ({ roomId }) => {
    if (!roomId || !gameRooms[roomId]) return;
    pauseTurnTimer(roomId);
  });

  // Переподключившийся клиент запрашивает актуальный остаток.
  socket.on('get-current-timer', ({ roomId }, callback) => {
    const t = turnTimers.get(roomId);
    if (!t) return callback?.({ active: false });
    const remaining = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
    callback?.({ active: true, endsAt: t.endsAt, remaining, playerId: t.playerId });
  });

  socket.on('leave-game', async (data) => {
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
      // Финализируем — начислим награды победителю
      await maybeFinalize(roomId);
      io.to(roomId).emit('game-ended');
      // Убираем лобби из списка (если оно там ещё есть) и чистим игровую сессию.
      rooms = rooms.filter(r => r.id !== roomId);
      io.emit('update-rooms', rooms);
      setTimeout(() => {
        delete gameRooms[roomId];
        delete roomTurnStart[roomId];
        delete roomMeta[roomId];
        clearTurnTimer(roomId);
        console.log(`🗑 Комната ${roomId} удалена после завершения игры`);
      }, 8000);
    }
  });
  // ---- ЛИЧНЫЕ СООБЩЕНИЯ МЕЖДУ ДРУЗЬЯМИ ----
  // Отправитель: socket.emit('send-friend-message', {fromUserId, fromName, toUserId, text, timestamp})
  // Получатель: socket.on('friend-message-received', {fromId, fromName, text, timestamp})
  // Отправителю: socket.emit('friend-message-sent', {toId, timestamp}) — для возможного echo/лога
  socket.on('send-friend-message', (data, callback) => {
    if (!data || !data.fromUserId || !data.toUserId || !data.text) {
      return callback?.({ ok: false, error: 'invalid' });
    }
    // Валидация: сообщение должно идти от владельца этого сокета.
    const senderSocketId = onlineUsers.get(data.fromUserId);
    if (senderSocketId !== socket.id) {
      return callback?.({ ok: false, error: 'forbidden' });
    }
    // Rate limit — защита от спама. Клиент получит until и заблокирует
    // поле ввода до этой метки.
    if (!checkFriendMsgRate(data.fromUserId)) {
      const rec = friendMsgRate.get(data.fromUserId);
      const until = rec ? rec.resetAt : (Date.now() + FRIEND_MSG_WINDOW_MS);
      return callback?.({ ok: false, error: 'rate-limit', until });
    }
    // Проверяем, что это действительно друзья.
    const friends = userData[data.fromUserId]?.friends || [];
    if (!friends.includes(data.toUserId)) {
      return callback?.({ ok: false, error: 'not-friends' });
    }

    const payload = {
      fromId: data.fromUserId,
      fromName: data.fromName || "Игрок",
      text: String(data.text).slice(0, 2000),
      timestamp: Number(data.timestamp) || Date.now(),
    };

    const targetSocketId = onlineUsers.get(data.toUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend-message-received', payload);
    }
    // ACK отправителю — клиент добавит сообщение локально только при ok:true.
    callback?.({ ok: true });
  });

    // --- ДРУЗЬЯ ---
  socket.on('get-friends', (userId, callback) => {
    if (!userId || !userData[userId]) return callback?.({ success: false, error: 'User data not found' });
    const friendIds = userData[userId].friends || [];
    const friends = friendIds.map(fid => {
      const user = users.find(u => u.id === fid);
      return user ? { id: user.id, name: user.name, online: onlineUsers.has(fid), avatar: user.avatar || null } : null;
    }).filter(Boolean);
    callback?.({ success: true, friends });
  });

  socket.on('search-users', (query, callback) => {
    const q = (query || '').toLowerCase();
    const results = users
      .filter(u => !u.guest && (u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)))
      .slice(0, 10)
      .map(u => ({ id: u.id, name: u.name, online: onlineUsers.has(u.id), avatar: u.avatar || null }));
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
      saveUserData(userId);
      saveUserData(friendId);
      const initiator = users.find(u => u.id === userId);
      if (!userData[friendId].notifications) userData[friendId].notifications = [];
      userData[friendId].notifications.push({ text: `${initiator?.name || 'Игрок'} принял ваш запрос в друзья`, timestamp: Date.now(), read: false });
      saveUserData(friendId);
      const tSocket = onlineUsers.get(friendId);
      if (tSocket) io.to(tSocket).emit('new-notification', userData[friendId].notifications);
      // Обе стороны получают обновление
      const sSocket = onlineUsers.get(userId);
      if (tSocket) io.to(tSocket).emit('friend-requests-updated');
      if (tSocket) io.to(tSocket).emit('friends-updated');
      if (sSocket) io.to(sSocket).emit('friend-requests-updated');
      if (sSocket) io.to(sSocket).emit('friends-updated');
      return callback?.({ success: true, autoAccepted: true });
    }

    const initiator = users.find(u => u.id === userId);
    userData[friendId].friendRequests.push({ fromId: userId, fromName: initiator?.name || 'Игрок', timestamp: Date.now() });
    saveUserData(friendId);

    if (!userData[friendId].notifications) userData[friendId].notifications = [];
    userData[friendId].notifications.push({ text: `${initiator?.name || 'Игрок'} отправил вам запрос в друзья`, timestamp: Date.now(), read: false });
    saveUserData(friendId);
    const tSocket = onlineUsers.get(friendId);
    if (tSocket) {
      io.to(tSocket).emit('new-notification', userData[friendId].notifications);
      io.to(tSocket).emit('friend-requests-updated');
    }
    // Отправителю — чтобы у него в исходящих появилась новая заявка
    const sSocket = onlineUsers.get(userId);
    if (sSocket) io.to(sSocket).emit('friend-requests-updated');

    callback?.({ success: true });
  });

  socket.on('get-friend-requests', (userId, callback) => {
    if (!userId || !userData[userId]) return callback?.({ success: false, error: 'User not found' });
    // Входящие — те, что лежат у меня в friendRequests
    const requests = (userData[userId].friendRequests || []).map(r => {
      const fromUser = users.find(u => u.id === r.fromId);
      return { ...r, fromOnline: onlineUsers.has(r.fromId), fromAvatar: fromUser?.avatar || null };
    });

    // Исходящие — я лежу в friendRequests у других. Проходим по всем users.
    const outgoing = [];
    for (const other of users) {
      if (other.id === userId) continue;
      const reqs = userData[other.id]?.friendRequests || [];
      const mine = reqs.find(r => r.fromId === userId);
      if (mine) {
        outgoing.push({
          toId: other.id,
          toName: other.name,
          timestamp: mine.timestamp || Date.now(),
          toAvatar: other.avatar || null,
        });
      }
    }

    callback?.({ success: true, requests, outgoing });
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
    saveUserData(userId);
    saveUserData(fromId);

    const accepter = users.find(u => u.id === userId);
    if (!userData[fromId].notifications) userData[fromId].notifications = [];
    userData[fromId].notifications.push({ text: `${accepter?.name || 'Игрок'} принял ваш запрос в друзья`, timestamp: Date.now(), read: false });
    saveUserData(fromId);
    const tSocket = onlineUsers.get(fromId);
    const sSocket = onlineUsers.get(userId);
    if (tSocket) {
      io.to(tSocket).emit('new-notification', userData[fromId].notifications);
      io.to(tSocket).emit('friend-requests-updated');
      io.to(tSocket).emit('friends-updated');
    }
    if (sSocket) {
      io.to(sSocket).emit('friend-requests-updated');
      io.to(sSocket).emit('friends-updated');
    }

    callback?.({ success: true });
  });

  socket.on('decline-friend-request', ({ userId, fromId }, callback) => {
    if (!userId || !fromId || !userData[userId]) return callback?.({ success: false, error: 'Invalid request' });
    if (!userData[userId].friendRequests) userData[userId].friendRequests = [];
    userData[userId].friendRequests = userData[userId].friendRequests.filter(r => r.fromId !== fromId);
    saveUserData(userId);
    const tSocket = onlineUsers.get(fromId);
    const sSocket = onlineUsers.get(userId);
    if (tSocket) io.to(tSocket).emit('friend-requests-updated');
    if (sSocket) io.to(sSocket).emit('friend-requests-updated');
    callback?.({ success: true });
  });

  socket.on('remove-friend', async ({ userId, friendId }, callback) => {
    if (!userId || !friendId || !userData[userId]) return callback?.({ success: false, error: 'Invalid request' });

    // Удаляем друг у друга — взаимно
    userData[userId].friends = (userData[userId].friends || []).filter(fid => fid !== friendId);
    if (userData[friendId]) {
      userData[friendId].friends = (userData[friendId].friends || []).filter(fid => fid !== userId);
    }
    saveUserData(userId);
    saveUserData(friendId);

    const initiator = users.find(u => u.id === userId);
    if (userData[friendId]) {
      await notifyUser(friendId, `${initiator?.name || 'Игрок'} удалил вас из друзей`);
    }

    // Обе стороны обновляют список друзей в реальном времени
    const sSocket = onlineUsers.get(userId);
    const tSocket = onlineUsers.get(friendId);
    if (sSocket) io.to(sSocket).emit('friends-updated');
    if (tSocket) io.to(tSocket).emit('friends-updated');

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
    saveUserData(userId);
    const tSocket = onlineUsers.get(userId);
    if (tSocket) io.to(tSocket).emit('new-notification', userData[userId].notifications);
  });

  socket.on('clear-notifications', (userId) => {
    if (!userId || !userData[userId]) return;
    userData[userId].notifications = [];
    saveUserData(userId);
    const tSocket = onlineUsers.get(userId);
    if (tSocket) io.to(tSocket).emit('new-notification', []);
  });

    // ---- КВЕСТЫ (запрос списка) ----
  socket.on('get-quests', (userId, callback) => {
    if (!userId || !userData[userId]) return callback?.({ success: false });
    const changed = ensureQuestsFresh(userId);
    if (changed) saveUserData(userId);
    const q = userData[userId].quests;

    const mapBucket = (defs, bucket) =>
      defs.map((def) => {
        const it = bucket[def.id] || {};
        return {
          id: def.id,
          title: def.title,
          reward: def.reward,
          icon: def.icon,
          target: def.target,
          progress: Number(it.progress) || 0,
          done: !!it.done,
          claimed: !!it.claimed,
        };
      });

    callback?.({
      success: true,
      dayKey: q.dayKey,
      weekKey: q.weekKey,
      daily: mapBucket(DAILY_QUESTS, q.daily),
      weekly: mapBucket(WEEKLY_QUESTS, q.weekly),
    });
  });

  socket.on('claim-quest', async ({ userId, questId }, callback) => {
    if (!userId || !questId || !userData[userId]) return callback?.({ success: false });
    ensureQuestsFresh(userId);
    const q = userData[userId].quests;

    // Ищем в daily и weekly
    let item = q.daily[questId] || q.weekly[questId];
    if (!item || !item.done || item.claimed) {
      return callback?.({ success: false, error: 'Награда недоступна' });
    }
    const def = QUEST_DEFS.find((d) => d.id === questId);
    if (!def) return callback?.({ success: false, error: 'Квест не найден' });

    item.claimed = true;
    const change = await changeBalance(userId, 'quest_claim', def.reward, { questId });
    if (!change.success) {
      item.claimed = false;
      return callback?.({ success: false, error: change.error });
    }
    saveUserData(userId);
    console.log(`💰 ${userId} забрал ${def.reward} Coins за "${questId}" (баланс: ${change.newBalance})`);

    const sId = onlineUsers.get(userId);
    if (sId) {
      io.to(sId).emit('user-data-updated', userData[userId]);
      io.to(sId).emit('quests-updated', {
        dayKey: q.dayKey,
        weekKey: q.weekKey,
        daily: q.daily,
        weekly: q.weekly,
      });
    }
    if (callback) callback({ success: true, reward: def.reward, coins: userData[userId].coins });
  });

  // Клиент сообщает о событии для прогресса квестов.
  // event: 'playGame' | 'winGame' | 'buyProperty' | 'improveProperty' | 'monopoly' | 'marketDeal'
  socket.on('quest-event', ({ userId, event, questId }) => {
    if (!userId) return;
    // Поддержка старого формата (questId) для совместимости
    const ev = event || questId;
    if (!ev) return;
    markQuestProgress(userId, ev);
  });

      // Сохранение аватарки. Клиент сжимает картинку до 256×256 и присылает base64 PNG.
      // Ограничиваем размер строки — защита от гигантских данных.
      socket.on('update-avatar', ({ userId, avatar }, callback) => {
        if (!userId || !userData[userId]) return callback?.({ success: false, error: 'Игрок не найден' });
        const user = users.find(u => u.id === userId);
        if (!user) return callback?.({ success: false, error: 'Пользователь не найден' });
        if (avatar && typeof avatar === 'string' && avatar.length > 300000) {
          return callback?.({ success: false, error: 'Файл слишком большой' });
        }
        user.avatar = avatar || null;
        saveUsers();
        // Уведомляем друзей, чтобы обновили список с новой аватаркой
        const friends = userData[userId].friends || [];
        friends.forEach(fid => {
          const sId = onlineUsers.get(fid);
          if (sId) io.to(sId).emit('friends-updated');
        });
        // Обновляем игрока во всех игровых комнатах — чтобы аватарка
        // сразу обновилась и в списке игроков за столом.
        for (const roomId in gameRooms) {
          const player = gameRooms[roomId].find(p => p.id === userId);
          if (player) {
            player.avatar = avatar || null;
            io.to(roomId).emit('update-game-players', gameRooms[roomId]);
          }
        }
        // Обновляем самого игрока в текущей сессии
        const sId = onlineUsers.get(userId);
        if (sId) {
          io.to(sId).emit('user-data-updated', userData[userId]);
        }
        callback?.({ success: true });
      });

      socket.on('update-active-skins', ({ userId, activeSkins }) => {
    if (!userId || !userData[userId]) return;
    userData[userId].activeSkins = activeSkins;
    saveUserData(userId);
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

  socket.on('disconnect', async () => {
    console.log('Игрок отключился:', socket.id);

    // Чистим rate-limit записи этого сокета (общий чат, игровой, дубли).
    chatMsgRate.delete(socket.id);
    chatMsgHistory.delete(socket.id);
    gameChatRate.delete(socket.id);

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
        // Игрок отвалился и не вернулся — награды не получит.
        // leftAlive=true → finalizeGame не присвоит ему place.
        player.leftAlive = true;
        player.money = 0;
        player.socketId = null;
        player.disconnected = false;
        io.to(roomId).emit('update-game-players', room);
        io.to(roomId).emit('player-left', player.id);
        console.log(`⏰ ${player.name} не переподключился — авто-банкрот (без награды)`);

        // НЕ пишем в eliminationOrder: place этому игроку не присваивается.

        const remainingAlive = room.filter(x => !x.bankrupt).length;
        if (remainingAlive <= 1) {
          maybeFinalize(roomId);
          io.to(roomId).emit('game-ended');
          delete roomTurnStart[roomId];
          setTimeout(() => {
            delete gameRooms[roomId];
            delete roomMeta[roomId];
            clearTurnTimer(roomId);
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

// Загружаем users из БД. Если БД недоступна или пуста — fallback на JSON,
// который уже загружен выше. Сервер начинает слушать порт только
// после завершения загрузки, чтобы клиенты не пришли раньше данных.
(async () => {
  await loadAdminSettings();
  await loadAdminCases();
  await loadMarketItems();
  await loadCardDesigns();
  await loadMarketListings();
  await loadUserDataFromDb();
  await loadTrades();

  try {
    const res = await db.query('SELECT * FROM users ORDER BY created_at');
    if (res.rows.length > 0) {
      users = res.rows.map((r) => ({
        id: r.id,
        login: r.login,
        password: r.password,
        name: r.name,
        initials: r.initials,
        color: r.color,
        guest: r.guest,
        createdAt: Number(r.created_at),
        avatar: r.avatar || null,
      }));
      console.log(`✅ Пользователи загружены из БД: ${users.length}`);

      // Чистим userData от «сирот» — тех, кого нет в users.
      // Иначе saveUserData() без параметра падает на FK constraint.
      const validIds = new Set(users.map((u) => u.id));
      const orphans = Object.keys(userData).filter((id) => !validIds.has(id));
      if (orphans.length > 0) {
        orphans.forEach((id) => delete userData[id]);
        console.log(`🧹 Удалено «сирот» из userData: ${orphans.length}`);
      }
    } else {
      console.log('⚠️  БД пуста — используем JSON-данные');
    }
  } catch (err) {
    console.error('❌ Ошибка загрузки users из БД, использую JSON:', err.message);
  }

  server.listen(PORT, '0.0.0.0', () =>
    console.log('Сервер запущен на порту ' + PORT),
  );
})();