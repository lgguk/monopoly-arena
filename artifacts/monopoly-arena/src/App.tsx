import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowRight,
  Award,
  Banknote,
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  Coins,
  Crown,
  Dice5,
  DoorOpen,
  Download,
  Gift,
  Gavel,
  Hash,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Package,
  Palette,
  PanelLeft,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Swords,
  Timer,
  Trash2, // <--- ДОБАВЛЕНА ЭТА СТРОКА
  Trophy,
  Upload,
  UserRound,
  Users,
  WalletCards,
  X,
  Zap,
  Eye,
  EyeOff,
} from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { io } from 'socket.io-client';
import { Landing } from "./Landing";

const socket = io('https://api.monopoly-arena.ru', {
  transports: ['websocket', 'polling']
});

const queryClient = new QueryClient();

// 🔐 ПАРОЛЬ ДЛЯ ДОСТУПА К САЙТУ ВО ВРЕМЯ ТЕСТИРОВАНИЯ
// Измени это значение на свой пароль. После ввода пароля он сохранится
// в localStorage браузера, и модалка больше не будет появляться.
const SITE_ACCESS_PASSWORD = "Monopoly2026";

type Tab =
  | "dashboard"
  | "rooms"
  | "friends"
  | "shop"
  | "profile"
  | "inventory"
  | "market"
  | "admin";
type CellType =
  | "start"
  | "property"
  | "chance"
  | "tax"
  | "challenge"
  | "jail"
  | "gotojail"
  | "jackpot";
type BoardCell = {
  name: string;
  type: CellType;
  price?: number;
  rent?: number;
};
type Player = {
  id: string;
  name: string;
  initials: string;
  color: string;
  money: number;
  position: number;
  online?: boolean;
  bankrupt?: boolean;
  leftAlive?: boolean; // вышел живым — награду не получает
  jailTurns?: number;
  jailAttempts?: number;
  socketId?: string;
  activeSkins?: Record<number, string>;
  isVip?: boolean;
  vipUntil?: string;
  avatar?: string | null;
};
type ChatMessage = {
  from: string;
  text: string;
  time: string;
  timestamp?: number;
  recipient?: string;
};
type ItemType = "dice" | "token" | "board";
type GameItem = {
  id: string;
  name: string;
  type: ItemType;
  rarity: string;
  color: string;
  price: number;
  description: string;
  imageDataUrl?: string;
  slotIndex?: number;
  scale?: number;
};
type OwnedItem = GameItem & {
  ownedAt: string;
  slotIndex?: number;
  vipDuration?: number;
  marketItemId?: string;
  cardWidth?: number;
  cardHeight?: number;
  imageHeight?: number;
  shopScale?: number;
};
type Listing = {
  id: string;
  item: GameItem;
  seller: string;
  sellerId: string;
  price: number;
};
type TradeItemSnapshot = {
  id: string;
  name: string;
  imageDataUrl?: string;
  slotIndex?: number;
  rarity?: string;
};

type Trade = {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromItems: TradeItemSnapshot[];
  toItems: TradeItemSnapshot[];
  status: "pending" | "accepted" | "declined" | "cancelled";
  createdAt: number;
  resolvedAt?: number | null;
};
type AuthUser = {
  id: string;
  login?: string;
  password?: string;
  name: string;
  initials: string;
  color: string;
  guest?: boolean;
  vipUntil?: string; // дата окончания VIP (ISO)
  avatar?: string | null; // base64 PNG, загруженный игроком
};
type AdminSettings = {
  startCapital: number;
  passStart: number;
  rentPercent: number;
  thirdDieChance: number;
  voteDuration: number;
  voteYesPercent: number;
  adminPassword: string;
  taxAmount1: number;
  taxAmount2: number;
  jackpotBet1: number;
  jackpotWin1: number;
  jackpotBet2: number;
  jackpotWin2: number;
  jackpotBet3: number;
  jackpotWin3: number;
  startBonus: number;
};
type CardDesign = {
  id: string;
  slotIndex: number;
  name: string;
  type: CellType;
  price?: number;
  groupColor?: string;
  imageDataUrl?: string;
  scale?: number; // <--- ДОБАВИТЬ ЭТУ СТРОКУ
  rotation?: number;
};
type DiceDesign = {
  id: string;
  name: string;
  color: string;
  imageDataUrl?: string;
};

type MarketItemCategory = "card" | "dice" | "vip";
type MarketItemRarity = "common" | "rare" | "epic"; // белый, синий, фиолетовый

type MarketItem = {
  id: string;
  name: string;
  category: MarketItemCategory;
  slotIndex?: number;
  diceId?: string;
  vipDuration?: number;
  price: number;
  rarity: MarketItemRarity;
  imageDataUrl?: string;
  scale?: number;
  isActive: boolean;
  description?: string;
  bgColor?: string;
  // ---- Размеры карточки в магазине/инвентаре/рынке ----
  cardWidth?: number;        // ширина карточки, px (по умолчанию 185)
  cardHeight?: number;       // общая высота карточки, px (по умолчанию 200)
  imageHeight?: number;      // высота зоны картинки, px (по умолчанию 116)
  shopScale?: number;        // масштаб картинки в магазине, % (по умолчанию 90)
};

// Обновлённый тип кейса (без коллекций, вероятностей, с картинкой)
type CaseDesign = {
  id: string;
  name: string;
  items: string[];
  desc?: string;
  price?: number;
  color?: string;
  icon?: React.ElementType;
  imageDataUrl?: string;
  isActive?: boolean;
  cardWidth?: number;
  cardHeight?: number;
  imageHeight?: number;
  shopScale?: number;
};
type LobbyMode = "Классический" | "Быстрая" | "Дуэль";
type LobbyRoom = {
  id: string;
  name: string;
  host: string;
  hostId: string;
  players: number;
  maxPlayers: number;
  mode: LobbyMode;
  jackpot: boolean;
  teleport: boolean;
  password?: string;
  started?: boolean;
  createdAt?: number;
  playerNames?: string[];
};
type GlobalChatMessage = { nickname: string; text: string; timestamp: string };

const defaultSettings: AdminSettings = {
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

type PendingAction =
  | { type: "buy"; cellIndex: number; price: number }
  | {
      type: "rent";
      amount: number;
      ownerId: string;
      ownerName: string;
      cellIndex: number;
    }
  | { type: "tax"; amount: number }
  | { type: "chance"; amount: number; gain: boolean; desc: string }
  | { type: "challenge"; newPos: number; desc: string }
  | { type: "gotojail" }
  | { type: "jackpot"; amount: number }
  | {
      type: "jackpot-casino";
      jackpotTotal: number;
      secret: number;
      diceCount: number;
    };

type TradeState = {
  targetId: string;
  myMoney: number;
  myCards: number[];
  theirMoney: number;
  theirCards: number[];
};

type AuctionState = {
  cellIndex: number;
  price: number;
  participants: string[];
  currentIdx: number;
  highBidder: string | null;
};

const RENT_MULTIPLIERS = [1, 6, 12, 17, 27, 42];

// Таймер в аукционе — фиксированный 30 сек для всех режимов.
// Аукцион проходит быстрее, чем обычный ход, даже в классике.
const AUCTION_TIMER_SEC = 30;
// Короткий «динь» при наступлении хода. Web Audio API — без файлов,
// без интернета. Громкость 0.35 (35%), два тона (880 + 1320 Гц) с
// быстрым затуханием. AudioContext создаётся один раз и переиспользуется.
let audioCtxRef: AudioContext | null = null;
function playTurnSound() {
  try {
    if (!audioCtxRef) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      audioCtxRef = new Ctx();
    }
    const ctx = audioCtxRef;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const tones = [
      { freq: 880, start: 0, dur: 0.12 },
      { freq: 1320, start: 0.08, dur: 0.18 },
    ];
    tones.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.35, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });
  } catch {}
}


// Суммарные активы игрока: деньги + стоимость всех его полей +
// стоимость улучшений (по цене постройки). Используется в окне
// «не хватает средств», чтобы показать игроку % потери.
const getPlayerTotalAssets = (
  playerId: string,
  players: Player[],
  owners: Record<number, string>,
  improvements: Record<number, number>,
): number => {
  const p = players.find((x) => x.id === playerId);
  if (!p) return 0;
  let assets = p.money;
  Object.entries(owners).forEach(([ci, oid]) => {
    if (oid !== playerId) return;
    const cellIdx = Number(ci);
    assets += getCell(cellIdx).price ?? 0;
    const lvl = improvements[cellIdx] ?? 0;
    if (lvl > 0) assets += lvl * getImproveCost(cellIdx);
  });
  return assets;
};

// Награды по местам (1-е место максимальное, далее по убыванию).
// Coins низкие — основной доход игрока идёт с квестов (~500/нед).
// XP — прогресс уровня, не валюта. VIP: ×2 XP, +20% Coins.
const REWARDS_BY_PLACE: Record<number, { coins: number; xp: number }> = {
  1: { coins: 15, xp: 150 },
  2: { coins: 12, xp: 120 },
  3: { coins: 10, xp: 90 },
  4: { coins: 10, xp: 50 },
  5: { coins: 10, xp: 50 },
  6: { coins: 10, xp: 50 },
};
const IMPROVE_LABELS = [
  "",
  "Филиал ★",
  "Филиал ★★",
  "Филиал ★★★",
  "Филиал ★★★★",
  "Отель 🏨",
];

const roundTo10 = (val: number) => Math.round(val / 10) * 10;
// Прогрессивная шкала: порог перехода на уровень L = 1000 + 200·(L−1).
// L1=1000, L2=2200, L3=3600, L4=5200 …
const getLevelFromXP = (xp: number): number => {
  let level = 0;
  let remaining = Number(xp) || 0;
  while (level < 200) {
    const cost = 1000 + 200 * level;
    if (remaining < cost) break;
    remaining -= cost;
    level++;
  }
  return level;
};

// Отдаёт { level, totalXp, nextThreshold } — для прогресс-бара в Профиле.
// totalXp — общий накопленный XP игрока.
// nextThreshold — суммарный XP, который нужен, чтобы получить следующий уровень.
const getLevelInfo = (xp: number) => {
  const totalXp = Number(xp) || 0;
  let level = 0;
  let remaining = totalXp;
  while (level < 200) {
    const cost = 1000 + 200 * level;
    if (remaining < cost) break;
    remaining -= cost;
    level++;
  }
  // Суммарный порог до следующего уровня = сумма всех переходов 0..level
  let nextThreshold = 0;
  for (let i = 0; i <= level; i++) {
    nextThreshold += 1000 + 200 * i;
  }
  return { level, totalXp, nextThreshold };
};
// Глобальная переменная для актуальных дизайнов карточек (обновляется в компонентах)
let globalCardDesigns: CardDesign[] = [];


// Глобальная функция получения данных карточки с учётом дизайнов админа
const getCell = (index: number): BoardCell => {
  const design = globalCardDesigns.find((d) => d.slotIndex === index);
  if (design) {
    return {
      name: design.name ?? boardCells[index].name,
      type: design.type ?? boardCells[index].type,
      price: design.price ?? boardCells[index].price,
      rent: boardCells[index].rent,
    };
  }
  return boardCells[index];
};

const getMortgage = (cellIdx: number) => {
  const basePrice = getCell(cellIdx).price ?? 0;
  return roundTo10(basePrice * 0.5); // 50% от стоимости поля
};
const getRedeemCost = (cellIdx: number) => {
  const basePrice = getCell(cellIdx).price ?? 0;
  return roundTo10(basePrice * 0.6); // 60% от стоимости поля
};
const IMPROVEMENT_COSTS: Record<number, number> = {
  1: 500, 2: 500, 3: 500,
  5: 600, 6: 600, 8: 600, 9: 600,
  11: 700, 12: 700,
  13: 800, 14: 800,
  16: 900, 17: 900,
  18: 1000, 19: 1000,
  21: 1200, 23: 1200, 24: 1200,
  25: 1400, 26: 1400, 27: 1400,
  28: 1500, 29: 1500, // Добавили Nike и Adidas
  31: 1550, // Исправили Puma
  32: 1700, 33: 1700,
  35: 1750,
  37: 1900, 39: 1900
};

const getImproveCost = (cellIdx: number) => {
  return IMPROVEMENT_COSTS[cellIdx] ?? 0;
};
const getGroupIdx = (cellIdx: number) => {
  const design = globalCardDesigns.find((d) => d.slotIndex === cellIdx);
  if ((design?.type ?? "property") !== "property") return -1;
  return getDynamicGroups().findIndex((gr) => (gr.cells as readonly number[]).includes(cellIdx));
};

const CHANCE_EVENTS_DATA = [
  // Положительные
  { desc: "Игроку {name} одобрили налоговый вычет, он получает +800 К.", kind: "gain" as const, amount: 800 },
  { desc: "Игрок {name} получил наследство от дальнего родственника, +2 500 К.", kind: "gain" as const, amount: 2500 },
  { desc: "Стартап игрока {name} привлёк инвестиции, +3 000 К.", kind: "gain" as const, amount: 3000 },
  { desc: "Игроку {name} пришли дивиденды по акциям, +1 200 К.", kind: "gain" as const, amount: 1200 },
  { desc: "Игрок {name} удачно сыграл на бирже, +2 000 К.", kind: "gain" as const, amount: 2000 },
  { desc: "Благотворительный фонд выделил игроку {name} грант, +1 500 К.", kind: "gain" as const, amount: 1500 },
  { desc: "Игрок {name} выиграл в лотерею, +1 000 К.", kind: "gain" as const, amount: 1000 },
  { desc: "Игрок {name} заключил спонсорский контракт, +2 200 К.", kind: "gain" as const, amount: 2200 },
  // Отрицательные
  { desc: "Игрока {name} оштрафовали за нарушение экологических норм, −1 500 К.", kind: "lose" as const, amount: 1500 },
  { desc: "На производстве игрока {name} произошла авария, ремонт обошёлся в 1 200 К.", kind: "lose" as const, amount: 1200 },
  { desc: "Налоговая проверка выявила у игрока {name} недоимку, −2 000 К.", kind: "lose" as const, amount: 2000 },
  { desc: "Игрок {name} понёс судебные издержки, −800 К.", kind: "lose" as const, amount: 800 },
  { desc: "Инфляция съела часть сбережений игрока {name}, −500 К.", kind: "lose" as const, amount: 500 },
  { desc: "Со склада игрока {name} украли товар, −1 000 К.", kind: "lose" as const, amount: 1000 },
  { desc: "Игроку {name} начислили пени за просрочку кредита, −700 К.", kind: "lose" as const, amount: 700 },
  // Массовые
  { desc: "Все игроки скинулись игроку {name} на день рождения, он получает по 500 К с каждого.", kind: "birthday" as const, amount: 500 },
  { desc: "Игрок {name} устроил корпоратив и заплатил каждому игроку по 300 К.", kind: "pay_each" as const, amount: 300 },
  { desc: "Игрок {name} оплатил коммунальный сбор: по 500 К за каждый свой филиал/отель.", kind: "hotels" as const, amount: 500 },
  { desc: "Государство выделило субсидию: каждый игрок получает по 700 К.", kind: "mass_gain" as const, amount: 700 },
  { desc: "Экономический кризис: все игроки теряют по 1 000 К.", kind: "mass_lose" as const, amount: 1000 },
] as const;

const CHALLENGE_EVENTS_DATA = [
  { desc: "Игрок {name} совершил рывок вперёд на 3 поля.", steps: 3, forward: true },
  { desc: "Игрок {name} потерпел неудачу и откатился на 2 поля назад.", steps: 2, forward: false },
  { desc: "Игроку {name} подул попутный ветер, он перемещается на 5 полей вперёд.", steps: 5, forward: true },
  { desc: "Игрок {name} задержался в пути и откатился на 4 поля назад.", steps: 4, forward: false },
  { desc: "Игрок {name} взял скоростной старт и переместился на 6 полей вперёд.", steps: 6, forward: true },
  { desc: "Игрок {name} сделал крюк по городу и откатился на 3 поля назад.", steps: 3, forward: false },
  { desc: "Игрок {name} отправился в срочную командировку на 4 поля вперёд.", steps: 4, forward: true },
  { desc: "Игрок {name} попал в пробку и вернулся на 2 поля назад.", steps: 2, forward: false },
];

const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Главная", icon: LayoutDashboard },
  { id: "friends", label: "Друзья", icon: Users },
  { id: "shop", label: "Магазин", icon: ShoppingBag },
  { id: "profile", label: "Профиль", icon: UserRound },
  { id: "inventory", label: "Инвентарь", icon: Package },
  { id: "market", label: "Рынок", icon: Store },
  { id: "admin", label: "Админ-панель", icon: ShieldCheck },
];

const boardCells: BoardCell[] = [
  { name: "Старт", type: "start" }, // 0
  { name: "Apple", type: "property", price: 600, rent: 60 }, // 1
  { name: "Samsung", type: "property", price: 700, rent: 70 }, // 2
  { name: "Google", type: "property", price: 800, rent: 80 }, // 3
  { name: "Налог", type: "tax" }, // 4
  { name: "Toyota", type: "property", price: 900, rent: 90 }, // 5
  { name: "Volkswagen", type: "property", price: 1000, rent: 100 }, // 6
  { name: "Испытание", type: "challenge" }, // 7
  { name: "Ford", type: "property", price: 1100, rent: 110 }, // 8
  { name: "Marriott", type: "property", price: 1200, rent: 120 }, // 9
  { name: "Тюрьма", type: "jail" }, // 10
  { name: "Hilton", type: "property", price: 1300, rent: 130 }, // 11
  { name: "Hyatt", type: "property", price: 1400, rent: 140 }, // 12
  { name: "McDonald's", type: "property", price: 1500, rent: 150 }, // 13
  { name: "KFC", type: "property", price: 1600, rent: 160 }, // 14
  { name: "Шанс", type: "chance" }, // 15
  { name: "Burger King", type: "property", price: 1700, rent: 170 }, // 16
  { name: "Delta Air Lines", type: "property", price: 1800, rent: 180 }, // 17
  { name: "American Airlines", type: "property", price: 1900, rent: 190 }, // 18
  { name: "Emirates", type: "property", price: 2000, rent: 200 }, // 19
  { name: "Джекпот", type: "jackpot" }, // 20
  { name: "JPMorgan Chase", type: "property", price: 2100, rent: 210 }, // 21
  { name: "Шанс", type: "chance" }, // 22
  { name: "Bank of America", type: "property", price: 2200, rent: 220 }, // 23
  { name: "Goldman Sachs", type: "property", price: 2300, rent: 230 }, // 24
  { name: "Walmart", type: "property", price: 2400, rent: 240 }, // 25
  { name: "Amazon", type: "property", price: 2500, rent: 250 }, // 26
  { name: "Alibaba", type: "property", price: 2600, rent: 260 }, // 27
  { name: "Nike", type: "property", price: 2700, rent: 270 }, // 28
  { name: "Adidas", type: "property", price: 2800, rent: 280 }, // 29
  { name: "В тюрьму", type: "gotojail" }, // 30
  { name: "Puma", type: "property", price: 2900, rent: 290 }, // 31
  { name: "ExxonMobil", type: "property", price: 3000, rent: 300 }, // 32
  { name: "Shell", type: "property", price: 3100, rent: 310 }, // 33
  { name: "Шанс", type: "chance" }, // 34
  { name: "BP", type: "property", price: 3200, rent: 320 }, // 35
  { name: "Налог", type: "tax" }, // 36
  { name: "Pfizer", type: "property", price: 3300, rent: 330 }, // 37
  { name: "Johnson & Johnson", type: "property", price: 3400, rent: 340 }, // 38
  { name: "Moderna", type: "property", price: 3500, rent: 350 }, // 39
];
// Unicode-символы ⚀..⚅ — маркеры в тексте лога. На некоторых системах
// они рендерятся квадратиками, поэтому визуально их подменяет CSS-кубик.
const DICE_FACE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const DICE_FACE_INDEX: Record<string, number> = {
  "⚀": 1, "⚁": 2, "⚂": 3, "⚃": 4, "⚄": 5, "⚅": 6,
};
const diceFace = (v: number) => DICE_FACE[v] || "";

// Кубик с точками. Дизайн 1-в-1 с ThreeDDice (используется в анимации
// броска): белый фон, тонкая серая граница, чёрные точки, мягкая тень.
// Позиционирование точек абсолютное в процентах — симметрия сохраняется
// на любом размере (16.67% / 50% / 83.33% для 3 позиций по каждой оси).
function DiceFace({ value, size = 20 }: { value: number; size?: number }) {
  const patterns: Record<number, [number, number][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  };
  const dots = patterns[value] || [];

  const pad = Math.max(2, size * 0.14);
  const dotSize = Math.max(2.5, size * 0.17);
  const radius = Math.max(2, size * 0.14);
  const inner = size - pad * 2;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        background: "#ffffff",
        borderRadius: radius,
        border: "1px solid #d1d5db",
        boxShadow:
          "inset 0 1px 1px rgba(255,255,255,1), 0 1px 2px rgba(0,0,0,0.25)",
        verticalAlign: "middle",
        margin: "0 2px",
        flexShrink: 0,
      }}
    >
      <span style={{ position: "relative", width: inner, height: inner }}>
        {dots.map(([r, c], idx) => {
          const left = ((c + 0.5) / 3) * 100;
          const top = ((r + 0.5) / 3) * 100;
          return (
            <span
              key={idx}
              style={{
                position: "absolute",
                left: `${left}%`,
                top: `${top}%`,
                width: dotSize,
                height: dotSize,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: "#000000",
              }}
            />
          );
        })}
      </span>
    </span>
  );
}
// Logos & icons for board cells
const CELL_LOGOS: Record<number, string> = {
  1: "🍎",
  2: "📱",
  3: "🔍",
  5: "🚗",
  6: "🚙",
  8: "🛻",
  9: "🏨",
  11: "🌟",
  12: "💎",
  13: "🍔",
  14: "🍗",
  16: "👑",
  17: "✈️",
  18: "🛫",
  19: "🕌",
  21: "🏦",
  23: "💵",
  24: "📊",
  25: "🛒",
  26: "📦",
  27: "🔶",
  28: "✔️",
  29: "⚽",
  31: "🐆",
  32: "⛽",
  33: "🐚",
  35: "💧",
  37: "💊",
  38: "🩹",
  39: "💉",
};
const SPECIAL_ICONS: Partial<Record<CellType, string>> = {
  tax: "💸",
  chance: "🎲",
  challenge: "⚡",
  jail: "🔒",
  gotojail: "👮",
  jackpot: "🎰",
};

const GROUPS = [
  { name: "Технологии", color: "#2563eb", cells: [1, 2, 3] },
  { name: "Автопроизводители", color: "#7c2d12", cells: [5, 6, 8] },
  { name: "Отели", color: "#0369a1", cells: [9, 11, 12] },
  { name: "Быстрое питание", color: "#be185d", cells: [13, 14, 16] },
  { name: "Авиакомпании", color: "#c2410c", cells: [17, 18, 19] },
  { name: "Финансы/Банки", color: "#b91c1c", cells: [21, 23, 24] },
  { name: "Розничная торговля", color: "#a16207", cells: [25, 26, 27] },
  { name: "Спорт/Развлечения", color: "#15803d", cells: [28, 29, 31] },
  { name: "Топливно-энергетические", color: "#6d28d9", cells: [32, 33, 35] },
  { name: "Фармацевтика", color: "#4b5563", cells: [37, 38, 39] },
] as const;

// Динамические группы, которые учитывают измененные карточки (убираем поля не типа "property")
const getDynamicGroups = () =>
  GROUPS.map((group) => ({
    ...group,
    cells: (group.cells as readonly number[]).filter((idx) => {
      const design = globalCardDesigns.find((d) => d.slotIndex === idx);
      return (design?.type ?? "property") === "property";
    }),
  })).filter((group) => group.cells.length > 0);

const getCellGroup = (idx: number) => {  
const design = globalCardDesigns.find((d) => d.slotIndex === idx);
  if ((design?.type ?? "property") !== "property") return null;
  return getDynamicGroups().find((g) => (g.cells as readonly number[]).includes(idx)) ?? null;
};
const getCellDimensions = (slotIndex: number) => {
  const BOARD_REF = 600;
  const TOTAL_FR = 12.8;
  const C = Math.round((1.9 / TOTAL_FR) * BOARD_REF);
  const R = Math.round((1 / TOTAL_FR) * BOARD_REF);
  const isCorner = [0, 10, 20, 30].includes(slotIndex);
  const isTopBottom = (slotIndex >= 1 && slotIndex <= 9) || (slotIndex >= 21 && slotIndex <= 29);
  const isLeftRight = (slotIndex >= 11 && slotIndex <= 19) || (slotIndex >= 31 && slotIndex <= 39);
  let wPx = C, hPx = C;
  if (isTopBottom) { wPx = R; hPx = C; }
  if (isLeftRight) { wPx = C; hPx = R; }
  const PX_PER_MM = 3.7795;
  const wMm = Math.round((wPx / PX_PER_MM) * 10) / 10;
  const hMm = Math.round((hPx / PX_PER_MM) * 10) / 10;
  return { wPx, hPx, wMm, hMm, isCorner, isTopBottom, isLeftRight };
};

const cellBgColor = (type: CellType) => {
  const map: Record<CellType, string> = {
    start: "#ffffff",
    gotojail: "#ffffff",
    jail: "#ffffff",
    jackpot: "#ffffff",
    tax: "#ffffff",
    chance: "#ffffff",
    challenge: "#ffffff",
    property: "#fdfaf5",
  };
  return map[type] ?? "#fdfaf5";
};

const getSessionUserId = (): string | null => {
  try {
    const raw = localStorage.getItem("arena-session-user");
    if (!raw || raw === "null") return null;
    const u = JSON.parse(raw);
    return u && u.id ? u.id : null;
  } catch {
    return null;
  }
};
const getSessionUserName = (): string => {
  try {
    const raw = localStorage.getItem("arena-session-user");
    if (!raw || raw === "null") return "Игрок";
    const u = JSON.parse(raw);
    return u && u.name ? u.name : "Игрок";
  } catch {
    return "Игрок";
  }
};
const CARD_SIZE_DEFAULTS = {
  cardWidth: 185,
  cardHeight: 200,
  imageHeight: 116,
  shopScale: 90,
};
const findMarketItemForOwned = (ownedItem: any, marketItemsState?: any[]): any => {
  if (!ownedItem) return null;

  // Источник данных: state (если не пустой) + fallback на localStorage
  let items: any[] = [];
  if (Array.isArray(marketItemsState) && marketItemsState.length > 0) {
    items = marketItemsState;
  } else {
    try {
      const raw = localStorage.getItem("arena-market-items");
      items = raw ? JSON.parse(raw) : [];
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items) || items.length === 0) return null;

  // 1. По marketItemId
  if (ownedItem.marketItemId) {
    const m = items.find((x) => x.id === ownedItem.marketItemId);
    if (m) return m;
  }
  // 2. По slotIndex (для карточек поля)
  if (ownedItem.slotIndex !== undefined && ownedItem.slotIndex !== null) {
    const m = items.find(
      (x) => x.category === "card" && Number(x.slotIndex) === Number(ownedItem.slotIndex)
    );
    if (m) return m;
  }
  // 3. По имени
  const byName = items.find((x) => x.name === ownedItem.name);
  return byName ?? null;
};
const getCardSize = (item: any) => {
  return {
    cardWidth: item?.cardWidth ?? CARD_SIZE_DEFAULTS.cardWidth,
    cardHeight: item?.cardHeight ?? CARD_SIZE_DEFAULTS.cardHeight,
    imageHeight: item?.imageHeight ?? CARD_SIZE_DEFAULTS.imageHeight,
    shopScale: item?.shopScale ?? CARD_SIZE_DEFAULTS.shopScale,
  };
};

// 5 fixed, maximally-distinct player slot colors
const PLAYER_COLORS = [
  "#e63946",
  "#2ecc71",
  "#3a86ff",
  "#9b5de5",
  "#f77f00",
] as const;

// Brighten a hex color ~12–15% in saturation + lightness for owned-cell strips
function brightenHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255,
    g = parseInt(hex.slice(3, 5), 16) / 255,
    b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  s = Math.min(1, s * 1.15);
  l = Math.min(0.82, Math.max(l, 0.45) * 1.12);
  const h2r = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 0.5) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r2, g2, b2;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
      p = 2 * l - q;
    r2 = h2r(p, q, h + 1 / 3);
    g2 = h2r(p, q, h);
    b2 = h2r(p, q, h - 1 / 3);
  }
  const hx = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hx(r2)}${hx(g2)}${hx(b2)}`;
}

const initialPlayers: Player[] = [
  {
    id: "you",
    name: "Игрок",
    initials: "ИГ",
    color: PLAYER_COLORS[0],
    money: 15000,
    position: 0,
    jailTurns: 0,
    jailAttempts: 0,
  },
  ];



const shopSkins: GameItem[] = [
  {
    id: "silk-dice",
    name: "Шёлковые кости",
    description: "Кубики · легендарный",
    type: "dice",
    rarity: "Легендарный",
    price: 900,
    color: "#32786d",
  },
  {
    id: "red-cabrio",
    name: "Красный кабриолет",
    description: "Фишка · эпический",
    type: "token",
    rarity: "Эпический",
    price: 750,
    color: "#e96852",
  },
  {
    id: "neon-city",
    name: "Неоновая Косква",
    description: "Поле · редкий",
    type: "board",
    rarity: "Редкий",
    price: 1100,
    color: "#6b5b93",
  },
  {
    id: "gold-dice",
    name: "Золотой бросок",
    description: "Кубики · эпический",
    type: "dice",
    rarity: "Эпический",
    price: 1250,
    color: "#d3a247",
  },
  {
    id: "tram-token",
    name: "Синий трамвай",
    description: "Фишка · редкий",
    type: "token",
    rarity: "Редкий",
    price: 600,
    color: "#277c84",
  },
  {
    id: "parchment-city",
    name: "Петербургский фарфор",
    description: "Поле · легендарный",
    type: "board",
    rarity: "Легендарный",
    price: 1600,
    color: "#b45d61",
  },
];

const seedInventory: OwnedItem[] = [
  { ...shopSkins[1], id: "owned-red-cabrio", ownedAt: "2026-07-12" },
  { ...shopSkins[4], id: "owned-tram-token", ownedAt: "2026-07-18" },
];

const seedListings: Listing[] = [
  {
    id: "listing-1",
    item: shopSkins[0],
    seller: "Макс Волков",
    sellerId: "max",
    price: 620,
  },
  {
    id: "listing-2",
    item: shopSkins[2],
    seller: "Вика Рэй",
    sellerId: "vika",
    price: 780,
  },
  {
    id: "listing-3",
    item: shopSkins[3],
    seller: "Саша Лис",
    sellerId: "sasha",
    price: 950,
  },
];

// Универсальная функция сжатия картинки-файла до заданных размеров.
// Сначала PNG (сохраняет прозрачность). Если base64 больше maxBytes —
// переключается на JPEG 0.85. Для иконок/логотипов прозрачность обычно
// не критична, поэтому JPEG допустим. Используется во всех загрузках,
// кроме аватарки (там своя логика с кропом по центру).
// Проверка: есть ли в canvas прозрачные пиксели.
// Если есть — JPEG использовать нельзя, он зальёт их чёрным.
function canvasHasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    // Если canvas tainted (cross-origin) — считаем, что прозрачность может быть.
    return true;
  }
}

// Универсальная функция сжатия картинки-файла.
// Стратегия:
//  - если картинка содержит прозрачные пиксели — ТОЛЬКО PNG
//    (JPEG зальёт прозрачные места чёрным/белым, сломав скины на доске);
//  - если картинка полностью непрозрачная — PNG, а при превышении
//    maxBytes переключаемся на JPEG 0.85 (для фотографий это даёт
//    кратное уменьшение без потери качества).
async function compressImageFile(
  file: File,
  maxWidth: number,
  maxHeight: number,
  maxBytes = 150000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Не картинка"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas недоступен"));
        ctx.drawImage(img, 0, 0, width, height);
        const hasAlpha = canvasHasTransparency(ctx, width, height);
        let dataUrl = canvas.toDataURL("image/png");
        if (!hasAlpha && dataUrl.length > maxBytes) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}


// Сжатие base64-картинки (не файла). Используется для миграции
// уже загруженных в БД картинок. Логика та же, что в compressImageFile:
// PNG, если есть прозрачность; JPEG fallback, если непрозрачная и
// превышает maxBytes.
async function compressBase64Url(
  base64: string,
  maxWidth: number,
  maxHeight: number,
  maxBytes = 150000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Не картинка"));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
      if (height > maxHeight) { width = (width * maxHeight) / height; height = maxHeight; }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas недоступен"));
      ctx.drawImage(img, 0, 0, width, height);
      const hasAlpha = canvasHasTransparency(ctx, width, height);
      let dataUrl = canvas.toDataURL("image/png");
      if (!hasAlpha && dataUrl.length > maxBytes) {
        dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      }
      resolve(dataUrl);
    };
    img.src = base64;
  });
}

// Сжимает картинку-файл до квадрата 256×256, обрезая по центру.
// Возвращает base64 PNG. Используется для аватарок.
async function compressAvatar(file: File): Promise<string> {
  const MAX_INPUT = 5 * 1024 * 1024; // 5 МБ вход
  if (file.size > MAX_INPUT) throw new Error("Файл больше 5 МБ");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Не картинка"));
      img.onload = () => {
        const TARGET = 256;
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = TARGET;
        canvas.height = TARGET;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas недоступен"));
        ctx.drawImage(img, sx, sy, size, size, 0, 0, TARGET, TARGET);
        // PNG с прозрачностью, качество 0.85
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Вместо тихой ошибки, теперь Кы покажем её тебе
      console.error(`Ошибка сохранения (ключ: ${key}):`, error);
      alert(
        "❌ Ошибка сохранения в браузере! Скорее всего, переполнено хранилище localStorage. Попробуйте удалить ненужные дизайны или сжать картинки.",
      );
    }
  }, [key, value]);
    return [value, setValue] as const;
}

// Новый хук для синхронизации с сервером
function useServerSync<T>(
  key: string,
  initial: T,
  serverEvents: string[],
  requestEvent?: string
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (requestEvent) {
      socket.emit(requestEvent);
    }

    const handleServerUpdate = (newValue: T) => {
  // Защита: если сервер прислал null или undefined, игнорируем
  if (newValue === null || newValue === undefined) return;
  setValue(newValue);
  try {
    localStorage.setItem(key, JSON.stringify(newValue));
  } catch (error) {
    console.error(`Ошибка сохранения (ключ: ${key}):`, error);
  }
};

    serverEvents.forEach((event) => {
      socket.on(event, handleServerUpdate);
    });

    return () => {
      serverEvents.forEach((event) => {
        socket.off(event, handleServerUpdate);
      });
    };
  }, [key, serverEvents.join('|'), requestEvent]);

  const setValueAndSync = (newValue: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next =
        typeof newValue === 'function'
          ? (newValue as (prev: T) => T)(prev)
          : newValue;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch (error) {
        console.error(`Ошибка сохранения (ключ: ${key}):`, error);
      }
      return next;
    });
  };

  return [value, setValueAndSync] as const;
}

function makeAuthUser(
  name: string,
  login?: string,
  password?: string,
  guest = false,
): AuthUser {
  const cleanName = name.trim();
  const initials =
    cleanName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "ИГ";
  return {
    id: `${login || "guest"}-${cleanName.toLowerCase().replace(/\s+/g, "-")}`,
    login,
    password,
    name: cleanName,
    initials,
    color: guest ? "#32786d" : "#e96852",
    guest,
  };
}

function Avatar({
  initials,
  color,
  size = "md",
  avatar,
}: {
  initials: string;
  color: string;
  size?: "xs" | "sm" | "md" | "lg";
  avatar?: string | null;
}) {
  const sizes = {
    xs: "h-6 w-6 text-[11px] lg:h-8 lg:w-8 lg:text-[14px]",
    sm: "h-8 w-8 text-[14px]",
    md: "h-10 w-10 text-base",
    lg: "h-16 w-16 text-2xl",
  };
  const px = { xs: 24, sm: 32, md: 40, lg: 64 }[size];
  return (
    <div
      className={`${sizes[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white shadow-sm`}
      style={{ backgroundColor: avatar ? "transparent" : color }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt={initials}
          width={px}
          height={px}
          className="h-full w-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-primary">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        {detail && (
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "coral",
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  hint: string;
  tone?: "coral" | "teal" | "gold" | "plum";
}) {
  const tones = {
    coral: "bg-[#f7ddd6] text-[#bd503c]",
    teal: "bg-[#d6e6df] text-[#28695e]",
    gold: "bg-[#f3e7c8] text-[#99711f]",
    plum: "bg-[#e6dff0] text-[#5d4c83]",
  };
  return (
    <div className="lift rounded-2xl border border-card-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon size={17} />
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          + за неделю
        </span>
      </div>
      <div className="mt-4 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      <div className="mt-3 text-[11px] font-medium text-accent">{hint}</div>
    </div>
  );
}

function isVipActive(): boolean {
  const vipUntil = localStorage.getItem("arena-vip-until");
  if (!vipUntil) return false;
  return new Date(vipUntil) > new Date();
}

function Dashboard({
  onTab,
  onOpenFriendChat,
  onJoinGame,
  onRequestCreate,
  onRequestFind,
  createOpen,
  findOpen,
  onCloseCreate,
  onCloseFind,
  playerName,
  isAdmin = false,
  player,
  activeGame,
  onReconnectGame,
  onLeaveActiveGame,
}: {
  onTab: (tab: Tab) => void;
  onOpenFriendChat?: (friend: { id: string; name: string; online: boolean }) => void;
  onJoinGame: (roomId?: string) => void;
  onRequestCreate: () => void;
  onRequestFind: () => void;
  createOpen: boolean;
  findOpen: boolean;
  onCloseCreate: () => void;
  onCloseFind: () => void;
  playerName?: string;
  isAdmin?: boolean;
  player?: AuthUser | null;
  activeGame?: { roomId: string; roomName: string; disconnected: boolean } | null;
  onReconnectGame?: (roomId: string) => void;
  onLeaveActiveGame?: () => void;
}) {
    const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [chat, setChat] = useState<GlobalChatMessage[]>([]);
    const [friends, setFriends] = useState<{ id: string; name: string; online: boolean; avatar?: string | null }[]>([]);
  const [friendSearchResults, setFriendSearchResults] = useState<{ id: string; name: string; online: boolean; avatar?: string | null }[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [jailPaymentPending, setJailPaymentPending] = useState(false);
    type QuestItem = { id: string; title: string; reward: number; icon: string; done: boolean; claimed: boolean; progress: number; target: number };
  const [dailyQuests, setDailyQuests] = useState<QuestItem[]>([]);
  const [weeklyQuests, setWeeklyQuests] = useState<QuestItem[]>([]);
  const [questTab, setQuestTab] = useState<"daily" | "weekly">("daily");
  const [roomQuery, setRoomQuery] = useState("");
  const [roomMode, setRoomMode] = useState<"Все" | LobbyMode>("Все");
  const [friendQuery, setFriendQuery] = useState("");
  const [chatText, setChatText] = useState("");
  const [notice, setNotice] = useState("");
  const [joinTarget, setJoinTarget] = useState<LobbyRoom | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [createName, setCreateName] = useState("");
  const [createMode, setCreateMode] = useState<LobbyMode>("Классический");
  const [createPlayers, setCreatePlayers] = useState(4);
  const [createJackpot, setCreateJackpot] = useState(true);
  const [createTeleport, setCreateTeleport] = useState(true);
  const [createPassword, setCreatePassword] = useState("");
  const [findMode, setFindMode] = useState<"Все" | LobbyMode>("Все");
  const [findNotice, setFindNotice] = useState("");
  const [lobbyDeletedNotice, setLobbyDeletedNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LobbyRoom | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [userScrolled, setUserScrolled] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const joinLockRef = useRef(false);

        useEffect(() => {
    socket.emit('get-rooms');
    socket.on('update-rooms', (serverRooms: LobbyRoom[]) => { setRooms(serverRooms); });
    socket.on('chat-message', (msg: GlobalChatMessage) => {
  setChat(prev => [...prev, msg].slice(-200));
});
    
    // Обработчик запуска игры (теперь ВНУТРИ основного useEffect)
    socket.on('start-game', (roomData: LobbyRoom) => {
        console.log("Игра начинается для всех!", roomData);
        // Сохраняем maxPlayers ДО того, как BoardGame смонтируется.
        // Иначе заглушка «Ожидание игроков» покажет fallback 0/2,
        // пока не придёт room-settings от сервера.
        if (roomData?.maxPlayers) {
          try {
            localStorage.setItem("arena-lobby-maxPlayers", String(roomData.maxPlayers));
          } catch {}
        }
        onJoinGame(roomData.id);
    });

    // Очистка основного useEffect
    return () => {
        socket.off('update-rooms');
        socket.off('chat-message');
        socket.off('start-game');
    };
  }, [onJoinGame]);

    // Квесты (daily + weekly)
  useEffect(() => {
    if (!player?.id || player?.guest) return;

    const convertBucket = (bucket: any) => {
      if (!Array.isArray(bucket)) return [];
      return bucket.map((v: any) => ({
        id: v.id,
        title: v.title,
        reward: v.reward,
        icon: v.icon,
        done: !!v.done,
        claimed: !!v.claimed,
        progress: Number(v.progress) || 0,
        target: Number(v.target) || 1,
      }));
    };

    const fetchQuests = () => {
      socket.emit('get-quests', player.id, (res: any) => {
        if (!res?.success) return;
        setDailyQuests(convertBucket(res.daily));
        setWeeklyQuests(convertBucket(res.weekly));
      });
    };
    fetchQuests();

    const handleUpdate = (data: any) => {
      if (!data) return;
      if (Array.isArray(data.daily)) setDailyQuests(convertBucket(data.daily));
      if (Array.isArray(data.weekly)) setWeeklyQuests(convertBucket(data.weekly));
    };

    socket.on('quests-updated', handleUpdate);
    return () => {
      socket.off('quests-updated', handleUpdate);
    };
  }, [player?.id, player?.guest]);

  const claimQuest = (questId: string) => {
    if (!player?.id) return;
    socket.emit('claim-quest', { userId: player.id, questId }, (res: any) => {
      if (res?.success) {
        if (typeof res.coins === "number") {
          localStorage.setItem("arena-coins", String(res.coins));
          window.dispatchEvent(new Event("arena-wallet-updated"));
        }
        setNotice(`Получено ${res.reward} Coins!`);
        setTimeout(() => setNotice(""), 2500);
      } else {
        setNotice(res?.error || 'Не удалось получить награду');
        setTimeout(() => setNotice(""), 2500);
      }
    });
  };

    // НОВЫЙ ОТДЕЛЬНЫЙ useEffect для друзей (он остаётся снаружи)
  useEffect(() => {
    if (!player?.id || player?.guest) return;
    const reload = () => {
      socket.emit('get-friends', player.id, (response: any) => {
        if (response?.success) setFriends(response.friends);
      });
    };
    reload();
    // Реальное время: друг зашёл/вышел
    const handle = ({ userId, online }: { userId: string; online: boolean }) => {
      setFriends(prev => prev.map(f => f.id === userId ? { ...f, online } : f));
      setFriendSearchResults(prev => prev.map(f => f.id === userId ? { ...f, online } : f));
    };
    socket.on('friend-status-changed', handle);
    socket.on('friends-updated', reload);
    return () => {
      socket.off('friend-status-changed', handle);
      socket.off('friends-updated', reload);
    };
  }, [player?.id]);

  // Поиск игроков через сервер (работает, даже если своих друзей нет)
  useEffect(() => {
    if (!friendQuery.trim() || !player?.id || player?.guest) {
      setFriendSearchResults([]);
      return;
    }
    const timeoutId = setTimeout(() => {
      socket.emit('search-users', friendQuery, (response: any) => {
        if (response?.success) setFriendSearchResults(response.results);
      });
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [friendQuery, player?.id]);

  // 2.0 lobby timeout: remove rooms older than 3 min with only 1 player (not started)
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setRooms((old) => {
        const expired = old.filter(
          (r) =>
            !r.started &&
            r.players <= 1 &&
            r.createdAt &&
            now - r.createdAt > 3 * 60 * 1000,
        );
        if (expired.length > 0) {
          const myExpired = expired.find((r) => r.hostId === playerName);
          if (myExpired)
            setLobbyDeletedNotice(
              "Ваше лобби не собрало достаточное количество игроков и было удалено, вы Кожете создать новое.",
            );
          return old.filter((r) => !expired.includes(r));
        }
        return old;
      });
    }, 15000);
    return () => window.clearInterval(id);
  });

  const filteredRooms = rooms.filter((room) => {
    if (room.started) return false;
    if (room.players >= room.maxPlayers) return false;
    const textMatch = `${room.name} ${room.id} ${room.host}`
      .toLowerCase()
      .includes(roomQuery.toLowerCase());
    return textMatch && (roomMode === "Все" || room.mode === roomMode);
  });
    const filteredFriends = friends.filter((friend) =>
    `${friend.name} ${friend.id}`
      .toLowerCase()
      .includes(friendQuery.toLowerCase()),
  );
  const formatChatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });

  // Auto-dismiss lobby deleted notice after 15 seconds
  useEffect(() => {
    if (!lobbyDeletedNotice) return;
    const id = window.setTimeout(() => setLobbyDeletedNotice(""), 15000);
    return () => window.clearTimeout(id);
  }, [lobbyDeletedNotice]);
  const roomModeLabel = (mode: LobbyMode) =>
  mode === "Классический" ? "Классика" : mode;
  const roomFeatures = (room: LobbyRoom) =>
    [
      room.jackpot && "Джекпот",
      room.teleport && "Телепорт",
      room.password && "Пароль",
    ].filter(Boolean) as string[];

  useEffect(() => {
    if (createOpen) {
      setCreateName(
        (current) => current || `Комната ${playerName || "Игрока"}`,
      );
      setCreateMode("Классический");
      setCreatePlayers(4);
      setCreateJackpot(true);
      setCreateTeleport(true);
      setCreatePassword("");
    }
  }, [createOpen, playerName]);

      const createRoom = (event: FormEvent) => {
    event.preventDefault();
    const mode = createMode;
    const maxPlayers = mode === "Дуэль" ? 2 : Math.min(5, Math.max(2, createPlayers));
    const isVip = (() => {
  const vipUntil = localStorage.getItem("arena-vip-until");
  return vipUntil ? new Date(vipUntil) > new Date() : false;
})();

if (!isVip && (mode !== "Классический" || createPassword.trim() !== "")) {
  setNotice("❌ Без VIP-статуса доступны только классические комнаты (2–5 игроков) без пароля. Быстрая игра, Дуэль и пароли — для VIP.");
  return;
}    
    const roomData = {
      name: createName.trim() || `Комната ${playerName || "Игрока"}`,
      host: playerName || "Гость клуба",
      hostId: playerName || "guest",
      maxPlayers,
      mode,
      jackpot: createJackpot,
      teleport: createTeleport,
      password: createPassword.trim() || undefined,
    };
    
    console.log("🚀 Отправляем запрос на создание комнаты:", roomData);
    socket.emit('create-room', roomData);

    // Ожидаем ответа от сервера
        socket.once('room-created', (newRoom: LobbyRoom) => {
      console.log("✅ Сервер подтвердил создание комнаты:", newRoom);
      setNotice(`Комната «${newRoom.name}» создана. Код ${newRoom.id}`);
      onCloseCreate();
    });

    // Если сервер не ответил за 5 секунд, выдаём ошибку
    const timeout = setTimeout(() => {
      setNotice("❌ Ошибка: Сервер не ответил на запрос создания комнаты. Проверьте, запущен ли бэкенд.");
    }, 5000);

    // Очищаем таймаут, если ответ всё же придёт
    socket.once('room-created', () => {
      clearTimeout(timeout);
    });

    localStorage.setItem("arena-lobby-maxPlayers", String(maxPlayers));
  };
  
        const joinRoom = (room: LobbyRoom, password = "") => {
    if (joinLockRef.current) return;
    if (room.password && room.password !== password) {
      setNotice("Неверный пароль комнаты.");
      return;
    }
    joinLockRef.current = true;
    socket.emit('join-room', { roomId: room.id, password, playerName: playerName || "Гость" });
    socket.once('joined-room', (updatedRoom: LobbyRoom) => {
      joinLockRef.current = false;
      setRooms(prev => prev.map(r => r.id === updatedRoom.id ? updatedRoom : r));
      setJoinTarget(null);
      setJoinPassword("");
      // Игра начнётся по событию start-game от сервера, локально не запускаем!
      setNotice(
        `Ты присоединился к «${updatedRoom.name}». Ожидаем игроков... (${updatedRoom.players}/${updatedRoom.maxPlayers})`,
      );
    });
    // ВАЖНО: Внизу за функцией УБЕРИ дублирующийся setTimeout (оставь только этот!)
    setTimeout(() => { joinLockRef.current = false; }, 5000);
  };

  const findGame = (event: FormEvent) => {
    event.preventDefault();
    const available = rooms.find(
      (room) =>
        room.players < room.maxPlayers &&
        (findMode === "Все" || room.mode === findMode),
    );
    if (!available) {
      setFindNotice("Свободных комнат нет. Создайте свою!");
      return;
    }
    if (available.password) {
      onCloseFind();
      setJoinTarget(available);
      return;
    }
    joinRoom(available);
    onCloseFind();
  };

    const sendGlobalChat = (event: FormEvent) => {
    event.preventDefault();
    if (!chatText.trim()) return;
    socket.emit('chat-message', {
      nickname: playerName || "Гость клуба",
      text: chatText.trim(),
      timestamp: new Date().toISOString(),
    });
    setChatText("");
  };

    const refreshRooms = () => {
    socket.emit('get-rooms');
    setNotice("Обновляем список…");
    setTimeout(() => setNotice(""), 1500);
  };

  return (
    <div className="animate-rise">
      {/* Герой во всю ширину */}
      <div className="relative overflow-hidden rounded-[1.5rem] bg-[#29233e] p-5 text-[#f7f0e3] shadow-[0_14px_40px_rgba(41,35,62,.2)] md:p-7">
        <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border-[20px] border-[#e7ba68]/15" />
        <div className="absolute -bottom-20 right-24 h-56 w-56 rounded-full border border-[#e7ba68]/20" />
        <div className="relative z-10 max-w-lg">
          <div className="mb-3 flex items-center gap-2 text-[#e7ba68]">
            <Sparkles size={13} />
            <span className="font-mono text-[9px] uppercase tracking-[.22em]">
              вечерний клуб открыт
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold leading-[.95] md:text-4xl">
            Город сегодня
            <br />
            <span className="text-[#e96852]">твой.</span>
          </h1>
          <p className="mt-3 max-w-md text-xs leading-5 text-[#c8c1d0]">
            Собери своих, займи лучшие улицы и оставь историю, которую будут
            вспоминать до следующей партии.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={onRequestCreate}
              className="flex items-center gap-2 rounded-xl bg-[#e96852] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#d95c48]"
            >
              <Plus size={14} /> Начать партию
            </button>
            <button
              onClick={onRequestFind}
              className="rounded-xl border border-white/25 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10"
            >
              Найти комнату
            </button>
          </div>
        </div>
        <div className="absolute bottom-4 right-6 hidden rotate-12 items-center gap-2 md:flex">
          <div className="dice-face flex h-14 w-14 items-center justify-center rounded-xl bg-[#f4ead5] text-2xl font-bold text-[#29233e]">
            5
          </div>
          <div className="dice-face flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7ba68] text-xl font-bold text-[#29233e]">
            2
          </div>
        </div>
      </div>

      {/* Двухколоночный хаб: левый сайдбар 33% + правый список 67% */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(220px,.33fr)_minmax(0,.67fr)]">
        {/* Левая колонка */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-card-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold">Задания</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {questTab === "daily" ? "Обновляются каждую полночь (МСК)" : "Обновляются в ночь на понедельник (МСК)"}
                </p>
              </div>
              <Sparkles size={16} className="text-primary" />
            </div>

            {player?.guest ? (
              <div className="mt-4 rounded-xl border border-dashed border-card-border bg-muted px-4 py-6 text-center">
                <Coins size={24} className="mx-auto text-muted-foreground" />
                <div className="mt-2 text-xs font-bold">
                  Доступно только с аккаунтом
                </div>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  Зарегистрируйтесь, чтобы получать Coins за простые действия.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-4 flex gap-1 rounded-xl bg-muted p-1">
                  <button
                    onClick={() => setQuestTab("daily")}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${
                      questTab === "daily" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Ежедневные
                  </button>
                  <button
                    onClick={() => setQuestTab("weekly")}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${
                      questTab === "weekly" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Еженедельные
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {(questTab === "daily" ? dailyQuests : weeklyQuests).map((q) => {
                    const showProgress = q.target > 1;
                    return (
                      <div
                        key={q.id}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                          q.claimed
                            ? "border-accent/30 bg-[#dceae3]/50 opacity-60"
                            : q.done
                              ? "border-primary/40 bg-[#f6dfd7]"
                              : "border-border bg-muted"
                        }`}
                      >
                        <span className="shrink-0 text-base">{q.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-bold">
                            {q.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {q.claimed ? (
                              <span className="text-accent font-bold">✓ Получено</span>
                            ) : showProgress ? (
                              <>
                                {q.progress} / {q.target} · {" "}
                                <Coins size={10} className="mr-0.5 inline text-[#b18428]" />
                                {q.reward} Coins
                              </>
                            ) : (
                              <>
                                <Coins size={10} className="mr-0.5 inline text-[#b18428]" />
                                {q.reward} Coins
                              </>
                            )}
                          </div>
                          {showProgress && !q.claimed && (
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/10">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                        {q.done && !q.claimed && (
                          <button
                            onClick={() => claimQuest(q.id)}
                            className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-bold text-primary-foreground hover:brightness-95 transition-all"
                          >
                            Забрать
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {(questTab === "daily" ? dailyQuests : weeklyQuests).length === 0 && (
                    <div className="py-6 text-center text-[11px] text-muted-foreground">
                      Загрузка заданий…
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-card-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-primary" />
                <h2 className="font-display text-xl font-bold">Друзья</h2>
              </div>
              <button
                type="button"
                onClick={() => setFriendsOpen(v => !v)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted lg:hidden"
                aria-label={friendsOpen ? "Свернуть" : "Развернуть"}
              >
                <ChevronDown
                  size={18}
                  className={`transition-transform ${friendsOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
            <div className={`${friendsOpen ? "block" : "hidden"} lg:block`}>
            <div className="relative mt-4">
              <Search
                size={14}
                className="absolute left-3 top-3 text-muted-foreground"
              />
              <input
                value={friendQuery}
                onChange={(ev) => setFriendQuery(ev.target.value)}
                placeholder="Поиск по имени или ID"
                className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
                                    <div className="mt-3 space-y-1 max-h-[300px] overflow-y-auto pr-1">
              {(friendQuery.trim()
                ? friendSearchResults.filter(r => !friends.some(fr => fr.id === r.id))
                : friends
              ).slice(0, 10).map((f: { id: string; name: string; online: boolean; avatar?: string | null }) => {
                const initials = f.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map(part => part[0])
                  .join('')
                  .toUpperCase();
                const colorIndex = f.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % PLAYER_COLORS.length;
                const color = PLAYER_COLORS[colorIndex];
                const isSearchMode = friendQuery.trim().length > 0;

                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted"
                  >
                    <div className="relative shrink-0">
                      <Avatar initials={initials} color={color} size="sm" avatar={f.avatar} />
                      <span
                        className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card ${f.online ? "bg-accent" : "bg-muted-foreground/40"}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold">{f.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {f.online ? "В сети" : "Не в сети"}
                      </div>
                    </div>
                    {isSearchMode ? (
                      <button
                        onClick={() => {
                          if (!player?.id || player?.guest) return;
                          socket.emit('send-friend-request', { userId: player.id, friendId: f.id }, (res: any) => {
                            if (res?.success) {
                              setNotice("Запрос отправлен!");
                              socket.emit('get-friends', player.id, (r: any) => {
                                if (r?.success) setFriends(r.friends);
                              });
                            } else {
                              setNotice(res?.error || "Ошибка");
                            }
                            setTimeout(() => setNotice(""), 2500);
                          });
                        }}
                        className="shrink-0 rounded-lg bg-secondary px-2.5 py-1.5 text-[10px] font-bold text-secondary-foreground hover:brightness-95"
                        title="Добавить в друзья"
                      >
                        Добавить
                      </button>
                    ) : (
                      <button
                        onClick={() => onOpenFriendChat?.(f)}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        title="Открыть чат"
                      >
                        <MessageCircle size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
              {((friendQuery.trim()
                ? friendSearchResults.filter(r => !friends.some(fr => fr.id === r.id))
                : friends
              ).length === 0) && (
                <div className="py-4 text-center text-[11px] text-muted-foreground">
                  {friendQuery.trim() ? "Ничего не найдено" : "У вас пока нет друзей"}
                </div>
              )}
            </div>
            </div>
          </div>
          
          {/* === ПЕРЕНЕСЕННЫЙ ЧАТ === */}
<div className="rounded-2xl border border-card-border bg-card p-5">
  <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
    <div>
      <div className="flex items-center gap-2">
        <MessageCircle size={17} className="text-primary" />
        <h2 className="font-display text-xl font-bold">Чат</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Общий разговор для всех игроков на главной.
      </p>
    </div>
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-[#e96852] px-2.5 py-1 font-mono text-[10px] text-white">
        {chat.length} сообщений
      </span>
      <button
        type="button"
        onClick={() => setChatOpen(v => !v)}
        className="rounded-lg p-1 text-muted-foreground hover:bg-muted lg:hidden"
        aria-label={chatOpen ? "Свернуть" : "Развернуть"}
      >
        <ChevronDown
          size={18}
          className={`transition-transform ${chatOpen ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  </div>
  <div className={`${chatOpen ? "block" : "hidden"} lg:block`}>
    <div className="flex flex-col min-h-[250px] max-h-[360px] gap-2 overflow-x-hidden overflow-y-auto rounded-xl bg-[#f1eadc] p-3 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
    {chat.map((message, index) => (
      <div
        key={`${message.timestamp}-${index}`}
        className={`flex w-full items-start ${message.nickname === playerName ? "justify-end" : "justify-start"}`}
      >
        <div className="group relative max-w-[80%] break-words rounded-2xl bg-[#e96852] px-3.5 py-2.5 text-white">
          <div className="text-[11px] font-bold">{message.nickname}</div>
          <div className="mt-1 text-xs">{message.text}</div>
        </div>
      </div>
    ))}
  </div>
      <form
    onSubmit={sendGlobalChat}
    className="mt-3 flex items-end gap-2"
  >
    <textarea
      ref={textareaRef}
      rows={1}
      value={chatText}
      onChange={(event) => {
        setChatText(event.target.value);
        const target = event.target;
        target.style.height = "auto";
        target.style.height = target.scrollHeight + "px";
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          const form = event.currentTarget.closest("form");
          if (form)
            form.dispatchEvent(
              new Event("submit", {
                cancelable: true,
                bubbles: true,
              }),
            );
        }
      }}
      placeholder="Напиши что-нибудь..."
       className="min-w-0 flex-1 rounded-xl border border-input bg-[#f1eadc] px-3 py-2 text-base outline-none resize-none overflow-hidden placeholder:text-base focus:ring-2 focus:ring-primary/30 min-h-[44px] max-h-[120px]"
    />
    <button
      type="submit"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:brightness-95"
    >
      <Send size={17} />
    </button>
  </form>
  </div>
</div>
          {/* === КОНЕЦ ПЕРЕНЕСЕННОГО ЧАТА === */}
        </div>

        {/* Правая колонка — список комнат */}
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-primary">
                лобби арены
              </div>
              <h2 className="font-display text-3xl font-bold">Комнаты</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Выбери стол или создай свой.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[#dceae3] px-3 py-2 text-xs font-bold text-accent">
              <span className="h-2 w-2 rounded-full bg-accent" />
              {rooms.filter((r) => r.players < r.maxPlayers).length} столов
              открыто
            </div>
          </div>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 sm:flex-1">
              <Search
                size={15}
                className="absolute left-3 top-3 text-muted-foreground"
              />
              <input
                value={roomQuery}
                onChange={(ev) => setRoomQuery(ev.target.value)}
                placeholder="Поиск по нику или ID комнаты"
                className="w-full rounded-xl border border-input bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <select
                  value={roomMode}
                  onChange={(ev) =>
                    setRoomMode(ev.target.value as "Все" | LobbyMode)
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-input bg-card pl-3 pr-8 text-lg font-medium outline-none sm:text-sm"
                >
                  <option>Все</option>
                  <option>Классический</option>
                  <option>Быстрая</option>
                  <option>Дуэль</option>
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  style={{ marginTop: 0 }}
                />
              </div>
              <button
                onClick={refreshRooms}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-input bg-card hover:bg-muted"
                title="Обновить список комнат"
              >
                <RefreshCw size={15} />
              </button>
              <button
                onClick={onRequestCreate}
                className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground"
              >
                <Plus size={15} /> Создать
              </button>
            </div>
          </div>
          {notice && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-accent/25 bg-[#dceae3] px-4 py-3 text-xs font-medium text-accent">
              <Check size={15} />
              {notice}
              <button onClick={() => setNotice("")} className="ml-auto">
                <X size={14} />
              </button>
            </div>
          )}
          {lobbyDeletedNotice && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-[#f6dfd7] px-4 py-3 text-xs font-medium text-primary">
              <span>⏰</span>
              {lobbyDeletedNotice}
              <button
                onClick={() => setLobbyDeletedNotice("")}
                className="ml-auto"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {activeGame && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-primary/40 bg-[#f6dfd7] p-4">
              <div className="flex-1 min-w-[200px]">
                <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
                  Незавершённая партия
                </div>
                <div className="mt-1 font-display text-lg font-bold">
                  {activeGame.roomName}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Вы находитесь за столом. Переподключитесь, чтобы продолжить, или покиньте игру.
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onReconnectGame?.(activeGame.roomId)}
                  className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:brightness-95"
                >
                  Переподключиться
                </button>
                <button
                  onClick={() => onLeaveActiveGame?.()}
                  className="rounded-xl border border-input bg-card px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  Покинуть игру
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {filteredRooms.map((room, index) => (
              <div
                key={room.id}
                className="lift rounded-2xl border border-card-border bg-card p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${index % 2 ? "bg-[#e5def0] text-[#655384]" : "bg-[#f6dfd7] text-primary"}`}
                    >
                      <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-bold">{room.name}</h3>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {room.id}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Хозяин: {room.host}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`flex items-center gap-1 text-[11px] font-bold ${room.players < room.maxPlayers ? "text-accent" : "text-muted-foreground"}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${room.players < room.maxPlayers ? "bg-accent" : "bg-muted-foreground"}`}
                    />
                    {room.players < room.maxPlayers ? "Открыта" : "Заполнена"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users size={13} />
                      {room.players} / {room.maxPlayers}
                    </span>
                    <span className="rounded-md bg-muted px-2 py-1 font-bold">
                      {roomModeLabel(room.mode)}
                    </span>
                    {roomFeatures(room).map((feature) => (
                      <span
                        key={feature}
                        className="rounded-md bg-[#f3e7c8] px-2 py-1 text-[10px] font-bold text-[#87661d]"
                      >
                        {feature}
                      </span>
                    ))}
                    {(room.playerNames ?? []).map((name, nIdx) => (
                      <span
                        key={`${name}-${nIdx}`}
                        className="rounded-md bg-[#e5def0] px-2 py-1 text-[10px] font-bold text-[#655384]"
                        title="Игрок в лобби"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {(isAdmin || room.host === playerName) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(room);
                        }}
                        className="rounded-lg border border-primary/30 bg-[#f6dfd7] p-2 text-primary transition-colors hover:bg-[#efcec2]"
                        title={isAdmin ? "Удалить лобби (Админ)" : "Удалить моё лобби"}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    {room.host === playerName ? (
                      <span className="rounded-lg bg-muted px-4 py-2 text-xs font-bold text-muted-foreground">
                        Ваше лобби
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          room.password ? setJoinTarget(room) : joinRoom(room)
                        }
                        disabled={room.players >= room.maxPlayers}
                        className="rounded-lg bg-secondary px-4 py-2 text-xs font-bold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {room.players >= room.maxPlayers
                          ? "Нет мест"
                          : "Присоединиться"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
                       {filteredRooms.length === 0 && (
              <div className="rounded-2xl border border-dashed border-card-border bg-card p-12 text-center">
                <DoorOpen size={28} className="mx-auto text-muted-foreground" />
                <h3 className="mt-3 font-bold">Комнаты не найдены</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Измени фильтр или создай новый стол.
                </p>
                <button
                  onClick={refreshRooms}
                  className="mx-auto mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:brightness-95"
                >
                  <RefreshCw size={14} />
                  Обновить список
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#29233e]/60 px-4 pb-4 pt-16 backdrop-blur-sm sm:pt-20">
          <form
            onSubmit={createRoom}
            className="my-4 w-full max-w-lg rounded-2xl border border-card-border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">
                  новый стол
                </div>
                <h2 className="mt-1 font-display text-2xl font-bold">
                  Создать комнату
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Настрой правила и пригласи игроков.
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseCreate}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>
            <label className="mt-5 block text-xs font-bold">
              Название комнаты
              <input
                autoFocus
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
              />
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select
                value={createMode}
                onChange={(event) => {
                  const val = event.target.value as LobbyMode;
                  if (val !== "Классический" && !isVipActive()) {
                    setNotice("❌ Быстрая игра и Дуэль доступны только с VIP-статусом.");
                    setTimeout(() => setNotice(""), 10000);
                    return;
                  }
                  setCreateMode(val);
                  if (val === "Дуэль") setCreatePlayers(2);
                }}
                className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
              >
                <option>Классический</option>
                <option disabled={!isVipActive()}>
                  {isVipActive() ? "Быстрая" : "Быстрая (только VIP)"}
                </option>
                <option disabled={!isVipActive()}>
                  {isVipActive() ? "Дуэль" : "Дуэль (только VIP)"}
                </option>
              </select>
              <label className="text-xs font-bold">
                Количество игроков
                <select
                  value={createMode === "Дуэль" ? 2 : createPlayers}
                  onChange={(event) =>
                    setCreatePlayers(Number(event.target.value))
                  }
                  disabled={createMode === "Дуэль"}
                  className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal disabled:opacity-50"
                >
                  {createMode === "Дуэль" ? (
                    <option value={2}>2 игрока (1×1)</option>
                  ) : (
                    [2, 3, 4, 5].map((count) => (
                      <option key={count} value={count}>
                        {count} игрока
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
            <div className="mt-5">
              <div className="text-xs font-bold">Бонусы стола</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["jackpot", "Джекпот", createJackpot, setCreateJackpot],
                    ["teleport", "Телепорт", createTeleport, setCreateTeleport],
                  ] as [string, string, boolean, (v: boolean) => void][]
                ).map(([key, label, checked, setChecked]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 rounded-xl bg-muted p-3 text-xs font-bold"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => setChecked(event.target.checked)}
                      className="accent-[#e96852]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <label className="mt-4 block text-xs font-bold">
  Пароль{" "}
  <span className="font-normal text-muted-foreground">
    (опционально)
  </span>
  {!isVipActive() ? (
    <input
      type="password"
      value={createPassword}
      onChange={(event) => setCreatePassword(event.target.value)}
      placeholder="Доступно только VIP"
      disabled
      className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal opacity-50 cursor-not-allowed"
    />
  ) : (
    <input
      type="password"
      value={createPassword}
      onChange={(event) => setCreatePassword(event.target.value)}
      placeholder="Оставь пустым для открытой комнаты"
      className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
    />
  )}
</label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCloseCreate}
                className="rounded-xl border border-input px-4 py-2.5 text-xs font-bold"
              >
                Отмена
              </button>
              <button className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">
                Создать комнату
              </button>
            </div>
          </form>
        </div>
      )}
      {findOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#29233e]/60 px-4 pb-4 pt-16 backdrop-blur-sm sm:pt-20">
          <form
            onSubmit={findGame}
            className="my-4 w-full max-w-md rounded-2xl border border-card-border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">
                  быстрый подбор
                </div>
                <h2 className="mt-1 font-display text-2xl font-bold">
                  Найти игру
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Найдём первый свободный стол с подходящим режимом.
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseFind}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 space-y-2">
               {(["Все", "Классический", "Быстрая", "Дуэль"] as const).map((mode) => (
                <label
                  key={mode}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-bold ${findMode === mode ? "border-primary bg-[#f6dfd7]" : "border-input"}`}
                >
                  <input
                    type="radio"
                    name="find-mode"
                    checked={findMode === mode}
                    onChange={() => {
                      setFindMode(mode);
                      setFindNotice("");
                    }}
                    className="accent-[#e96852]"
                  />
                  {mode === "Все" ? "Любой режим" : mode}
                </label>
              ))}
            </div>
            {findNotice && (
              <div className="mt-4 rounded-xl bg-[#f6dfd7] px-3 py-2.5 text-xs font-medium text-primary">
                {findNotice}
                <button
                  type="button"
                  onClick={() => {
                    onCloseFind();
                    onRequestCreate();
                  }}
                  className="ml-1 underline"
                >
                  Создать свою
                </button>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCloseFind}
                className="rounded-xl border border-input px-4 py-2.5 text-xs font-bold"
              >
                Отмена
              </button>
              <button className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">
                Искать
              </button>
            </div>
          </form>
        </div>
      )}
      {joinTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#29233e]/60 px-4 pb-4 pt-16 backdrop-blur-sm sm:pt-20">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              joinRoom(joinTarget, joinPassword);
            }}
            className="my-4 w-full max-w-sm rounded-2xl border border-card-border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">
                  закрытый стол
                </div>
                <h2 className="mt-1 font-display text-2xl font-bold">
                  {joinTarget.name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Введи пароль, чтобы присоединиться.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setJoinTarget(null)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>
            <input
              autoFocus
              type="password"
              value={joinPassword}
              onChange={(event) => setJoinPassword(event.target.value)}
              placeholder="Пароль комнаты"
              className="mt-5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setJoinTarget(null)}
                className="rounded-xl border border-input px-4 py-2.5 text-xs font-bold"
              >
                Отмена
              </button>
              <button className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">
                Войти
              </button>
            </div>
          </form>
        </div>
      )}
            {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#29233e]/60 px-4 pb-4 pt-16 backdrop-blur-sm sm:pt-20">
          <div className="my-4 w-full max-w-sm rounded-2xl border border-card-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">
                  подтверждение
                </div>
                <h2 className="mt-1 font-display text-2xl font-bold">
                  Удалить лобби?
                </h2>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Комната <b className="text-foreground">«{deleteTarget.name}»</b> будет удалена. Игроки, которые ещё не присоединились, потеряют её из списка.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-input px-4 py-2.5 text-xs font-bold"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  socket.emit('delete-room', deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Rooms({
  onCreateRoom,
  onPlay,
  createSignal,
}: {
  onCreateRoom: () => void;
  onPlay: () => void;
  createSignal: number;
}) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("Все режимы");
  const [created, setCreated] = useState(false);
  const rooms = [
    {
      title: "Пятничный клуб",
      host: "Макс Волков",
      players: "3 / 4",
      mode: "Классика",
      locked: false,
      stakes: "Обычная игра",
    },
    {
      title: "Только свои",
       host: "Игрок",
      players: "2 / 4",
      mode: "2 × 2",
      locked: true,
      stakes: "Высокие ставки",
    },
    {
      title: "Большая Косква",
      host: "Илья Н.",
      players: "5 / 6",
      mode: "3 × 3",
      locked: false,
      stakes: "Турнирный стол",
    },
    {
      title: "После полуночи",
      host: "Саша Лис",
      players: "1 / 4",
      mode: "Классика",
      locked: true,
      stakes: "Обычная игра",
    },
  ];
  const visible = rooms.filter(
    (r) =>
      `${r.title} ${r.host}`.toLowerCase().includes(query.toLowerCase()) &&
      (mode === "Все режимы" || r.mode === mode),
  );
  useEffect(() => {
    if (createSignal > 0) setCreated(true);
  }, [createSignal]);
  return (
    <div className="animate-rise">
      <SectionHeading
        eyebrow="лобби"
        title="Комнаты"
        detail="Выбирай стол или собери свой за Кинуту."
        action={
          <button
            onClick={() => {
              setCreated(false);
              onCreateRoom();
            }}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Plus size={17} /> Создать комнату
          </button>
        }
      />
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search
            size={16}
            className="absolute left-3 top-3 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию или игроку"
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none"
        >
          <option>Все режимы</option>
          <option>Классика</option>
          <option>2 × 2</option>
        </select>
      </div>
      {created && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-accent/30 bg-[#dceae3] px-4 py-3 text-sm text-accent">
          <span>
            <b>Комната «Личный стол»</b> создана. Код:{" "}
            <span className="font-mono">MA-7K2P</span>
          </span>
          <button onClick={() => setCreated(false)}>
            <X size={16} />
          </button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.length ? (
          visible.map((room, index) => (
            <div
              key={room.title}
              className="lift rounded-2xl border border-card-border bg-card p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${index % 2 ? "bg-[#e5def0] text-[#655384]" : "bg-[#f6dfd7] text-primary"}`}
                  >
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold">{room.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Хозяин: {room.host}
                    </p>
                  </div>
                </div>
                {room.locked ? (
                  <LockKeyhole size={16} className="text-muted-foreground" />
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />{" "}
                    Открыта
                  </span>
                )}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <div className="flex gap-5 text-xs">
                  <span>
                    <Users
                      size={13}
                      className="mr-1 inline text-muted-foreground"
                    />
                    {room.players}
                  </span>
                  <span>
                    <Dice5
                      size={13}
                      className="mr-1 inline text-muted-foreground"
                    />
                    {room.mode}
                  </span>
                </div>
                <button
                  onClick={onPlay}
                  className="rounded-lg bg-secondary px-3.5 py-2 text-xs font-bold text-secondary-foreground hover:brightness-95"
                >
                  Присоединиться
                </button>
              </div>
              <div className="mt-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {room.stakes}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-2xl border border-dashed border-card-border bg-card py-14 text-center">
            <DoorOpen size={27} className="mx-auto text-muted-foreground" />
            <h3 className="mt-3 font-bold">Столы не найдены</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Попробуй другой запрос или создай свою комнату.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatPanel({
  targetFriend,
  onClose,
  currentUserName,
}: {
  targetFriend: { id: string; name: string; online: boolean };
  onClose: () => void;
  currentUserName: string;
}) {
    const storageKey = `arena-chat-${targetFriend.id}`;
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>(storageKey, []);

  // Автоочистка: удаляем сообщения старше 24 часов при открытии чата
  useEffect(() => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const fresh = messages.filter((m) => !m.timestamp || now - m.timestamp < DAY_MS);
    if (fresh.length !== messages.length) {
      setMessages(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetFriend.id]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
        setMessages([
      ...messages,
      {
        from: currentUserName,
        text: message.trim(),
        time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        timestamp: Date.now(),
        recipient: targetFriend.id,
      },
    ]);
    setMessage("");
  };

  return (
    <div className="flex min-h-[440px] flex-col rounded-2xl border border-card-border bg-card p-5">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <MessageCircle size={17} className="text-primary" />
          <div>
            <h2 className="font-display text-xl font-bold">Чат с {targetFriend.name}</h2>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {targetFriend.online ? "В сети" : "Не в сети"}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          title="Закрыть чат"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-auto py-5">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Нет сообщений. Напиши первым!
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={`${m.time}-${i}`}
            className={`flex ${m.from === currentUserName ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${m.from === currentUserName ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"}`}
            >
              <div>{m.text}</div>
              <div className={`mt-1 text-[9px] ${m.from === currentUserName ? "text-white/65" : "text-muted-foreground"}`}>
                {m.time}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-border pt-4">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Написать ${targetFriend.name}...`}
          className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:brightness-95"
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}

function Friends({ 
  player,
  pendingChatFriend,
  onPendingChatConsumed,
}: { 
  player?: AuthUser | null;
  pendingChatFriend?: { id: string; name: string; online: boolean } | null;
  onPendingChatConsumed?: () => void;
}) {
  const isGuest = player?.guest;
   const [friends, setFriends] = useState<{ id: string; name: string; online: boolean; avatar?: string | null }[]>([]);
  const [friendRequests, setFriendRequests] = useState<{ fromId: string; fromName: string; timestamp: number; fromOnline: boolean; fromAvatar?: string | null }[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<{ toId: string; toName: string; timestamp: number; toAvatar?: string | null }[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"friends" | "requests">("friends");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; online: boolean; avatar?: string | null }[]>([]);
  const [notice, setNotice] = useState("");
  const [chatFriend, setChatFriend] = useState<{ id: string; name: string; online: boolean } | null>(null);
  const userId = player?.id;
    // Автооткрытие чата, если перешли с главной страницы
  useEffect(() => {
    if (pendingChatFriend) {
      setChatFriend(pendingChatFriend);
      onPendingChatConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChatFriend]);

    useEffect(() => {
    if (!userId || isGuest) return;
    const reload = () => {
      socket.emit('get-friends', userId, (response: any) => {
        if (response?.success) setFriends(response.friends);
      });
      socket.emit('get-friend-requests', userId, (response: any) => {
        if (response?.success) {
          setFriendRequests(response.requests || []);
          setOutgoingRequests(response.outgoing || []);
        }
      });
    };
    reload();
    // Реальное время: друг зашёл/вышел
    const handle = ({ userId: changedId, online }: { userId: string; online: boolean }) => {
      setFriends(prev => prev.map(f => f.id === changedId ? { ...f, online } : f));
      setSearchResults(prev => prev.map(f => f.id === changedId ? { ...f, online } : f));
    };
    socket.on('friend-status-changed', handle);
    // Точечные события для друзей
    socket.on('friend-requests-updated', reload);
    socket.on('friends-updated', reload);
    return () => {
      socket.off('friend-status-changed', handle);
      socket.off('friend-requests-updated', reload);
      socket.off('friends-updated', reload);
    };
  }, [userId, isGuest]);

  const handleSearch = (query: string) => {
    setSearch(query);
    if (query.length < 1 || isGuest) return;
    socket.emit('search-users', query, (response: any) => {
      if (response?.success) setSearchResults(response.results);
    });
  };

    const addFriend = (friendId: string) => {
    if (!userId || isGuest) return;
    socket.emit('send-friend-request', { userId, friendId }, (response: any) => {
      if (response?.success) {
        setNotice(response.autoAccepted ? "Взаимный запрос — вы теперь друзья!" : "Запрос в друзья отправлен!");
        socket.emit('get-friends', userId, (res: any) => {
          if (res?.success) setFriends(res.friends);
        });
      } else {
        setNotice(response?.error || "Ошибка");
      }
      setTimeout(() => setNotice(""), 3000);
    });
  };

  const acceptRequest = (fromId: string) => {
    if (!userId || isGuest) return;
    socket.emit('accept-friend-request', { userId, fromId }, (response: any) => {
      if (response?.success) {
        setNotice("Запрос принят!");
        setFriendRequests(prev => prev.filter(r => r.fromId !== fromId));
        socket.emit('get-friends', userId, (res: any) => {
          if (res?.success) setFriends(res.friends);
        });
      } else {
        setNotice(response?.error || "Ошибка");
      }
      setTimeout(() => setNotice(""), 3000);
    });
  };

  const declineRequest = (fromId: string) => {
    if (!userId || isGuest) return;
    socket.emit('decline-friend-request', { userId, fromId }, (response: any) => {
      if (response?.success) {
        setFriendRequests(prev => prev.filter(r => r.fromId !== fromId));
      }
    });
  };

  const removeFriend = (friendId: string) => {
    if (!userId || isGuest) return;
    socket.emit('remove-friend', { userId, friendId }, (response: any) => {
      if (response?.success) {
        setFriends(prev => prev.filter(f => f.id !== friendId));
        setNotice("Друг удален");
        setTimeout(() => setNotice(""), 3000);
      }
    });
  };

  const matches = friends.filter((f) => `${f.name} ${f.id}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-rise">
      <SectionHeading
        eyebrow="социальный клуб"
        title="Друзья"
        detail="Собери состав, который знает твои слабые места."
      />
      {notice && (
        <div className="mb-4 rounded-xl bg-[#dceae3] px-4 py-3 text-sm font-medium text-accent">
          {notice}
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-2xl border border-card-border bg-card p-5">
          {isGuest ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Войдите в аккаунт, чтобы использовать друзей.
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="ID или никнейм игрока"
                  className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              
              {search && searchResults.length > 0 && (
                <div className="mt-4 space-y-2 border-b border-border pb-4">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Результаты поиска</div>
                  {searchResults.filter(r => !friends.some(f => f.id === r.id)).map(r => (
                    <div key={r.id} className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-muted">
                      <Avatar initials={r.name[0]} color="#32786d" size="sm" avatar={r.avatar} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{r.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{r.id} · {r.online ? 'В сети' : 'Не в сети'}</div>
                      </div>
                      <button onClick={() => addFriend(r.id)} className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground">
                        Добавить
                      </button>
                    </div>
                  ))}
                </div>
              )}

                            <div className="mt-5 flex gap-1 rounded-xl bg-muted p-1 w-fit">
                <button
                  onClick={() => setActiveSubTab("friends")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${activeSubTab === "friends" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Друзья ({friends.length})
                </button>
                <button
                  onClick={() => setActiveSubTab("requests")}
                  className={`relative rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${activeSubTab === "requests" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Запросы
                  {friendRequests.length > 0 && (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                      {friendRequests.length}
                    </span>
                  )}
                </button>
              </div>

                            {activeSubTab === "friends" && (
              <div className="mt-3 space-y-2">
                {matches.map((friend) => {
                  const initials = friend.name.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
                  const colorIndex = friend.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % PLAYER_COLORS.length;
                  const color = PLAYER_COLORS[colorIndex];
                  return (
                    <div key={friend.id} className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-muted">
                      <div className="relative">
                        <Avatar initials={initials} color={color} size="sm" avatar={friend.avatar} />
                        {friend.online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-accent" />}
                      </div>
                                            <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2">
                          <b className="truncate text-sm">{friend.name}</b>
                          <button
                            onClick={() => setChatFriend(friend)}
                            className={`rounded-lg p-1 transition-colors ${chatFriend?.id === friend.id ? "bg-primary text-white" : "text-muted-foreground hover:bg-primary/10 hover:text-primary"}`}
                            title="Открыть чат"
                          >
                            <MessageCircle size={16} />
                          </button>
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {friend.id} · {friend.online ? 'В сети' : 'Не в сети'}
                        </div>
                      </div>
                      <button onClick={() => removeFriend(friend.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500" title="Удалить">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
                                {matches.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Друзей пока нет. Найди их по ID.</div>}
              </div>
              )}

              {activeSubTab === "requests" && (
              <div className="mt-3 space-y-4">
                {/* Входящие */}
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Входящие ({friendRequests.length})
                  </div>
                  <div className="space-y-2">
                    {friendRequests.length === 0 && (
                      <div className="py-3 text-center text-xs text-muted-foreground">Нет входящих</div>
                    )}
                    {friendRequests.map((req) => {
                  const initials = req.fromName.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
                  const colorIndex = req.fromName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % PLAYER_COLORS.length;
                  const color = PLAYER_COLORS[colorIndex];
                  return (
                    <div key={req.fromId} className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-muted">
                      <div className="relative">
                        <Avatar initials={initials} color={color} size="sm" avatar={req.fromAvatar} />
                        {req.fromOnline && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-accent" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <b className="truncate text-sm">{req.fromName}</b>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {req.fromId} · {req.fromOnline ? 'В сети' : 'Не в сети'}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => acceptRequest(req.fromId)}
                          className="rounded-lg bg-[#dceae3] px-3 py-1.5 text-xs font-bold text-accent hover:bg-[#c8dfd3]"
                        >
                          Принять
                        </button>
                        <button
                          onClick={() => declineRequest(req.fromId)}
                          className="rounded-lg bg-[#f6dfd7] px-3 py-1.5 text-xs font-bold text-primary hover:bg-[#efcec2]"
                        >
                          Отклонить
                        </button>
                      </div>
                    </div>
                  );
                    })}
                  </div>
                </div>

                {/* Исходящие */}
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Исходящие ({outgoingRequests.length})
                  </div>
                  <div className="space-y-2">
                    {outgoingRequests.length === 0 && (
                      <div className="py-3 text-center text-xs text-muted-foreground">Нет отправленных</div>
                    )}
                    {outgoingRequests.map((req) => (
                      <div key={req.toId} className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-muted">
                        <Avatar initials={req.toName[0] || "?"} color="#e96852" size="sm" avatar={req.toAvatar} />
                        <div className="min-w-0 flex-1">
                          <b className="truncate text-sm">{req.toName}</b>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {req.toId} · ожидает ответа
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (!userId || isGuest) return;
                            socket.emit('decline-friend-request', { userId: req.toId, fromId: userId }, (response: any) => {
                              if (response?.success) {
                                setOutgoingRequests(prev => prev.filter(r => r.toId !== req.toId));
                              }
                            });
                          }}
                          className="rounded-lg bg-[#f6dfd7] px-3 py-1.5 text-xs font-bold text-primary hover:bg-[#efcec2]"
                        >
                          Отменить
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              )}
            </>
          )}
        </div>
                        {chatFriend ? (
          <ChatPanel
            key={chatFriend.id}
            targetFriend={chatFriend}
            onClose={() => setChatFriend(null)}
            currentUserName={player?.name || "Игрок"}
          />
        ) : (
          <div className="flex min-h-[440px] flex-col items-center justify-center rounded-2xl border border-dashed border-card-border bg-card p-5 text-center">
            <MessageCircle size={40} className="text-muted-foreground/40" />
            <p className="mt-3 text-sm font-bold text-muted-foreground">Выбери друга для начала чата</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Нажми на иконку чата рядом с именем друга слева</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Shop() {
  const player = (() => {
    try {
      const raw = localStorage.getItem("arena-session-user");
      return raw && raw !== "null" ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const isGuest = !!player?.guest;
  const [coins, setCoins] = useLocalStorage("arena-coins", 2400);
  const [inventory, setInventory] = useServerSync<OwnedItem[]>("arena-inventory", [], ['user-inventory-updated'], 'get-user-inventory');
  const [marketItems] = useServerSync<MarketItem[]>("arena-market-items", [], ['custom-items-updated'], 'get-custom-items');
  const [section, setSection] = useState<"cases" | "cards">("cases");  const [notice, setNotice] = useState("");
  const [adminCases] = useServerSync<CaseDesign[]>("arena-admin-cases", [], ['admin-cases-updated'], 'get-admin-cases');
const safeAdminCases = Array.isArray(adminCases) ? adminCases.filter((c): c is CaseDesign => c !== null && c !== undefined && c.isActive !== false) : [];
const cases: CaseDesign[] = safeAdminCases;
const vipItems = marketItems.filter(i => i.isActive && i.category === "vip");
  const buyCase = (name: string, price: number) => {
  if (coins < price) {
    setNotice("Не хватает Coins — загляни в ежедневный бонус.");
    return;
  }

  // Находим кейс
  const selectedCase = cases.find(c => c.name === name);
  if (!selectedCase) return;

  // Создаём объект кейса как предмет в инвентаре
    const caseItem: OwnedItem = {
    id: `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: selectedCase.name,
    type: "board",
    rarity: "Кейс",
    color: selectedCase.color || "#29233e",
    price: price,
    description: selectedCase.desc || "Кейс с предметами",
    ownedAt: new Date().toISOString(),
    imageDataUrl: selectedCase.imageDataUrl,
    cardWidth: selectedCase.cardWidth,
    cardHeight: selectedCase.cardHeight,
    imageHeight: selectedCase.imageHeight,
    shopScale: selectedCase.shopScale,
  } as any;

  // Обновляем локальные стейты
  const updatedInventory = [...inventory, caseItem];
  setCoins(coins - price);
  setInventory(updatedInventory);

  // Отправляем изменения на сервер
  const userId = getSessionUserId();
  if (userId) {
    socket.emit('save-user-data', { 
      userId, 
      newData: { 
        ...JSON.parse(localStorage.getItem("arena-user-data-" + userId) || "{}"),
        inventory: updatedInventory, 
        coins: coins - price 
      } 
    });
  }

  setNotice(`Кейс «${selectedCase.name}» добавлен в инвентарь! Открой его там.`);
};

const buyVip = (vip: MarketItem) => {
  if (coins < vip.price) {
    setNotice("Не хватает Coins — загляни в ежедневный бонус.");
    return;
  }

  const days = vip.vipDuration || 7;
  const currentVipUntil = localStorage.getItem("arena-vip-until");
  const now = Date.now();
  let baseTime = now;
  if (currentVipUntil && new Date(currentVipUntil) > new Date(now)) {
    baseTime = new Date(currentVipUntil).getTime();
  }

  const vipEnd = new Date(baseTime + days * 24 * 60 * 60 * 1000);
  localStorage.setItem("arena-vip-until", vipEnd.toISOString());
  setCoins(coins - vip.price);

  // Добавляем VIP как предмет в инвентарь
    const vipItem: OwnedItem = {
    id: `vip-${Date.now()}`,
    name: vip.name,
    type: "board",
    rarity: "VIP",
    color: vip.bgColor || "#d3a247",
    price: vip.price,
    description: vip.description || `VIP на ${days} дней`,
    ownedAt: new Date().toISOString(),
    vipDuration: days,
    imageDataUrl: vip.imageDataUrl,
    cardWidth: vip.cardWidth,
    cardHeight: vip.cardHeight,
    imageHeight: vip.imageHeight,
    shopScale: vip.shopScale,
  } as any;

  const updatedInv = [...inventory, vipItem];
  setInventory(updatedInv);

  const userId = getSessionUserId();
  if (userId) {
    socket.emit('save-user-data', {
      userId,
      newData: {
        ...JSON.parse(localStorage.getItem("arena-user-data-" + userId) || "{}"),
        vipUntil: vipEnd.toISOString(),
        coins: coins - vip.price,
        inventory: updatedInv,
      }
    });
  }

  setNotice(`VIP продлён до ${vipEnd.toLocaleDateString("ru-RU")}!`);
};

  return (
    <div className="animate-rise">
      <SectionHeading
        eyebrow="витрина клуба"
        title="Магазин"
        detail="Украшай стол так, чтобы тебя узнавали по первому броску."
        action={
          <div className="flex items-center gap-2 rounded-xl bg-[#f3e7c8] px-4 py-2.5 text-sm font-bold text-[#7e5f1d]">
            <Coins size={17} /> {coins.toLocaleString("ru-RU")} Coins
          </div>
        }
      />
      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#dceae3] px-4 py-3 text-sm font-medium text-accent">
          <Check size={16} />
          {notice}
          <button onClick={() => setNotice("")} className="ml-auto">
            <X size={15} />
          </button>
        </div>
      )}
              <div className="flex flex-wrap gap-5">
                {section === "cases" &&
          cases.map((product) => {
            const caseItems = (product.items || [])
              .map(id => marketItems.find(m => m.id === id))
              .filter(Boolean);
            return (
              (() => {
                const sz = getCardSize(product);
                return (
              <div
                key={product.id}
                className="lift overflow-hidden rounded-2xl border border-card-border bg-card flex flex-col"
                style={{ width: `${sz.cardWidth}px` }}
              >
                    <div
                  className="relative flex items-center justify-center overflow-hidden"
                  style={{
                    height: `${sz.imageHeight}px`,
                    backgroundColor: product.color || "#e96852",
                  }}
                >
                  {product.imageDataUrl ? (
                    <img
                      src={product.imageDataUrl}
                      alt={product.name}
                      className="h-full w-full object-contain p-3"
                      style={{ transform: `scale(${sz.shopScale / 100})` }}
                    />
                  ) : (
                    <div className="text-6xl" style={{ color: product.color || "#e96852" }}>📦</div>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div>
                    <h3 className="font-display text-lg font-bold">{product.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{product.desc || "Случайный предмет"}</p>
                  </div>
                  {caseItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      {caseItems.slice(0, 5).map((it) => {
                        const rarityBg =
                          it!.category === "vip" ? "#d3a247" :
                          it!.rarity === "rare" ? "#2563eb" :
                          it!.rarity === "epic" ? "#9b5de5" :
                          "#b0b0b0";
                        return (
                          <span
                            key={it!.id}
                            className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: rarityBg }}
                          >
                            {it!.name}
                          </span>
                        );
                      })}
                      {caseItems.length > 5 && (
                        <div className="group relative inline-flex">
                          <span className="flex h-5 w-5 cursor-help items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                            i
                          </span>
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-card-border bg-card p-2 text-[10px] shadow-xl group-hover:block">
                            <div className="mb-1 font-bold">
                              Все предметы ({caseItems.length}):
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {caseItems.map((it) => {
                                const rarityBg =
                                  it!.category === "vip" ? "#d3a247" :
                                  it!.rarity === "rare" ? "#2563eb" :
                                  it!.rarity === "epic" ? "#9b5de5" :
                                  "#b0b0b0";
                                return (
                                  <span
                                    key={it!.id}
                                    className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                                    style={{ backgroundColor: rarityBg }}
                                  >
                                    {it!.name}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2 border-t border-border">
                    <span className="flex items-center gap-1.5 font-mono text-sm font-bold">
                      <Coins size={15} className="text-[#b18428]" />
                      {product.price ?? 100}
                    </span>
                    <button
                      onClick={() => {
                        if (isGuest) {
                          setNotice("❌ Гостевой режим не может покупать. Зарегистрируйтесь.");
                          setTimeout(() => setNotice(""), 10000);
                          return;
                        }
                        const userId = getSessionUserId();
                        if (!userId) {
                          setNotice("Ошибка: не найден ID игрока");
                          return;
                        }
                        socket.emit('shop-buy-case', { userId, caseId: product.id }, (res: any) => {
                          if (res?.success) {
                            localStorage.setItem("arena-coins", String(res.newBalance));
                            setNotice(`Кейс «${product.name}» добавлен в инвентарь!`);
                            setTimeout(() => setNotice(""), 4000);
                          } else {
                            setNotice(`❌ ${res?.error || 'Не удалось купить'}`);
                            setTimeout(() => setNotice(""), 6000);
                          }
                        });
                      }}
                      className={`rounded-lg px-3.5 py-2 text-xs font-bold ${
                        isGuest
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      Купить
                    </button>
                  </div>
                </div>
              </div>
              );
              })()
            );
          })}

        {section === "cards" &&
          marketItems.filter(i => i.isActive && i.category === "card").map((item) => {
            const slotNum = Number(item.slotIndex || 0);
            const rarityColor = item.rarity === "common" ? "#b0b0b0" : item.rarity === "rare" ? "#2563eb" : "#9b5de5";
            const isBuyable = true;
            const sz = getCardSize(item);
            return (
              <div
                key={item.id}
                className="lift overflow-hidden rounded-2xl border border-card-border bg-card flex flex-col"
                style={{ width: `${sz.cardWidth}px` }}
              >
                                <div
                  className="relative flex items-center justify-center overflow-hidden bg-[#fdfaf5]"
                  style={{ height: `${sz.imageHeight}px` }}
                >
                  {item.imageDataUrl ? (
                    <img
                      src={item.imageDataUrl}
                      alt={item.name}
                      className="h-full w-full object-contain p-3"
                      style={{ transform: `scale(${sz.shopScale / 100})` }}
                    />
                  ) : (
                    <div className="text-6xl">❓</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: rarityColor }} />
                </div>
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div>
                    <h3 className="font-display text-lg font-bold">{item.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Заменяет слот: {slotNum} · {item.rarity}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2 border-t border-border">
                    <span className="flex items-center gap-1.5 font-mono text-sm font-bold">
                      <Coins size={15} className="text-[#b18428]" />
                      {item.price}
                    </span>
                    <button
                      onClick={() => {
                        if (isGuest) {
                          setNotice("❌ Гостевой режим не может покупать. Зарегистрируйтесь.");
                          setTimeout(() => setNotice(""), 10000);
                          return;
                        }
                        const userId = getSessionUserId();
                        if (!userId) {
                          setNotice("Ошибка: не найден ID игрока");
                          return;
                        }
                        socket.emit('shop-buy-card', { userId, marketItemId: item.id }, (res: any) => {
                          if (res?.success) {
                            localStorage.setItem("arena-coins", String(res.newBalance));
                            setNotice(`«${item.name}» добавлен в инвентарь!`);
                            setTimeout(() => setNotice(""), 4000);
                          } else {
                            setNotice(`❌ ${res?.error || 'Не удалось купить'}`);
                            setTimeout(() => setNotice(""), 6000);
                          }
                        });
                      }}
                      className={`rounded-lg px-3.5 py-2 text-xs font-bold ${
                        isGuest
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      Купить
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

                      {/* VIP-статус */}
      {vipItems.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-4 font-display text-xl font-bold">VIP-статус</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Наведи курсор на карточку, чтобы увидеть все бонусы статуса.
          </p>
                    <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))" }}>
            {vipItems.map((vip) => (
              (() => {
                const sz = getCardSize(vip);
                return (
              <div
                key={vip.id}
                className="group relative"
                style={{ width: `${sz.cardWidth}px` }}
              >
                <div
                  className="lift overflow-hidden rounded-2xl border border-card-border bg-card flex flex-col h-full"
                  style={{ width: `${sz.cardWidth}px` }}
                >
                <div
                  className="relative flex items-center justify-center overflow-hidden"
                  style={{
                    height: `${sz.imageHeight}px`,
                    backgroundColor: vip.bgColor || "#d3a247",
                  }}
                >
                  {vip.imageDataUrl ? (
                    <img
                      src={vip.imageDataUrl}
                      alt={vip.name}
                      className="h-full w-full object-contain p-3"
                      style={{ transform: `scale(${sz.shopScale / 100})` }}
                    />
                  ) : (
                    <Crown size={64} style={{ color: vip.bgColor || "#d3a247" }} />
                  )}
                </div>
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div>
                    <h4 className="font-display text-lg font-bold">
                      {vip.name}
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground align-middle">ⓘ</span>
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {vip.description || `Продлевает VIP на ${vip.vipDuration || 7} дней. Наведи на карточку, чтобы увидеть все бонусы.`}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2 border-t border-border">
                    <span className="flex items-center gap-1.5 font-mono text-sm font-bold">
                      <Coins size={15} className="text-[#b18428]" />
                      {vip.price}
                    </span>
                    <button
                      onClick={() => {
                        if (isGuest) {
                          setNotice("❌ Гостевой режим не может покупать. Зарегистрируйтесь.");
                          setTimeout(() => setNotice(""), 10000);
                          return;
                        }
                        const userId = getSessionUserId();
                        if (!userId) {
                          setNotice("Ошибка: не найден ID игрока");
                          return;
                        }
                        socket.emit('shop-buy-vip', { userId, marketItemId: vip.id }, (res: any) => {
                          if (res?.success) {
                            localStorage.setItem("arena-coins", String(res.newBalance));
                            if (res.vipUntil) localStorage.setItem("arena-vip-until", res.vipUntil);
                            const untilDate = new Date(res.vipUntil).toLocaleDateString("ru-RU");
                            setNotice(`👑 VIP активирован до ${untilDate}!`);
                            setTimeout(() => setNotice(""), 5000);
                          } else {
                            setNotice(`❌ ${res?.error || 'Не удалось купить'}`);
                            setTimeout(() => setNotice(""), 6000);
                          }
                        });
                      }}
                      className={`rounded-lg px-3.5 py-2 text-xs font-bold ${
                        isGuest
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      Купить
                    </button>
                  </div>
                </div>
                </div>
                {/* Popup с бонусами — вылетает справа от карточки при наведении на любое место */}
                <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-64 rounded-xl border border-card-border bg-card p-3 text-[11px] leading-4 text-foreground shadow-2xl group-hover:block">
                  <div className="mb-1.5 font-bold text-primary">VIP-статус даёт:</div>
                  <ul className="space-y-0.5 text-muted-foreground">
                    <li>• +50% опыта за каждую партию</li>
                    <li>• +20% Coins за каждую партию</li>
                    <li>• Создание лобби во всех режимах (Классика, Быстрая, Дуэль)</li>
                    <li>• Пароль на комнату</li>
                    <li>• Иконка VIP рядом с ником</li>
                  </ul>
                </div>
              </div>
              );
              })()
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function TradeItemMiniCard({
  item,
  getMarketPrice,
  tone,
}: {
  item: TradeItemSnapshot;
  getMarketPrice: (name: string) => number | null;
  tone: "primary" | "accent";
}) {
  const price = getMarketPrice(item.name);
  const borderCls = tone === "primary" ? "border-primary/40" : "border-accent/40";
  const badgeCls = tone === "primary" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent";
  return (
    <div className={`flex flex-col items-center rounded-lg border ${borderCls} bg-card p-1.5`}>
      <div className="flex h-14 w-full items-center justify-center overflow-hidden">
        {item.imageDataUrl ? (
          <img src={item.imageDataUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="text-2xl">❓</div>
        )}
      </div>
      <div className="mt-1 truncate w-full text-center text-[10px] font-bold" title={item.name}>
        {item.name}
      </div>
      <div className={`mt-0.5 rounded px-1 py-0.5 text-[9px] font-bold ${badgeCls}`}>
        {price !== null ? `≈ ${price} 🪙` : "нет на рынке"}
      </div>
    </div>
  );
}
type WalletTransaction = {
  id: string;
  type: string;
  amount: number;
  metadata: any;
  createdAt: number;
};

function WalletModal({ onClose }: { onClose: () => void }) {
  const [coins, setCoins] = useState<number>(() => {
    try { return Number(localStorage.getItem("arena-coins") || 0); } catch { return 0; }
  });
  const [filter, setFilter] = useState<"all" | "rewards" | "shop" | "market" | "deposit">("all");
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ income: number; expense: number }>({ income: 0, expense: 0 });
  const [showDepositStub, setShowDepositStub] = useState(false);

  const PAGE_SIZE = 20;
  const userId = getSessionUserId();

  const fetchTransactions = (offset = 0, replace = true) => {
    if (!userId) return;
    setLoading(true);
    socket.emit(
      "get-transactions",
      { userId, filter, limit: PAGE_SIZE, offset },
      (res: any) => {
        setLoading(false);
        if (res?.success) {
          setTotal(res.total || 0);
          setTransactions((prev) => (replace ? res.transactions : [...prev, ...res.transactions]));
        }
      }
    );
  };

  const fetchSummary = () => {
    if (!userId) return;
    socket.emit("get-wallet-summary", userId, (res: any) => {
      if (res?.success) {
        setSummary({ income: res.income, expense: res.expense });
      }
    });
  };

  useEffect(() => {
    fetchTransactions(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const refresh = () => {
      try { setCoins(Number(localStorage.getItem("arena-coins") || 0)); } catch {}
    };
    window.addEventListener("arena-wallet-updated", refresh);
    window.addEventListener("storage", refresh);
    const onUserData = (data: any) => {
      if (data && typeof data.coins === "number") {
        try { localStorage.setItem("arena-coins", String(data.coins)); } catch {}
      }
      refresh();
    };
    socket.on("user-data-updated", onUserData);
    return () => {
      window.removeEventListener("arena-wallet-updated", refresh);
      window.removeEventListener("storage", refresh);
      socket.off("user-data-updated", onUserData);
    };
  }, []);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) +
      ", " +
      d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  const txIcon = (t: string) => {
    switch (t) {
      case "quest_claim": return "💰";
      case "game_reward": return "🏆";
      case "shop_buy": return "🛍";
      case "market_buy": return "🛒";
      case "market_sell": return "💵";
      case "market_buy_refund": return "↩️";
      case "deposit": return "🏦";
      default: return "•";
    }
  };

  const txTitle = (tx: WalletTransaction) => {
    const m = tx.metadata || {};
    switch (tx.type) {
      case "quest_claim": {
        const names: Record<string, string> = {
          dailyLogin: "Заход в игру",
          playGame: "Сыграна партия",
          winGame: "Победа в партии",
          buyProperty: "Куплено поле",
          improveProperty: "Улучшено поле",
        };
        return `Квест: ${names[m.questId] || m.questId || "выполнен"}`;
      }
      case "game_reward":
        return m.place === 1 ? "🏆 1 место в партии" : `🏆 ${m.place}-е место в партии`;
      case "shop_buy":
        return `Магазин: ${m.itemName || "покупка"}${m.category === "vip" ? ` (VIP ${m.days || 7} дн.)` : ""}`;
      case "market_buy":
        return `Рынок: покупка «${m.itemName || "?"}»`;
      case "market_sell":
        return `Рынок: продажа «${m.itemName || "?"}»`;
      case "market_buy_refund":
        return `Возврат за «${m.itemName || "?"}»`;
      case "deposit":
        return "Пополнение кошелька";
      default:
        return tx.type;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#29233e]/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-2xl">
        {/* Заголовок */}
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">
              кошелёк
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold">История транзакций</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        {/* Баланс + пополнение + сводка */}
        <div className="border-b border-border px-6 py-4">
          <div className="flex flex-wrap items-stretch gap-3">
            <div className="flex-1 rounded-xl bg-[#f3e7c8] px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#7e5f1d]">
                Баланс
              </div>
              <div className="mt-1 flex items-center gap-2 font-mono text-2xl font-bold text-[#7e5f1d]">
                <Coins size={20} />
                {coins.toLocaleString("ru-RU")}
              </div>
            </div>
            <button
              onClick={() => setShowDepositStub(true)}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:brightness-95"
            >
              <Plus size={16} />
              Пополнить
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#dceae3]/60 px-3 py-2">
              <div className="text-[9px] font-bold uppercase text-accent">Приход · 30 дней</div>
              <div className="font-mono text-lg font-bold text-accent">
                +{summary.income.toLocaleString("ru-RU")}
              </div>
            </div>
            <div className="rounded-xl bg-[#f6dfd7]/60 px-3 py-2">
              <div className="text-[9px] font-bold uppercase text-primary">Расход · 30 дней</div>
              <div className="font-mono text-lg font-bold text-primary">
                −{summary.expense.toLocaleString("ru-RU")}
              </div>
            </div>
          </div>
        </div>

        {/* Фильтры */}
        <div className="border-b border-border px-6 py-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              ["all", "Все"],
              ["rewards", "Награды"],
              ["shop", "Магазин"],
              ["market", "Рынок"],
              ["deposit", "Пополнения"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id as any)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  filter === id
                    ? "bg-[#29233e] text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Список транзакций */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
          {transactions.length === 0 && !loading && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Пока транзакций нет
            </div>
          )}

          <div className="space-y-1">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
                  {txIcon(tx.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{txTitle(tx)}</div>
                  <div className="text-[10px] text-muted-foreground">{formatDate(tx.createdAt)}</div>
                </div>
                <div
                  className={`shrink-0 font-mono text-sm font-bold ${
                    tx.amount > 0 ? "text-accent" : tx.amount < 0 ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount.toLocaleString("ru-RU")}
                </div>
              </div>
            ))}
          </div>

          {loading && (
            <div className="py-4 text-center text-xs text-muted-foreground">Загрузка…</div>
          )}
        </div>

        {/* Пагинация */}
        {transactions.length > 0 && transactions.length < total && (
          <div className="border-t border-border px-6 py-3">
            <button
              onClick={() => fetchTransactions(transactions.length, false)}
              disabled={loading}
              className="w-full rounded-xl border border-input bg-card py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              {loading ? "Загрузка…" : `Показать ещё ${Math.min(PAGE_SIZE, total - transactions.length)}`}
            </button>
          </div>
        )}

        {/* Заглушка пополнения */}
        {showDepositStub && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#29233e]/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-card-border bg-card p-6 text-center shadow-2xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3e7c8] text-2xl">
                🏦
              </div>
              <h3 className="mt-4 font-display text-xl font-bold">Пополнение скоро</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Мы подключаем платёжную систему. Совсем скоро вы сможете пополнять кошелёк картой и через СБП.
              </p>
              <button
                onClick={() => setShowDepositStub(false)}
                className="mt-5 w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground"
              >
                Понятно
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function TradeCreateModal({
  sourceItem,
  onClose,
  onCreated,
}: {
  sourceItem: OwnedItem | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<"partner" | "items">("partner");
  const [partners, setPartners] = useState<{ id: string; name: string; online: boolean }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; online: boolean }[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<{ id: string; name: string } | null>(null);
  const [theirInventory, setTheirInventory] = useState<any[]>([]);
  const [loadingTheirInv, setLoadingTheirInv] = useState(false);
  const [mySelected, setMySelected] = useState<string[]>(() => (sourceItem ? [sourceItem.id] : []));
  const [theirSelected, setTheirSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);

  const myUserId = getSessionUserId();

  useEffect(() => {
    if (!myUserId) return;
    socket.emit("get-friends", myUserId, (res: any) => {
      if (res?.success) setPartners(res.friends || []);
    });
  }, [myUserId]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      socket.emit("search-users", searchQuery, (res: any) => {
        if (res?.success) setSearchResults(res.results || []);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const myInventory = useMemo(() => {
    try {
      const raw = localStorage.getItem("arena-inventory") || "[]";
      const inv = JSON.parse(raw);
      return Array.isArray(inv) ? inv : [];
    } catch {
      return [];
    }
  }, [step]);

  const choosePartner = (p: { id: string; name: string }) => {
    if (p.id === myUserId) {
      setNotice("Нельзя выбрать себя");
      setTimeout(() => setNotice(""), 2500);
      return;
    }
    setSelectedPartner(p);
    setLoadingTheirInv(true);
    socket.emit("get-user-inventory-public", p.id, (res: any) => {
      setLoadingTheirInv(false);
      if (res?.success) {
        setTheirInventory(res.inventory || []);
      } else {
        setNotice(res?.error || "Не удалось загрузить инвентарь");
        setTimeout(() => setNotice(""), 2500);
      }
    });
    setStep("items");
  };

  const toggleMy = (id: string) => {
    setMySelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 10 ? prev : [...prev, id]
    );
  };
  const toggleTheir = (id: string) => {
    setTheirSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 10 ? prev : [...prev, id]
    );
  };

  const canSend = mySelected.length > 0 && theirSelected.length > 0 && !!selectedPartner;

  const submit = () => {
    if (!myUserId || !selectedPartner || !canSend) return;
    setSending(true);
    socket.emit(
      "trade-create",
      {
        fromUserId: myUserId,
        toUserId: selectedPartner.id,
        myItemIds: mySelected,
        theirItemIds: theirSelected,
      },
      (res: any) => {
        setSending(false);
        if (res?.success) {
          onCreated();
          onClose();
        } else {
          setNotice(res?.error || "Не удалось создать обмен");
          setTimeout(() => setNotice(""), 3500);
        }
      }
    );
  };

  const isItemLocked = (it: any) => {
    if (it.lockedInTradeId) return true;
    if (it.tradedAt) {
      const elapsed = Date.now() - new Date(it.tradedAt).getTime();
      if (elapsed < 2 * 60 * 60 * 1000) return true;
    }
    return false;
  };

  const renderItemGrid = (
    items: any[],
    selectedIds: string[],
    onToggle: (id: string) => void,
    tone: "primary" | "accent"
  ) => {
    const selCls = tone === "primary" ? "border-primary bg-[#f6dfd7]" : "border-accent bg-[#dceae3]";
    const hoverCls = tone === "primary" ? "hover:border-primary/40" : "hover:border-accent/40";
    return (
      <div
        className="grid max-h-60 gap-2 overflow-y-auto rounded-xl border border-border bg-muted/30 p-2"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
      >
        {items.map((it: any) => {
          const selected = selectedIds.includes(it.id);
          const locked = isItemLocked(it);
          const isCase = it.rarity === "Кейс";
          const isVip = it.rarity === "VIP";
          return (
            <button
              key={it.id}
              onClick={() => !locked && onToggle(it.id)}
              disabled={locked}
              className={`relative flex flex-col items-center rounded-lg border p-2 text-center transition ${
                locked
                  ? "cursor-not-allowed border-border bg-muted opacity-50"
                  : selected
                    ? selCls
                    : `border-border bg-card ${hoverCls}`
              }`}
            >
              <div className="flex h-12 w-full items-center justify-center overflow-hidden">
                {it.imageDataUrl ? (
                  <img src={it.imageDataUrl} alt={it.name} className="max-h-full max-w-full object-contain" />
                ) : isCase ? (
                  <Package size={24} className="text-muted-foreground" />
                ) : isVip ? (
                  <Crown size={24} className="text-[#d3a247]" />
                ) : (
                  <div className="text-xl">❓</div>
                )}
              </div>
              <div className="mt-1 truncate text-[10px] font-bold" title={it.name}>
                {it.name}
              </div>
              {locked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-[9px] font-bold text-white">
                  Занято
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#29233e]/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">обмен предметами</div>
            <h2 className="mt-1 font-display text-2xl font-bold">
              {step === "partner" ? "Выбери партнёра" : `Обмен с ${selectedPartner?.name}`}
            </h2>
            {sourceItem && step === "items" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Отправная точка: <b>{sourceItem.name}</b>
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        {notice && (
          <div className="border-b border-primary/30 bg-[#f6dfd7] px-6 py-2 text-xs font-medium text-primary">
            {notice}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {step === "partner" && (
            <div className="space-y-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ID или никнейм игрока"
                  className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {searchQuery.trim() ? (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Результаты поиска
                  </div>
                  {searchResults.filter((r) => r.id !== myUserId).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => choosePartner(p)}
                      className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-muted"
                    >
                      <Avatar initials={p.name[0]} color="#32786d" size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{p.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {p.id} · {p.online ? "В сети" : "Не в сети"}
                        </div>
                      </div>
                    </button>
                  ))}
                  {searchResults.filter((r) => r.id !== myUserId).length === 0 && (
                    <div className="py-3 text-center text-xs text-muted-foreground">Ничего не найдено</div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Друзья ({partners.length})
                  </div>
                  {partners.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      Нет друзей — найди игрока по ID в строке поиска
                    </div>
                  )}
                  {partners.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => choosePartner(p)}
                      className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-muted"
                    >
                      <div className="relative">
                        <Avatar initials={p.name[0]} color="#32786d" size="sm" />
                        {p.online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-accent" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{p.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {p.id} · {p.online ? "В сети" : "Не в сети"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "items" && (
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-sm font-bold text-primary">
                  Ты отдаёшь ({mySelected.length}/10)
                </div>
                {myInventory.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    У тебя нет предметов
                  </div>
                ) : (
                  renderItemGrid(myInventory, mySelected, toggleMy, "primary")
                )}
              </div>

              <div>
                <div className="mb-2 text-sm font-bold text-accent">
                  Ты получаешь ({theirSelected.length}/10)
                </div>
                {loadingTheirInv ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">Загрузка инвентаря…</div>
                ) : theirInventory.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    У партнёра нет предметов
                  </div>
                ) : (
                  renderItemGrid(theirInventory, theirSelected, toggleTheir, "accent")
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          {step === "partner" ? (
            <>
              <button onClick={onClose} className="rounded-xl border border-input px-4 py-2.5 text-xs font-bold">
                Отмена
              </button>
              <div className="text-xs text-muted-foreground">Выбери игрока слева</div>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep("partner")}
                className="rounded-xl border border-input px-4 py-2.5 text-xs font-bold"
              >
                ← Назад
              </button>
              <button
                onClick={submit}
                disabled={!canSend || sending}
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
              >
                {sending ? "Отправка…" : "Предложить обмен"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Inventory({ onMarket }: { onMarket: () => void }) {
  const [inventory, setInventory] = useServerSync<OwnedItem[]>("arena-inventory", [], ['user-inventory-updated'], 'get-user-inventory');
  const [active, setActive] = useLocalStorage<{ dice: string; token: string; board: string; activeSkins: Record<number, string> }>("arena-active-skins", 
    { dice: "none", token: "none", board: "none", activeSkins: {} });
  const [notice, setNotice] = useState("");
    const [sellTarget, setSellTarget] = useState<OwnedItem | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  const [sellError, setSellError] = useState<string>("");
    // ============ ОБМЕНЫ ============
  const [inventoryTab, setInventoryTab] = useState<"items" | "trades" | "history">("items");
  const [outgoingTrades, setOutgoingTrades] = useState<Trade[]>([]);
  const [incomingTrades, setIncomingTrades] = useState<Trade[]>([]);

  // ============ ИСТОРИЯ ============
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [caseDrops, setCaseDrops] = useState<
    { id: string; caseName: string; dropName: string; dropCategory: string; createdAt: number }[]
  >([]);

  const fetchHistory = () => {
    const userId = getSessionUserId();
    if (!userId) return;
    socket.emit("get-trade-history", userId, (res: any) => {
      if (res?.success) setTradeHistory(res.trades || []);
    });
    socket.emit("get-case-drops", userId, (res: any) => {
      if (res?.success) setCaseDrops(res.drops || []);
    });
  };
  const [tradeCreateOpen, setTradeCreateOpen] = useState(false);
  const [tradeSourceItem, setTradeSourceItem] = useState<OwnedItem | null>(null);

  const fetchTrades = () => {
    const userId = getSessionUserId();
    if (!userId) return;
    socket.emit("get-trades", userId, (res: any) => {
      if (res?.success) {
        setOutgoingTrades(res.outgoing || []);
        setIncomingTrades(res.incoming || []);
      }
    });
  };

  useEffect(() => {
    fetchTrades();
    const handler = () => fetchTrades();
    socket.on("trades-updated", handler);
    return () => {
      socket.off("trades-updated", handler);
    };
  }, []);
    useEffect(() => {
    if (inventoryTab === "history") {
      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryTab]);
    // Нормализация: если старый state без activeSkins — добавим пустой объект
  useEffect(() => {
    if (!active.activeSkins) {
      setActive({ ...active, activeSkins: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [casesData] = useServerSync<CaseDesign[]>("arena-admin-cases", [], ['admin-cases-updated'], 'get-admin-cases');
const [marketItems] = useServerSync<MarketItem[]>("arena-market-items", [], ['custom-items-updated'], 'get-custom-items');
const [listings] = useServerSync<Listing[]>(
  "arena-market",
  [],
  ['market-listings', 'market-listings-updated'],
  'get-market-listings'
);
const currentUserId = getSessionUserId();

// Средняя цена предмета на рынке (по активным объявлениям).
// Если объявлений нет — null.
const getMarketPrice = (itemName: string): number | null => {
  if (!Array.isArray(listings)) return null;
  const same = listings.filter((l) => l.item.name === itemName);
  if (same.length === 0) return null;
  return Math.round(same.reduce((s, l) => s + l.price, 0) / same.length);
};
const getRecommendedPrice = (item: OwnedItem): number => {
  if (!item) return 100;
  // 1. Ищем базовую цену в магазине по marketItemId или slotIndex
  const shopItem = item.marketItemId
    ? marketItems.find((m) => m.id === item.marketItemId)
    : marketItems.find(
        (m) => m.category === "card" && m.slotIndex === item.slotIndex
      );
  const basePrice = shopItem?.price || item.price || 0;

  if (basePrice > 0) {
    // 95% от базовой цены магазина
    return Math.max(50, Math.round(basePrice * 0.95));
  }
  return 100;
};
const openCase = (caseItem: OwnedItem) => {
  const userId = getSessionUserId();
  if (!userId) {
    setNotice("Ошибка: не найден ID игрока");
    return;
  }
  socket.emit('open-case', { userId, caseItemId: caseItem.id }, (res: any) => {
    if (res?.success) {
      setNotice(`🎉 Кейс «${caseItem.name}» открыт! Выпало: «${res.dropName}»`);
      // Синхронизируем localStorage из свежих данных сервера
      if (res.userData) {
        localStorage.setItem("arena-user-data-" + userId, JSON.stringify(res.userData));
        localStorage.setItem("arena-inventory", JSON.stringify(res.userData.inventory || []));
        if (res.userData.vipUntil) {
          localStorage.setItem("arena-vip-until", res.userData.vipUntil);
        }
      }
    } else {
      setNotice(`❌ ${res?.error || 'Не удалось открыть кейс'}`);
    }
  });
};
      const apply = (item: OwnedItem) => {
  const newSkins = { ...active.activeSkins };
  if (item.slotIndex !== undefined) {
    // Храним именно id предмета в инвентаре — это позволяет отличить
    // два одинаковых скина друг от друга (один активный, второй нет).
    newSkins[item.slotIndex] = item.id;
    setActive({ ...active, activeSkins: newSkins });
  } else {
    setActive({ ...active, [item.type]: item.id });
  }
  // Если это VIP-предмет, устанавливаем дату окончания
  if (item.rarity === "VIP") {
    const vipEnd = new Date();
    vipEnd.setDate(vipEnd.getDate() + (item.vipDuration || 7));
    localStorage.setItem("arena-vip-until", vipEnd.toISOString());
  }
  // Отправляем на сервер
   const userId = getSessionUserId();
  if (userId) {
    socket.emit('update-active-skins', { userId, activeSkins: newSkins });
    // Дублируем в user-data, чтобы не потерять при следующем save-user-data
    const userDataKey = "arena-user-data-" + userId;
    const existing = JSON.parse(localStorage.getItem(userDataKey) || "{}");
    localStorage.setItem(userDataKey, JSON.stringify({ ...existing, activeSkins: newSkins }));
  }
  setNotice(`«${item.name}» применён для следующих партий.`);
};

const deactivate = (item: OwnedItem) => {
  const newSkins = { ...active.activeSkins };
  const nextActive = { ...active } as any;
  if (item.slotIndex !== undefined) {
    delete newSkins[item.slotIndex];
    nextActive.activeSkins = newSkins;
  }
  // Всегда очищаем active[type] для этого предмета
  if (nextActive[item.type] === item.id) {
    nextActive[item.type] = "none";
  }
  setActive(nextActive);
  // Если это VIP-предмет, удаляем дату окончания
  if (item.rarity === "VIP") {
    localStorage.removeItem("arena-vip-until");
  }
  // Отправляем на сервер
    const userId = getSessionUserId();
  if (userId) {
    socket.emit('update-active-skins', { userId, activeSkins: newSkins });
    // Дублируем в user-data, чтобы не потерять при следующем save-user-data
    const userDataKey = "arena-user-data-" + userId;
    const existing = JSON.parse(localStorage.getItem(userDataKey) || "{}");
    localStorage.setItem(userDataKey, JSON.stringify({ ...existing, activeSkins: newSkins }));
  }
};
  return (
    <div className="animate-rise">
      <SectionHeading
        eyebrow="твой инвентарь"
        title="Инвентарь"
        detail="Выбирай активные предметы для будущих партий."
        action={
          <button
            onClick={onMarket}
            className="flex items-center gap-2 rounded-xl border border-input bg-card px-4 py-2.5 text-sm font-bold"
          >
            <Store size={16} /> Открыть рынок
          </button>
        }
      />
      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#dceae3] px-4 py-3 text-sm font-medium text-accent">
          <Check size={16} />
          {notice}
        </div>
      )}

      {/* Переключатель вкладок */}
      <div className="mb-5 flex gap-2 rounded-xl bg-muted p-1 w-fit">
        <button
          onClick={() => setInventoryTab("items")}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
            inventoryTab === "items" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Предметы ({inventory.length})
        </button>
        <button
          onClick={() => setInventoryTab("trades")}
          className={`relative rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
            inventoryTab === "trades" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Обмены
          {(outgoingTrades.length + incomingTrades.length) > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {outgoingTrades.length + incomingTrades.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setInventoryTab("history")}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
            inventoryTab === "history" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          История
        </button>
      </div>

      {inventoryTab === "items" && (
        <>
            <div className="mb-5 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-card-border bg-card p-2.5">
          <div className="text-[9px] text-muted-foreground">Всего предметов</div>
          <div className="mt-1 font-mono text-sm font-bold">
            {inventory.length}
          </div>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-2.5">
          <div className="text-[9px] text-muted-foreground">Активных</div>
          <div className="mt-1 font-mono text-sm font-bold">
            {(active.dice !== "none" ? 1 : 0) + (active.token !== "none" ? 1 : 0) + (active.board !== "none" ? 1 : 0) + Object.keys(active.activeSkins || {}).length}
          </div>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-2.5">
          <div className="text-[9px] text-muted-foreground">Можно выставить</div>
          <div className="mt-1 font-mono text-sm font-bold">
            {inventory.length}
          </div>
        </div>
      </div>
            <div className="flex flex-wrap gap-5">
        {inventory.map((item) => {
  const isCase = item.rarity === "Кейс";
  const isVip = item.rarity === "VIP";
  const isActive = item.slotIndex !== undefined
    ? active.activeSkins?.[item.slotIndex] === item.id
    : active[item.type] === item.id;
  const sourceMarketItem = findMarketItemForOwned(item, marketItems);
  const sz = getCardSize(sourceMarketItem ?? item);
  
  return (
             <div
          key={item.id}
          className="lift overflow-hidden rounded-2xl border border-card-border bg-card flex flex-col"
          style={{ width: `${sz.cardWidth}px` }}
        >
      <div
        className="relative flex items-center justify-center overflow-hidden bg-[#fdfaf5]"
        style={{ height: `${sz.imageHeight}px` }}
      >
                {item.imageDataUrl ? (
          <img
            src={item.imageDataUrl}
            alt={item.name}
            className="h-full w-full object-contain p-3"
            style={{ transform: `scale(${sz.shopScale / 100})` }}
          />
        ) : isCase ? (
          <Package size={56} style={{ color: item.color }} />
        ) : isVip ? (
          <Crown size={56} style={{ color: item.color }} />
        ) : item.slotIndex !== undefined && CELL_LOGOS[item.slotIndex] ? (
          <div style={{ fontSize: 56, lineHeight: 1 }}>{CELL_LOGOS[item.slotIndex]}</div>
        ) : (
          <Dice5 size={56} style={{ color: item.color }} />
        )}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: item.rarity === "common" ? "#b0b0b0" : item.rarity === "rare" ? "#2563eb" : item.rarity === "epic" ? "#9b5de5" : item.rarity === "Кейс" ? "#e96852" : item.rarity === "VIP" ? "#d3a247" : "#b0b0b0" }} />
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">{item.name}</h3>
          {isVip && (
            <span className="rounded-full bg-[#f3e7c8] px-2 py-1 text-[10px] font-bold text-[#99711f]">
              VIP
            </span>
          )}
          {isCase && (
            <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold">
              Кейс
            </span>
          )}
          {isActive && (
            <span className="rounded-full bg-[#dceae3] px-2 py-1 text-[10px] font-bold text-accent">
              Активен
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.slotIndex !== undefined && item.rarity !== "Кейс" && item.rarity !== "VIP"
            ? `Заменяет слот ${item.slotIndex}`
            : item.description}
        </p>
        {isCase ? (
  <button onClick={() => openCase(item)} className="mt-4 w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground">
    Открыть кейс
  </button>
) : isVip ? (
  <div className="mt-4 rounded-lg bg-[#f3e7c8] p-2 text-center text-[11px] font-bold text-[#7e5f1d]">
    {(() => {
      const vipUntil = localStorage.getItem("arena-vip-until");
      if (!vipUntil || new Date(vipUntil) < new Date()) return "VIP не активен";
      const daysLeft = Math.ceil((new Date(vipUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return `Активен · осталось ${daysLeft} дн.`;
    })()}
  </div>
) : (
                      <div className="mt-4 flex items-center gap-1.5">
                <button
                  onClick={() => (isActive ? deactivate(item) : apply(item))}
                  className={`relative flex h-6 w-9 shrink-0 items-center rounded-full transition-colors ${isActive ? "bg-accent" : "bg-muted"}`}
                  title={isActive ? "Деактивировать" : "Применить"}
                >
                  <span
                    className={`absolute h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
                      isActive ? "left-[18px]" : "left-1"
                    }`}
                  />
                </button>
                <span className={`text-[9px] font-bold ${isActive ? "text-accent" : "text-muted-foreground"}`}>
                  {isActive ? "Вкл" : "Выкл"}
                </span>
                <button
                  onClick={() => {
                    setTradeSourceItem(item);
                    setTradeCreateOpen(true);
                  }}
                  className="ml-auto shrink-0 rounded-lg bg-[#e5def0] px-2 py-1.5 text-[10px] font-bold text-[#655384]"
                  title="Предложить обмен"
                >
                  Обмен
                </button>
                <button
                  onClick={() => {
                    setSellTarget(item);
                    setSellPrice(String(getRecommendedPrice(item)));
                    setSellError("");
                  }}
                  className="shrink-0 rounded-lg bg-secondary px-2 py-1.5 text-[10px] font-bold text-secondary-foreground"
                >
                  Продать
                </button>
              </div>
            )}
      </div>
    </div>
  );
})}
      </div>
            {inventory.length === 0 && (
        <div className="rounded-2xl border border-dashed border-card-border bg-card p-12 text-center">
          <Package size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 font-bold">Инвентарь пока пуст</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Загляни в Магазин и открой первый кейс.
          </p>
        </div>
      )}
        </>
      )}

      {inventoryTab === "trades" && (
        <div className="space-y-6">
          {outgoingTrades.length === 0 && incomingTrades.length === 0 && (
            <div className="rounded-2xl border border-dashed border-card-border bg-card p-12 text-center">
              <Send size={28} className="mx-auto text-muted-foreground" />
              <p className="mt-3 font-bold">Активных обменов нет</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Нажми «Обмен» на любом предмете, чтобы предложить его другу.
              </p>
            </div>
          )}

          {incomingTrades.length > 0 && (
            <div>
              <h3 className="mb-3 font-display text-lg font-bold">Входящие ({incomingTrades.length})</h3>
              <div className="space-y-3">
                {incomingTrades.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-primary/30 bg-[#f6dfd7]/40 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-bold">
                        От игрока: <span className="font-mono">{t.fromUserId}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const userId = getSessionUserId();
                            if (!userId) return;
                            socket.emit("trade-accept", { userId, tradeId: t.id }, (res: any) => {
                              if (res?.success) {
                                setNotice("Обмен принят!");
                                setTimeout(() => setNotice(""), 3000);
                              } else {
                                setNotice(res?.error || "Ошибка");
                                setTimeout(() => setNotice(""), 3000);
                              }
                            });
                          }}
                          className="rounded-lg bg-[#32786d] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#266059]"
                        >
                          Принять
                        </button>
                        <button
                          onClick={() => {
                            const userId = getSessionUserId();
                            if (!userId) return;
                            socket.emit("trade-decline", { userId, tradeId: t.id }, (res: any) => {
                              if (res?.success) {
                                setNotice("Обмен отклонён");
                                setTimeout(() => setNotice(""), 3000);
                              }
                            });
                          }}
                          className="rounded-lg bg-[#f6dfd7] px-3 py-1.5 text-xs font-bold text-primary hover:bg-[#efcec2]"
                        >
                          Отклонить
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg bg-white/60 p-2">
                        <div className="mb-2 font-bold text-accent">Он отдаёт вам:</div>
                        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))" }}>
                          {t.fromItems.map((it) => (
                            <TradeItemMiniCard key={it.id} item={it} getMarketPrice={getMarketPrice} tone="accent" />
                          ))}
                          {t.fromItems.length === 0 && <div className="text-muted-foreground italic text-[11px]">ничего</div>}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/60 p-2">
                        <div className="mb-2 font-bold text-primary">Вы отдаёте ему:</div>
                        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))" }}>
                          {t.toItems.map((it) => (
                            <TradeItemMiniCard key={it.id} item={it} getMarketPrice={getMarketPrice} tone="primary" />
                          ))}
                          {t.toItems.length === 0 && <div className="text-muted-foreground italic text-[11px]">ничего</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outgoingTrades.length > 0 && (
            <div>
              <h3 className="mb-3 font-display text-lg font-bold">Отправленные ({outgoingTrades.length})</h3>
              <div className="space-y-3">
                {outgoingTrades.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-card-border bg-card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-bold">
                        Получатель: <span className="font-mono">{t.toUserId}</span>
                        <span className="ml-2 text-muted-foreground">· ожидает ответа</span>
                      </div>
                      <button
                        onClick={() => {
                          const userId = getSessionUserId();
                          if (!userId) return;
                          socket.emit("trade-cancel", { userId, tradeId: t.id }, (res: any) => {
                            if (res?.success) {
                              setNotice("Обмен отменён");
                              setTimeout(() => setNotice(""), 3000);
                            }
                          });
                        }}
                        className="rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted/70"
                      >
                        Отменить
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg bg-[#dceae3]/40 p-2">
                        <div className="mb-2 font-bold text-accent">Вы отдаёте:</div>
                        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))" }}>
                          {t.fromItems.map((it) => (
                            <TradeItemMiniCard key={it.id} item={it} getMarketPrice={getMarketPrice} tone="accent" />
                          ))}
                          {t.fromItems.length === 0 && <div className="text-muted-foreground italic text-[11px]">ничего</div>}
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#f3e7c8]/60 p-2">
                        <div className="mb-2 font-bold text-[#7e5f1d]">Вы получаете:</div>
                        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))" }}>
                          {t.toItems.map((it) => (
                            <TradeItemMiniCard key={it.id} item={it} getMarketPrice={getMarketPrice} tone="primary" />
                          ))}
                          {t.toItems.length === 0 && <div className="text-muted-foreground italic text-[11px]">ничего</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {tradeCreateOpen && (
        <TradeCreateModal
          sourceItem={tradeSourceItem}
          onClose={() => {
            setTradeCreateOpen(false);
            setTradeSourceItem(null);
          }}
          onCreated={() => {
            setInventoryTab("trades");
            fetchTrades();
            setNotice("Обмен отправлен!");
            setTimeout(() => setNotice(""), 3000);
          }}
        />
      )}

      {inventoryTab === "history" && (
        <div className="space-y-8">
          {/* Завершённые обмены */}
          <div>
            <h3 className="mb-3 font-display text-lg font-bold">
              Обмены ({tradeHistory.length})
            </h3>
            {tradeHistory.length === 0 && (
              <div className="rounded-2xl border border-dashed border-card-border bg-card p-8 text-center text-sm text-muted-foreground">
                Здесь появятся завершённые обмены
              </div>
            )}
            <div className="space-y-3">
              {tradeHistory.map((t) => {
                const iGave = t.fromUserId === currentUserId;
                const iReceived = iGave ? t.toItems : t.fromItems;
                const iSent = iGave ? t.fromItems : t.toItems;
                const statusText =
                  t.status === "accepted"
                    ? "✅ Принят"
                    : t.status === "declined"
                      ? "❌ Отклонён"
                      : t.status === "cancelled"
                        ? "🚫 Отменён"
                        : t.status;
                const counterpart = iGave ? t.toUserId : t.fromUserId;
                return (
                  <div key={t.id} className="rounded-2xl border border-card-border bg-card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-bold">
                        {iGave ? "С" : "От"}{" "}
                        <span className="font-mono">{counterpart}</span>
                        <span className="ml-2 text-muted-foreground">
                          ·{" "}
                          {t.resolvedAt
                            ? new Date(t.resolvedAt).toLocaleDateString("ru-RU", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                      <span className="rounded-lg bg-muted px-2 py-1 text-[10px] font-bold">
                        {statusText}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-[#f6dfd7]/40 p-2">
                        <div className="mb-2 text-[10px] font-bold uppercase text-primary">
                          Вы отдали
                        </div>
                        <div
                          className="grid gap-2"
                          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}
                        >
                          {iSent.map((it) => (
                            <TradeItemMiniCard key={it.id} item={it} getMarketPrice={getMarketPrice} tone="primary" />
                          ))}
                          {iSent.length === 0 && (
                            <div className="text-[10px] italic text-muted-foreground">ничего</div>
                          )}
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#dceae3]/40 p-2">
                        <div className="mb-2 text-[10px] font-bold uppercase text-accent">
                          Вы получили
                        </div>
                        <div
                          className="grid gap-2"
                          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}
                        >
                          {iReceived.map((it) => (
                            <TradeItemMiniCard key={it.id} item={it} getMarketPrice={getMarketPrice} tone="accent" />
                          ))}
                          {iReceived.length === 0 && (
                            <div className="text-[10px] italic text-muted-foreground">ничего</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Дропы из кейсов */}
          <div>
            <h3 className="mb-3 font-display text-lg font-bold">
              Дропы из кейсов ({caseDrops.length})
            </h3>
            {caseDrops.length === 0 && (
              <div className="rounded-2xl border border-dashed border-card-border bg-card p-8 text-center text-sm text-muted-foreground">
                Здесь появятся ваши дропы
              </div>
            )}
            <div className="space-y-1.5">
              {caseDrops.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-xl border border-card-border bg-card px-3 py-2.5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
                    {d.dropCategory === "vip" ? "👑" : d.dropCategory === "dice" ? "🎲" : "🎁"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">
                      {d.dropName}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Из кейса «{d.caseName}» ·{" "}
                      {new Date(d.createdAt).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {sellTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#29233e]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-card-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">продажа</div>
                <h2 className="mt-1 font-display text-2xl font-bold">Выставить на рынок</h2>
                <p className="mt-1 text-xs text-muted-foreground">«{sellTarget.name}»</p>
              </div>
              <button onClick={() => { setSellTarget(null); setSellError(""); }} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                <X size={18} />
              </button>
            </div>
            {sellError && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-[#f6dfd7] px-3 py-2 text-xs font-medium text-primary">
                {sellError}
              </div>
            )}
            <label className="mt-5 block text-xs font-bold">
              Цена в Coins
              <input
                type="number"
                min="1"
                autoFocus
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
              />
                 <span className="mt-1 block text-[10px] text-muted-foreground">
                Рекомендуемая цена: {getRecommendedPrice(sellTarget)} Coins
              </span>
              {Number(sellPrice) > 0 && (
                <div className="mt-2 rounded-lg bg-[#f3e7c8]/60 px-3 py-2 text-[11px] leading-4 text-[#7e5f1d]">
                  Выставить за <b>{Number(sellPrice).toLocaleString("ru-RU")}</b> Coins.
                  <br />
                  Вы получите: <b>{Math.round(Number(sellPrice) * 0.9).toLocaleString("ru-RU")}</b> Coins
                  <span className="text-[#7e5f1d]/70"> (−10% комиссия платформы)</span>
                </div>
              )}
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setSellTarget(null);
                  setSellError("");
                }}
                className="rounded-xl border border-input px-4 py-2.5 text-xs font-bold"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  setSellError("");
                  const amount = Number(sellPrice);
                  if (!Number.isFinite(amount) || amount < 1) {
                    setSellError("Введите корректную цену");
                    return;
                  }
                  socket.emit('add-market-listing', {
                    item: sellTarget,
                    seller: getSessionUserName(),
                    sellerId: currentUserId || "",
                    price: amount,
                  }, (response: any) => {
                    if (response?.success) {
                      const updatedInventory = inventory.filter(i => i.id !== sellTarget.id);
                      setInventory(updatedInventory);
                      if (currentUserId) {
                        socket.emit('save-user-data', { userId: currentUserId, newData: { ...JSON.parse(localStorage.getItem("arena-user-data-" + currentUserId) || "{}"), inventory: updatedInventory } });
                      }
                      setNotice(`«${sellTarget.name}» выставлен на рынке!`);
                      setSellTarget(null);
                    } else {
                      setSellError(response?.error || "Не удалось выставить на рынок");
                    }
                  });
                }}
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
              >
                Выставить за {sellPrice || 0} Coins
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Market() {
  const [coins, setCoins] = useLocalStorage("arena-coins", 2400);
    const [inventory, setInventory] = useServerSync<OwnedItem[]>(
    "arena-inventory",
    [],
    ['user-inventory-updated'],
    'get-user-inventory'
  );
  const [listings] = useServerSync<Listing[]>(
    "arena-market",
    [],
    ['market-listings', 'market-listings-updated'],
    'get-market-listings'
);
  const [marketItems] = useServerSync<MarketItem[]>(
    "arena-market-items",
    [],
    ['custom-items-updated'],
    'get-custom-items'
  );
  const [filter, setFilter] = useState<"all" | ItemType>("all");
  const [selected, setSelected] = useState("");
  const [price, setPrice] = useState("500");
  const [notice, setNotice] = useState("");
  const currentUserId = getSessionUserId();
  const visible = listings.filter(
    (l) => filter === "all" || l.item.type === filter,
  );
  const typeName = (type: ItemType) =>
    type === "dice" ? "Кубики" : type === "token" ? "Фишки" : "Темы поля";
  const getRecommendedPrice = (item: OwnedItem | null): number => {
  if (!item) return 0;
  // Ищем другие объявления с таким же предметом (по id или имени)
  const sameItemListings = listings.filter(
    (l) => l.item.id === item.id || l.item.name === item.name
  );
  if (sameItemListings.length > 0) {
    const avg = sameItemListings.reduce((sum, l) => sum + l.price, 0) / sameItemListings.length;
    return Math.round(avg);
  }
  // Если нет подобных — 95% от базовой цены
  return Math.round(item.price * 0.95);
};
  const sell = (e: FormEvent) => {
  e.preventDefault();
  const item = inventory.find((i) => i.id === selected);
  const amount = Number(price);
  if (!item || !Number.isFinite(amount) || amount < 1) return;
  // Отправляем на сервер
  socket.emit('add-market-listing', {
    item,
    seller: getSessionUserName(),
    sellerId: currentUserId || "you",
    price: amount
  }, (response: any) => {
    if (response?.success) {
      // Только после успешного ответа удаляем из инвентаря
      const updatedInventory = inventory.filter((i) => i.id !== selected);
      setInventory(updatedInventory);
      setSelected("");
      setNotice(`«${item.name}» выставлен на рынке.`);
      
      if (currentUserId) {
        socket.emit('save-user-data', { userId: currentUserId, newData: { ...JSON.parse(localStorage.getItem("arena-user-data-" + currentUserId) || "{}"), inventory: updatedInventory } });
      }
    } else {
      setNotice(response?.error || "Не удалось выставить на рынок.");
    }
  });
};
  const buy = (listing: Listing) => {
  if (listing.sellerId === currentUserId) return;
  if (coins < listing.price) {
    setNotice("Недостаточно Coins для этой сделки.");
    return;
  }
  socket.emit('buy-market-listing', { listingId: listing.id, buyerId: currentUserId || "you" }, (response: any) => {
    if (response?.success) {
      const purchasedItem = response.item;
      // VIP-товар — продлеваем локально, инвентарь придёт с сервера
      if (purchasedItem.category === "vip") {
        const vipDuration = purchasedItem.vipDuration || 7;
        const currentVipUntil = localStorage.getItem("arena-vip-until");
        let baseTime = (currentVipUntil && new Date(currentVipUntil) > new Date()) ? new Date(currentVipUntil).getTime() : Date.now();
        const vipEnd = new Date(baseTime + vipDuration * 24 * 60 * 60 * 1000);
        localStorage.setItem("arena-vip-until", vipEnd.toISOString());
        window.dispatchEvent(new Event("arena-wallet-updated"));
        setNotice(`VIP продлён до ${vipEnd.toLocaleDateString("ru-RU")}!`);
      } else {
        setNotice(`Покупка завершена: «${listing.item.name}» в инвентаре.`);
      }

      // Синхронизируем баланс и инвентарь с сервера — источник правды только он.
      if (currentUserId) {
        socket.emit('get-user-data', currentUserId, (res: any) => {
          if (res?.success && res.data) {
            localStorage.setItem("arena-user-data-" + currentUserId, JSON.stringify(res.data));
            localStorage.setItem("arena-coins", String(res.data.coins || 0));
            localStorage.setItem("arena-inventory", JSON.stringify(res.data.inventory || []));
            if (res.data.vipUntil) localStorage.setItem("arena-vip-until", res.data.vipUntil);
            setCoins(res.data.coins || 0);
            setInventory(res.data.inventory || []);
            window.dispatchEvent(new Event("arena-wallet-updated"));
          }
        });
      }
    } else {
      setNotice(response?.error || "Не удалось купить");
    }
  });
};
  return (
    <div className="animate-rise">
      <SectionHeading
  eyebrow="обмен клуба"
  title="Рынок"
  detail="Продавай предметы и находи редкие скины."
        action={
          <div className="flex items-center gap-2 rounded-xl bg-[#f3e7c8] px-4 py-2.5 text-sm font-bold text-[#7e5f1d]">
            <Coins size={17} /> {coins.toLocaleString("ru-RU")} Coins
          </div>
        }
      />
      {notice && (
        <div className="mb-4 rounded-xl bg-[#dceae3] px-4 py-3 text-sm font-medium text-accent">
          {notice}
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[.7fr_1.3fr]">
        <form
          onSubmit={sell}
          className="h-fit rounded-2xl border border-card-border bg-card p-5"
        >
          <div className="flex items-center gap-2">
            <Gavel size={18} className="text-primary" />
            <h2 className="font-display text-xl font-bold">
              Выставить предмет
            </h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Предмет исчезнет из инвентаря до завершения сделки.
          </p>
          <label className="mt-5 block text-xs font-bold">
            Предмет
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
            >
              <option value="">Выбери предмет</option>
              {inventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-xs font-bold">
    Цена в Coins
    <input
      type="number"
      min="1"
      value={price}
      onChange={(e) => setPrice(e.target.value)}
      className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
    />
    {selected && (
      <span className="mt-1 block text-[10px] text-muted-foreground">
        Рекомендуемая цена: {getRecommendedPrice(inventory.find(i => i.id === selected) || null)} Coins
      </span>
    )}
    {Number(price) > 0 && (
      <div className="mt-2 rounded-lg bg-[#f3e7c8]/60 px-3 py-2 text-[11px] leading-4 text-[#7e5f1d]">
        Вы получите: <b>{Math.round(Number(price) * 0.9).toLocaleString("ru-RU")}</b> Coins
        <span className="text-[#7e5f1d]/70"> (−10% комиссия)</span>
      </div>
    )}
</label>
          <button
            type="submit"
            disabled={!selected}
            className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            Опубликовать объявление
          </button>
        </form>
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              ["all", "Все"],
              ["dice", "Кубики"],
              ["token", "Фишки"],
              ["board", "Темы поля"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value as "all" | ItemType)}
                className={`rounded-full px-3 py-2 text-xs font-bold ${filter === value ? "bg-[#29233e] text-white" : "bg-card text-muted-foreground border border-card-border"}`}
              >
                {label}
              </button>
            ))}
          </div>
             <div className="flex flex-wrap gap-4">
              {visible.map((listing) => {
              const rarityColor = listing.item.rarity === "common" ? "#b0b0b0" : listing.item.rarity === "rare" ? "#2563eb" : listing.item.rarity === "epic" ? "#9b5de5" : "#b0b0b0";
              const sourceMarketItem = findMarketItemForOwned(listing.item, marketItems);
              const sz = getCardSize(sourceMarketItem ?? listing.item);
              return (
                <div
                key={listing.id}
                className="lift overflow-hidden rounded-2xl border border-card-border bg-card flex flex-col"
                style={{ width: `${sz.cardWidth}px` }}
              >
                <div
                  className="relative flex items-center justify-center overflow-hidden bg-[#fdfaf5]"
                  style={{ height: `${sz.imageHeight}px` }}
                >
                  {listing.item.imageDataUrl ? (
                    <img
                      src={listing.item.imageDataUrl}
                      alt={listing.item.name}
                      className="h-full w-full object-contain p-3"
                      style={{ transform: `scale(${sz.shopScale / 100})` }}
                    />
                  ) : (
                    <div className="text-5xl">{listing.item.type === "board" ? "🃏" : listing.item.type === "dice" ? "🎲" : "🎁"}</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: rarityColor }} />
                </div>
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <div>
                    <h3 className="truncate font-bold">{listing.item.name}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {typeName(listing.item.type)} · {listing.item.rarity}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Продавец: {listing.seller}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                    <span className="flex items-center gap-1 font-mono text-sm font-bold">
                      <Coins size={14} className="text-[#b18428]" />
                      {listing.price}
                    </span>
                    {listing.sellerId === currentUserId ? (
                     <button
                        onClick={() => {
                          socket.emit('remove-market-listing', { listingId: listing.id, userId: currentUserId || "you" }, (response: any) => {
                            if (response?.success) {
                              setNotice("Объявление снято, предмет возвращён в инвентарь.");
                              // Синхронизируем инвентарь локально
                              if (Array.isArray(response.inventory)) {
                                setInventory(response.inventory);
                                localStorage.setItem("arena-inventory", JSON.stringify(response.inventory));
                                if (currentUserId) {
                                  const userDataKey = "arena-user-data-" + currentUserId;
                                  const existing = JSON.parse(localStorage.getItem(userDataKey) || "{}");
                                  localStorage.setItem(userDataKey, JSON.stringify({ ...existing, inventory: response.inventory }));
                                }
                              }
                            } else {
                              setNotice(response?.error || "Ошибка удаления");
                            }
                          });
                        }}
                         className="rounded-lg bg-[#f6dfd7] px-2 py-1.5 text-[10px] font-bold text-primary hover:bg-[#efcec2] whitespace-nowrap"
                      >
                        Снять
                      </button>
                    ) : (
                      <button
                        onClick={() => buy(listing)}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                      >
                        Купить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
            })}
          </div>
          {visible.length === 0 && (
            <div className="rounded-2xl border border-dashed border-card-border bg-card p-12 text-center text-sm text-muted-foreground">
              Объявлений в этом разделе пока нет.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Profile({ onInventory, onOpenWallet, player }: { onInventory: () => void; onOpenWallet?: () => void; player?: AuthUser | null }) {
  const [name, setName] = useState(player?.name || "Гость");
  const [saved, setSaved] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(player?.avatar || null);
  const [avatarError, setAvatarError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Синхронизация avatar из player, если он поменялся извне
  useEffect(() => {
    setAvatar(player?.avatar || null);
  }, [player?.avatar]);

  const handleAvatarFile = async (file: File) => {
    setAvatarError("");
    setAvatarUploading(true);
    try {
      const base64 = await compressAvatar(file);
      if (!player?.id) throw new Error("Нет ID игрока");
      socket.emit(
        "update-avatar",
        { userId: player.id, avatar: base64 },
        (res: any) => {
          setAvatarUploading(false);
          if (res?.success) {
            setAvatar(base64);
            // Обновляем сессию в localStorage — чтобы шапка тоже подхватила
            try {
              const raw = localStorage.getItem("arena-session-user");
              if (raw && raw !== "null") {
                const u = JSON.parse(raw);
                u.avatar = base64;
                localStorage.setItem("arena-session-user", JSON.stringify(u));
                window.dispatchEvent(new Event("arena-user-updated"));
              }
            } catch {}
          } else {
            setAvatarError(res?.error || "Не удалось сохранить");
          }
        }
      );
    } catch (e: any) {
      setAvatarUploading(false);
      setAvatarError(e?.message || "Ошибка загрузки");
    }
  };
  const userData = useMemo(() => {
    if (player?.id) {
      const saved = localStorage.getItem("arena-user-data-" + player.id);
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  }, [player]);
  const inventory = userData?.inventory || [];
  const save = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  return (
    <div className="animate-rise">
      <SectionHeading
  eyebrow="карточка игрока"
  title="Профиль"
  detail="Твоя история, титул и имущество на виду."
      />
      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-2xl bg-[#29233e] p-6 text-[#f7f0e3]">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar
                initials={player?.initials || "Г"}
                color={player?.color || "#32786d"}
                size="lg"
                avatar={avatar}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#e96852] text-white shadow-md hover:brightness-95 disabled:opacity-50"
                title="Загрузить аватарку"
              >
                {avatarUploading ? "…" : <Upload size={12} />}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[.2em] text-[#e7ba68]">{player?.id || "MA-XXXX"}
              </div>
              <h2 className="mt-1 font-display text-2xl font-bold">{name}</h2>
              <div className="mt-1 text-xs text-[#bbb4c5]">
                Уровень {getLevelInfo(userData?.stats?.xp ?? 0).level}
              </div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3 border-t border-white/10 pt-5 text-center">
            <div>
              <div className="font-mono text-xl font-bold">{userData?.stats?.wins ?? 0}</div>
              <div className="text-[10px] text-[#aaa2b4]">побед</div>
            </div>
            <div>
              <div className="font-mono text-xl font-bold">{userData?.stats?.games ? Math.round((userData.stats.wins / userData.stats.games) * 100) + "%" : "0%"}</div>
              <div className="text-[10px] text-[#aaa2b4]">винрейт</div>
            </div>
            <div>
              <div className="font-mono text-xl font-bold">{Math.floor((userData?.minutesOnline ?? 0) / 60) + " ч"}</div>
              <div className="text-[10px] text-[#aaa2b4]">на арене</div>
            </div>
          </div>
          {avatarError && (
            <div className="mt-3 rounded-lg bg-[#e96852]/20 px-3 py-2 text-[11px] font-medium text-[#ff8a75]">
              {avatarError}
            </div>
          )}
                    <div className="mt-6">
            {(() => {
              const xp = userData?.stats?.xp ?? 0;
              const { level, totalXp, nextThreshold } = getLevelInfo(xp);
              const percent = Math.min(100, Math.max(0, (totalXp / nextThreshold) * 100));
              return (
                <>
                  <div className="mb-2 flex justify-between text-[11px]">
                    <span>Всего XP · до {level + 1} уровня</span>
                    <span className="font-mono text-[#e7ba68]">{totalXp} / {nextThreshold} XP</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#e96852] to-[#e7ba68] transition-all duration-700 ease-out"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </>
              );
            })()}
          </div>
          {(() => {
  const vipUntil = localStorage.getItem("arena-vip-until");
  if (!vipUntil) return null;
  const endDate = new Date(vipUntil);
  if (endDate < new Date()) return null;
  const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return (
    <div className="mt-4 rounded-xl bg-[#d3a247] p-3 text-white">
      <div className="flex items-center justify-between">
        <span className="font-bold">VIP активен</span>
        <span className="font-mono">осталось {daysLeft} дн.</span>
      </div>
      <div className="mt-1 text-[10px] opacity-80">
        До {endDate.toLocaleDateString("ru-RU")}
      </div>
    </div>
  );
})()}
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold">Настройки игрока</h2>
            <div className="flex items-center gap-2">
              {onOpenWallet && (
                <button
                  onClick={onOpenWallet}
                  className="flex items-center gap-2 rounded-lg bg-[#f3e7c8] px-3 py-2 text-xs font-bold text-[#7e5f1d] hover:brightness-95"
                >
                  <Coins size={14} /> Кошелёк
                </button>
              )}
              <button
                onClick={onInventory}
                className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-bold"
              >
                <Package size={14} /> Инвентарь · {inventory.length}
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold">
              Никнейм
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="text-xs font-bold">
              Уникальный ID
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-input bg-muted px-3 py-2.5 text-sm font-normal text-muted-foreground">
  <Hash size={15} /> {player?.id || "MA-XXXX"}
</div>
            </label>
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">Приглашения в партии</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Получать запросы от друзей и клуба
                </div>
              </div>
              <div className="h-6 w-11 rounded-full bg-accent p-1">
                <div className="h-4 w-4 translate-x-5 rounded-full bg-white" />
              </div>
            </div>
          </div>
          <button
            onClick={save}
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            {saved ? <Check size={16} /> : <Download size={16} />}{" "}
            {saved ? "Сохранено" : "Сохранить изменения"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BoardGame({ onExit, initialRoomId, currentUser }: { onExit: () => void; initialRoomId?: string | null; currentUser?: AuthUser | null }) {
  const [settings] = useServerSync<AdminSettings>(
  "arena-admin-settings",
  defaultSettings,
  ['admin-settings', 'admin-settings-updated'],
  'get-admin-settings'
);
const [cardDesigns] = useServerSync<CardDesign[]>(
  "arena-card-designs",
  [],
  ['card-designs', 'card-designs-updated'],
  'get-card-designs'
);
const [marketItems] = useServerSync<MarketItem[]>(
  "arena-market-items",
  [],
  ['custom-items-updated'],
  'get-custom-items'
);
useEffect(() => { globalCardDesigns = cardDesigns; }, [cardDesigns]);

    // Синхронизация активных скинов игрока при переключении в Inventory
  useEffect(() => {
    const handler = () => {
      const skins = JSON.parse(localStorage.getItem("arena-active-skins") || "{}").activeSkins || {};
      if (!skins || Object.keys(skins).length === 0) return;
      setGlobalCustomSkins(prev => ({ ...prev, ...skins }));
    };
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("storage", handler);
    };
  }, []);

    // Игроки приходят из пропсов, если игра мультиплеерная
  const [players, setPlayers] = useState<Player[]>([]);
  const playersRef = useRef<Player[]>([]);
  const [rolled, setRolled] = useState(false);
  const [owners, setOwners] = useState<Record<number, string>>({});

      // Пересчёт глобальных скинов при изменении players или marketItems
  useEffect(() => {
    if (!players || players.length === 0) return;
    if (!marketItems || marketItems.length === 0) return;
    const playersWithSkins = players.filter(p => p && p.activeSkins && Object.keys(p.activeSkins).length > 0);
    if (playersWithSkins.length === 0) return;

    const activeSlots: Record<number, { vip: boolean; playerId: string }[]> = {};
    playersWithSkins.forEach((p: any) => {
      const skins = p.activeSkins || {};
      Object.keys(skins).forEach((slotKey) => {
        const slot = Number(slotKey);
        if (!activeSlots[slot]) activeSlots[slot] = [];
        activeSlots[slot].push({ vip: !!p.isVip, playerId: p.id });
      });
    });

    const resolvedSkins: Record<number, string> = {};
    Object.keys(activeSlots).forEach((slotKey) => {
      const slot = Number(slotKey);
      const item = marketItems.find(
        (m) => m.category === "card" && m.slotIndex === slot && m.isActive !== false
      );
      if (item) resolvedSkins[slot] = item.id;
    });

        setGlobalCustomSkins((prev) => ({ ...prev, ...resolvedSkins }));
  }, [players, marketItems]);

  const [isDoubleRoll, setIsDoubleRoll] = useState(false);
  const [doubleCount, setDoubleCount] = useState(0);
const diceRollingRef = useRef(false);
const isSpinningRef = useRef(false);
const timeLeftRef = useRef(45);
  const turnRef = useRef(0);
  const ownersRef = useRef<Record<number, string>>({});
  const improvementsRef = useRef<Record<number, number>>({});
  const mortgagesRef = useRef<Record<number, number>>({});
  const jackpotRef = useRef(0);
  const globalTurnCounterRef = useRef(0);
  const gameOverRef = useRef(false);
  const isRemoteUpdate = useRef(false);
  const lastReceivedStateRef = useRef("");
  const remoteAppliedAtRef = useRef(0);
  const movingPlayerIdRef = useRef<string | null>(null);
  const rolledRef = useRef(false); // <--- ДОБАВЛЕНО
  const isDoubleRollRef = useRef(false); // <--- ДОБАВЛЕНО
  const doubleCountRef = useRef(0); // счётчик дублей подряд, синхронный (state асинхронен)
  const rewardRef = useRef<string | null>(null);
  const rewardGivenRef = useRef(false); // защита от повторного начисления
  const eliminationOrderRef = useRef<string[]>([]); // порядок выбывания по банкротству
  // Refs на функции, которые вызываются из socket.on. Без этого они
  // замыкаются на state первого рендера (alive=[], players=[] и т.д.) —
  // и вместо голосования при тайм-ауте клиент сразу банкротит (alive.length <= 1 на пустом массиве).
  const handleTimeoutRef = useRef<(playerId?: string) => void>(() => {});
  const bankruptPlayerRef = useRef<(index: number, reason: string) => void>(() => {});
  const advanceTurnRef = useRef<(fromIdx?: number, forceNext?: boolean) => void>(() => {});
  const finishGameRef = useRef<() => void>(() => {});
  const handleVoluntaryLeaveRef = useRef<(playerId: string) => void>(() => {});
  const addLogRef = useRef<(entry: string, type?: "default" | "special") => void>(() => {});
  const auctionDeclineRef = useRef<() => void>(() => {});
  const auctionRef = useRef<AuctionState | null>(null);
  const pendingActionRef = useRef<PendingAction | null>(null);
  const pendingTradeRef = useRef<{
    initiatorId: string;
    trade: TradeState;
  } | null>(null);
  const pendingJailMovementRef = useRef<{ d1: number; d2: number; capturedTurn: number } | null>(null);
  const [turn, setTurn] = useState(0);
  // Триггер принудительной отправки sync-game-state. Если его увеличить —
  // useEffect с deps сработает и снапшот улетит немедленно, не дожидаясь
  // изменения owners/turn и т.д. Нужно, чтобы наблюдатели сразу видели
  // смену позиции после испытания (иначе телепорт виден только
  // после следующего действия игрока).
  const [syncNudge, setSyncNudge] = useState(0);
  const [turnFlash, setTurnFlash] = useState(false);
  const [mortgages, setMortgages] = useState<Record<number, number>>({});
  const [globalTurnCounter, setGlobalTurnCounter] = useState(0);
  const getRent = (cellIdx: number, impr: Record<number, number>) => {
  if (mortgages[cellIdx] !== undefined && mortgages[cellIdx] > globalTurnCounter) return 0;
  // Базовая рента = 10% от стоимости поля
  const basePrice = getCell(cellIdx).price ?? 0;
  let multiplier = RENT_MULTIPLIERS[Math.min(impr[cellIdx] ?? 0, 5)];

  // Монополия: если владелец поля владеет всей группой этой категории,
  // рента удваивается (аналог автоматического улучшения в других играх).
  // Берём owners из ref — функция вызывается и после анимации, где state
  // owners может быть устаревшим.
  // Монополия ×2 работает ТОЛЬКО на уровне 0 (без филиалов).
  // Как только появился первый филиал — обычная формула по уровню,
  // без бонуса монополии.
  const currentLevel = impr[cellIdx] ?? 0;
  if (currentLevel === 0) {
    const ownersNow = ownersRef.current;
    const ownerId = ownersNow[cellIdx];
    if (ownerId) {
      const group = getCellGroup(cellIdx);
      if (group && group.cells.length > 0) {
        const allOwned = (group.cells as readonly number[]).every(
          (ci) => ownersNow[ci] === ownerId,
        );
        if (allOwned) multiplier *= 2;
      }
    }
  }

  const rent = basePrice * 0.1 * multiplier * modeConfig.rentMultiplier;
  return Math.round(rent / 10) * 10;
};

  const [dice, setDice] = useState<[number, number]>([2, 3]);
  const [targetDice, setTargetDice] = useState<[number, number]>([2, 3]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { diceRollingRef.current = diceRolling; }, [diceRolling]);
  useEffect(() => { isSpinningRef.current = isSpinning; }, [isSpinning]);
  const [jackpot, setJackpot] = useState(0);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [improvements, setImprovements] = useState<Record<number, number>>({});
  const [improvedGroupsThisTurn, setImprovedGroupsThisTurn] = useState<
    number[]
  >([]);
  const [animPath, setAnimPath] = useState<number[] | null>(null);
  const animPathRef = useRef<number[] | null>(null);
useEffect(() => { animPathRef.current = animPath; }, [animPath]);
  const [animStep, setAnimStep] = useState(0);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [selectedPos, setSelectedPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
    const [jailPaymentPending, setJailPaymentPending] = useState(false);
    const [fireTrailAnim, setFireTrailAnim] = useState<{
    from: number;
    to: number;
    playerId: string;
  } | null>(null);
  // (удалено — скорость теперь константа 320ms)
  const [diagonalAnim, setDiagonalAnim] = useState<{ from: number; to: number; playerId: string } | null>(null);

    // ---- ИСПРАВЛЕННАЯ СИНХРОНИЗАЦИЯ ----
  const joinedRef = useRef(false); // <-- ЗАЩИТА ОТ ПОВТОРНОГО ОТПРАВЛЕНИЯ

  // ---- НАЧАЛО ВСТАВКИ: СИНХРОНИЗАЦИЯ ИГРОКОВ И СОЛО-ГЕНЕРАЦИЯ ----
  useEffect(() => {
    // Если это соло-игра (нет ID комнаты) — создаём локальных игроков
    if (!initialRoomId) {
      let maxPlayers = 4;
      try {
        const savedMax = localStorage.getItem("arena-lobby-maxPlayers");
        if (savedMax) {
          const parsed = parseInt(savedMax, 10);
          if (parsed >= 2 && parsed <= 6) maxPlayers = parsed;
        }
      } catch {}

      let me: { name: string; initials: string; color: string; avatar?: string | null } = {
        name: "Игрок",
        initials: "ИГ",
        color: "#e96852",
        avatar: null,
      };
      try {
        const stored = localStorage.getItem("arena-session-user");
        if (stored) {
          const u = JSON.parse(stored) as AuthUser;
          if (u?.name) {
            const parts = u.name.trim().split(/\s+/);
            const initials = parts.slice(0, 2).map((p: string) => p[0]).join("").toUpperCase();
            me = { name: u.name, initials: u.initials || initials, color: PLAYER_COLORS[0], avatar: u.avatar || null };
          }
        } else {
          const nickname = localStorage.getItem("arena-nickname");
          if (nickname) {
            const parts = nickname.trim().split(/\s+/);
            const initials = parts.slice(0, 2).map((p: string) => p[0]).join("").toUpperCase();
            me = { name: nickname, initials, color: PLAYER_COLORS[0] };
          }
        }
      } catch {}

      function shuffleArray<T>(array: T[]): T[] {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      }

      const localPlayers = initialPlayers
        .slice(0, maxPlayers)
        .map((p) =>
          p.id === "you"
            ? { ...p, ...me, money: settings.startCapital, position: 0 }
            : { ...p, money: settings.startCapital, position: 0 },
        );
      setPlayers(shuffleArray(localPlayers));
      // Для соло-игры сами ставим кастомные скины из localStorage
      const localSkins = JSON.parse(localStorage.getItem("arena-active-skins") || "{}").activeSkins || {};
      setGlobalCustomSkins(localSkins);
      return;
    }

    // Если игра уже запущена в мультиплеере, больше не отправляем запрос
    if (joinedRef.current) return;
    joinedRef.current = true;

        // Выбираем случайный индекс цвета от 0 до 4
    const randomColorIndex = Math.floor(Math.random() * PLAYER_COLORS.length);

    let me = {
      id: currentUser?.id || "you",
      name: currentUser?.name || "Игрок",
      initials: currentUser?.initials || "ИГ",
      color: PLAYER_COLORS[randomColorIndex], // <-- ТЕПЕРЬ ЦВЕТ СЛУЧАЙНЫЙ
      money: settings.startCapital,
      position: 0,
      vipUntil: localStorage.getItem("arena-vip-until") || undefined,
      activeSkins: JSON.parse(localStorage.getItem("arena-active-skins") || "{}").activeSkins || {},
      avatar: currentUser?.avatar || null,
    };

    if (initialRoomId) {
      console.log("Отправляем enter-game-room для комнаты:", initialRoomId);
      socket.emit('enter-game-room', { roomId: initialRoomId, playerData: me });
    }

    const handlePlayersUpdate = (serverPlayers: any[]) => {
  console.log("✅ Игроки получены от сервера:", serverPlayers);
  // ВАЖНО: убираем null и undefined из массива, чтобы не сломать игру!
  const cleanPlayers = serverPlayers.filter(p => p !== null && p !== undefined);
  if (!cleanPlayers || cleanPlayers.length === 0) {
    console.warn("⚠️ Сервер прислал пустой список игроков, пропускаем рендер...");
    return;
  }
  setPlayers(cleanPlayers);
    remoteAppliedAtRef.current = Date.now();

      const resolveGameDesigns = (serverPlayers: any[]) => {
    if (!serverPlayers || serverPlayers.length === 0) return;
    if (!marketItems || marketItems.length === 0) return;
    // Собираем какие слоты вообще активированы (без анализа конкретного ID)
    const activeSlots: Record<number, { vip: boolean; playerId: string }[]> = {};

    serverPlayers.forEach((p: any) => {
      if (!p) return;
      const skins = p.activeSkins || {};
      Object.keys(skins).forEach((slotKey) => {
        const slot = Number(slotKey);
        if (!activeSlots[slot]) activeSlots[slot] = [];
        activeSlots[slot].push({ vip: !!p.isVip, playerId: p.id });
      });
    });

    const resolvedSkins: Record<number, string> = {};
    Object.keys(activeSlots).forEach((slotKey) => {
      const slot = Number(slotKey);
      // Ищем товар-карточку в магазине по slotIndex — игнорируя конкретный id
      const item = marketItems.find(
        (m) => m.category === "card" && m.slotIndex === slot && m.isActive !== false
      );
      if (item) resolvedSkins[slot] = item.id;
    });

    setGlobalCustomSkins((prev) => ({ ...prev, ...resolvedSkins }));
  };
resolveGameDesigns(cleanPlayers);
};

    const handleBroadcastMessage = (msg: any) => {
      setChatMessages((old) => [...old, msg]);
    };

    // Принимаем игровые логи от других игроков
    const handleGameLogBroadcast = (entry: any) => {
      setLog((old) => [...old, entry].slice(-50));
    };

    // Подписываемся на события сервера строго один раз при монтировании
    socket.on('update-game-players', handlePlayersUpdate);
    socket.on('game-chat-message-broadcast', handleBroadcastMessage);

    // Анимация испытания у наблюдателей: получаем {playerId, from, to}
    // и воспроизводим ту же последовательность, что активный игрок.
    socket.on('challenge-animation-broadcast', (data: any) => {
      console.log("[challenge-anim] received", data, "myId:", currentUser?.id);
      if (!data || !data.playerId) return;
      if (data.playerId === (currentUser?.id || "you")) return;
      setFireTrailAnim({ from: data.from, to: data.to, playerId: data.playerId });
      window.setTimeout(() => {
        setPlayers((ps) =>
          ps.map((p) => (p.id === data.playerId ? { ...p, position: data.to } : p))
        );
        window.setTimeout(() => {
          setFireTrailAnim(null);
        }, 1500);
      }, 600);
    });

    // Анимация «В тюрьму» у наблюдателей: диагональный полёт фишки
    // от клетки «В тюрьму» (30) к клетке «Тюрьма» (10).
    socket.on('jail-animation-broadcast', (data: any) => {
      console.log("[jail-anim] received", data, "myId:", currentUser?.id);
      if (!data || !data.playerId) return;
      if (data.playerId === (currentUser?.id || "you")) return;
      setDiagonalAnim({ from: data.from, to: data.to, playerId: data.playerId });
      window.setTimeout(() => {
        setPlayers((ps) =>
          ps.map((p) =>
            p.id === data.playerId
              ? { ...p, position: data.to, jailTurns: modeConfig.jailAttempts, jailAttempts: 0 }
              : p,
          ),
        );
        setDiagonalAnim(null);
      }, 1200);
    });
    socket.on('game-log-add-broadcast', handleGameLogBroadcast);

    // Настройки режима с сервера. Приходят сразу после enter-game-room.
    socket.on('room-settings', (data: any) => {
      if (!data) return;
      setModeConfig({
        mode: data.mode || "Классический",
        maxPlayers: Number(data.maxPlayers) || 2,
        turnDurationSec: Number(data.turnDurationSec) || 45,
        fastMode: !!data.fastMode,
        rentMultiplier: Number(data.rentMultiplier) || 1.0,
        jailAttempts: Number(data.jailAttempts) || 3,
        passStartBonus: Number(data.passStartBonus) || 2000,
        landStartBonus: Number(data.landStartBonus) || 3000,
      });
      // Стартовый таймер сразу под режим
      if (typeof data.turnDurationSec === "number") {
        setTimeLeft(data.turnDurationSec);
      }
    });

    // Финальный экран с наградами приходит ТОЛЬКО с сервера.
    // Клиент ничего не начисляет сам.
    socket.on('game-rewards', (data: { roomId: string; results: any[] }) => {
      if (data.roomId !== initialRoomId) return;
      const myId = currentUser?.id || "you";
      const myResult = data.results.find((r) => r.userId === myId);

      let rewardText = "";
      if (!myResult || myResult.place === 0) {
        if (myResult?.leftAlive) {
          rewardText = "Вы покинули игру досрочно — без награды.";
        } else {
          rewardText = "Награда не начислена.";
        }
      } else {
        const dropInfo = myResult.dropName ? ` · Дроп: «${myResult.dropName}»` : "";
        rewardText = `Вы заняли ${myResult.place} место: +${myResult.xp} XP и +${myResult.coins} Coins.${dropInfo}`;
      }

      // Обновляем локальные данные (coins, inventory, stats, vip)
      if (typeof myResult?.coins === "number") {
        const cur = Number(localStorage.getItem("arena-coins") || "0");
        localStorage.setItem("arena-coins", String(cur + myResult.coins));
      }

      setReward(rewardText);
      setGameOver(true);

      // Дёргаем сервер за свежими данными — они точно правильные
      if (currentUser?.id) {
        socket.emit('get-user-data', currentUser.id, (res: any) => {
          if (res?.success && res.data) {
            localStorage.setItem("arena-user-data-" + currentUser.id, JSON.stringify(res.data));
            localStorage.setItem("arena-coins", String(res.data.coins || 0));
            localStorage.setItem("arena-inventory", JSON.stringify(res.data.inventory || []));
            localStorage.setItem("arena-stats", JSON.stringify(res.data.stats || {}));
            if (res.data.vipUntil) localStorage.setItem("arena-vip-until", res.data.vipUntil);
            else localStorage.removeItem("arena-vip-until");
            // Сообщаем шапке, что кошелёк изменился
            window.dispatchEvent(new Event("arena-wallet-updated"));
          }
        });
      }
    });

            socket.on('server-roll-result', ({ d1, d2, playerId }) => {
      const steps = d1 + d2;
      const activePlayerIdx = playersRef.current.findIndex(p => p.id === playerId); 
      if (activePlayerIdx === -1) return;

      // ЕСЛИ ИГРОК В ТЮРЬМЕ, ЗАПУСКАЕМ ЛОГИКУ ТЮРЬМЫ С СЕРВЕРНЫМИ КУБИКАМИ
      const isPlayerInJail = (playersRef.current[activePlayerIdx]?.jailTurns ?? 0) > 0;
      if (isPlayerInJail) {
          if ((currentUser?.id || "you") === playerId) {
           rollJail(d1, d2, playerId);
        } else {
             // Обновляем позицию для наблюдателя
             setPlayers((prevPlayers) =>
                prevPlayers.map((p, i) => (i === activePlayerIdx ? { ...p, position: (p.position + steps) % 40 } : p))
             );
          }
          return;
      }

      const oldPos = playersRef.current[activePlayerIdx]?.position || 0;
      const isDoubles = d1 === d2;

            doRollAnimation(d1, d2, () => {
        // Третий дубль подряд — в тюрьму без движения.
        const isThirdDouble = isDoubles && doubleCountRef.current >= 2;
        if (isThirdDouble) {
          doubleCountRef.current = 0;
          setDoubleCount(0);
          setIsDoubleRoll(false);
          isDoubleRollRef.current = false;
          const cur = playersRef.current[activePlayerIdx];
          if (cur) {
            addLog(`🚔 ${cur.name} — третий дубль подряд, отправляется в тюрьму!`);
            setPlayers((ps) =>
              ps.map((p, i) =>
                i === activePlayerIdx
                  ? { ...p, position: 10, jailTurns: modeConfig.jailAttempts, jailAttempts: 0 }
                  : p,
              ),
            );
          }
          window.setTimeout(() => advanceTurn(activePlayerIdx, true), 400);
          return;
        }

        // Счётчик дублей обновляем СИНХРОННО через ref —
        // advanceTurn ниже читает его, а не устаревший state.
        if (isDoubles) {
          doubleCountRef.current += 1;
          setDoubleCount(doubleCountRef.current);
        } else {
          doubleCountRef.current = 0;
          setDoubleCount(0);
        }

                const path: number[] = [oldPos];
        for (let i = 1; i <= steps; i++) path.push((oldPos + i) % 40);
        const finalPos = path[path.length - 1];
        
        movingPlayerIdRef.current = playerId;
        setAnimStep(0);
        setAnimPath(path);

         const isMyTurn = playersRef.current[activePlayerIdx]?.id === (currentUser?.id || "you");

        if (isMyTurn) {
          // ЛОГ ДОБАВЛЯЕТСЯ ТОЛЬКО ТЕМ, КТО БРОСАЕТ
          addLog(`🎲 ${playersRef.current[activePlayerIdx]?.name} выбросил ${diceFace(d1)} ${diceFace(d2)}`);
          
          afterAnimRef.current = () => {
            setPlayers((prevPlayers) =>
              prevPlayers.map((p, i) => (i === activePlayerIdx ? { ...p, position: finalPos } : p))
            );
            setRolled(true);
            setIsDoubleRoll(isDoubles);
            isDoubleRollRef.current = isDoubles;
            processLanding(finalPos, oldPos, activePlayerIdx);
          };
        } else {
          setPlayers((prevPlayers) =>
            prevPlayers.map((p, i) => (i === activePlayerIdx ? { ...p, position: finalPos } : p))
          );
        }
      });
    });

          socket.on('update-remote-state', (data) => {
      if (data.senderId === (currentUser?.id || "you")) return;

      // ВАЖНО! Сравниваем данные...
      const stateString = JSON.stringify(data);
      if (lastReceivedStateRef.current === stateString) return;
      lastReceivedStateRef.current = stateString;
      remoteAppliedAtRef.current = Date.now();

      // Обновляем всё, что пришло (даже если игроки пустые, но владельцы/ход изменились!)
      if (data.players && data.players.length > 0) {
        setPlayers((prevPlayers) => {
          return data.players
            .filter((p: any) => p !== null && p !== undefined)
            .map((incoming: any) => {
              const existing = prevPlayers.find((p) => p.id === incoming.id);
              return {
                ...incoming,
                avatar: existing?.avatar ?? incoming.avatar ?? null,
              };
            });
        });
      }
      setOwners(data.owners);
      setImprovements(data.improvements);
      // Если ход перешёл к другому игроку — сбрасываем историю улучшений
      // этого хода. Без этого improvedGroupsThisTurn остаётся старым
      // (от моего прошлого хода), и кнопка «Улучшить» блокируется.
      if (data.turn !== turnRef.current) {
        setImprovedGroupsThisTurn([]);
      }
      setTurn(data.turn);
      setGlobalTurnCounter(data.globalTurnCounter);
      setJackpot(data.jackpot);
      setMortgages(data.mortgages || {});
      setRolled(data.rolled ?? false); 
      setIsDoubleRoll(data.isDoubleRoll ?? false); 
      
      if (data.auction) setAuction(data.auction);
      else setAuction(null); 
    });
    socket.on('timer-start', (data: any) => {
      if (!data || typeof data.endsAt !== 'number') return;
      setTimerEndsAt(data.endsAt);
      setTimerPaused(false);
      const remaining = Math.max(0, Math.ceil((data.endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      timeoutHandled.current = false;
    });

    socket.on('timer-pause', () => {
      setTimerPaused(true);
      setTimerEndsAt(0);
    });

    socket.on('timer-expired', (data: any) => {
      if (!data || data.playerId !== (currentUser?.id || "you")) return;
      setTimeLeft(0);
      handleTimeoutRef.current(data.playerId);
    });

    socket.on('vote-state', (data: any) => {
      if (!data || !data.targetId) return;
      const target = playersRef.current.find(p => p.id === data.targetId);
      if (!target) return;
      setVote({
        target,
        reason: data.reason || 'решение стола',
        votes: data.votes || {},
        endsAt: Number(data.endsAt) || (Date.now() + 30000),
      });
    });

    socket.on('vote-resolved', (data: any) => {
      setVote(null);
      addLogRef.current(
        `🗳 Голосование: ${data.yes}/${data.total} за исключение. ${data.targetName} ${data.kicked ? 'исключён' : 'оставлен'}.`,
      );
      if (data.kicked) {
        const idx = playersRef.current.findIndex(p => p.id === data.targetId);
        if (idx !== -1 && !playersRef.current[idx].bankrupt) {
          bankruptPlayerRef.current(idx, 'решение стола');
        }
      } else {
        advanceTurnRef.current(turnRef.current, true);
      }
    });

    // ВСТАВИТЬ ЭТИ 4 БЛОКА СЮДА (после закрывающей скобки update-remote-state, но внутри useEffect):
    socket.on('player-left', (playerId) => {
      // Живой игрок вышел — награды не получает, помечаем leftAlive
      handleVoluntaryLeaveRef.current(playerId);
    });

    socket.on('game-ended', () => {
      if (rewardGivenRef.current) return; // уже наградили — не дублируем
      setGameOver(true);
      window.setTimeout(() => finishGameRef.current(), 200);
    });

    socket.on('trade-proposed-broadcast', (data) => {
      const initiatorId = data.initiatorId;
      const trade = data.trade;
      const targetIdx = playersRef.current.findIndex(p => p.id === (currentUser?.id || "you"));
      const initiatorIdx = playersRef.current.findIndex(p => p.id === initiatorId);
      if (targetIdx !== -1 && initiatorIdx !== -1) {
        setTradeInitiator({ id: initiatorId, fromIdx: initiatorIdx, isDouble: data.isDoubleRoll, doubleCount: data.doubleCount });
        setPendingTrade({ initiatorId, trade });
        setTurn(targetIdx);
        setRolled(false);
      }
    });

    socket.on('trade-resolved-broadcast', ({ initiatorId }) => {
      if (initiatorId === (currentUser?.id || "you")) {
        setTrade(null);
        setPendingTrade(null);
      }
    });

    // 🌟 ВАЖНО: Тотальная очистка всех сокетов при размонтировании
        return () => {
      socket.off('update-game-players', handlePlayersUpdate);
      socket.off('game-chat-message-broadcast', handleBroadcastMessage);
      socket.off('challenge-animation-broadcast');
      socket.off('jail-animation-broadcast');
      socket.off('server-roll-result');
      socket.off('game-log-add-broadcast', handleGameLogBroadcast);
      socket.off('player-left'); // <--- ДОБАВИТЬ
      socket.off('game-ended');  // <--- ДОБАВИТЬ
      socket.off('room-settings');
      socket.off('vote-state');
      socket.off('vote-resolved');
      socket.off('timer-start');
      socket.off('timer-pause');
      socket.off('timer-expired');
      socket.off('trade-proposed-broadcast');
      socket.off('trade-resolved-broadcast');
    };
  }, [initialRoomId, settings.startCapital, currentUser]);

  // ---- КОНЕЦ ВСТАВКИ ----

  // ВСТАВИТЬ ЭТОТ БЛОК (Закрываем попап при смене хода)
  useEffect(() => {
    setSelectedCell(null);
    setSelectedPos(null);
  }, [turn]);
  // КОНЕЦ ВСТАВКИ

  // Закрываем попап при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectedCell !== null) {
        const target = event.target as HTMLElement;
        const isInsidePopup = target.closest(".z-50");
        if (!isInsidePopup) {
          setSelectedCell(null);
          setSelectedPos(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectedCell]);
  const [playerHover, setPlayerHover] = useState<{
    pid: string;
    x: number;
    y: number;
  } | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [trade, setTrade] = useState<TradeState | null>(null);
  const [pendingTrade, setPendingTrade] = useState<{
    initiatorId: string;
    trade: TradeState;
  } | null>(null);
  const [tradeInitiator, setTradeInitiator] = useState<{
    id: string;
    fromIdx: number;
    isDouble: boolean;
    doubleCount: number;
  } | null>(null);
  const [casinoPick, setCasinoPick] = useState<number[]>([]);
  const [message, setMessage] = useState(
    "Твой ход. Бросай кости — город ждёт.",
  );
  type LogEntry = {
    text: string;
    type: "default" | "special";
    timestamp: number;
  };
  const [log, setLog] = useState<LogEntry[]>([
    {
      text: "🎮 Партия началась! Стартовый капитал: 15 000 К.",
      type: "default",
      timestamp: Date.now(), // <--- Добавляем временную метку
    },
  ]);

  const [timeLeft, setTimeLeft] = useState(45);
  const [timerEndsAt, setTimerEndsAt] = useState<number>(0);
  const [timerPaused, setTimerPaused] = useState(false);

  // Drawer с инфо о партии — на мобиле и планшете выезжает поверх доски.
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  // На мобиле играть можно только в ландшафтной ориентации —
  // в портрете стол не помещается. Показываем заглушку с просьбой повернуть.
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  useEffect(() => {
    const check = () => {
      const isPortrait = window.matchMedia("(orientation: portrait)").matches;
      const isSmall = window.innerWidth < 1024;
      setIsPortraitMobile(isPortrait && isSmall);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  // Настройки режима приходят с сервера (см. событие 'room-settings').
  // Классический: аренда ×1, 3 попытки в тюрьме, +2000 за проход Старта, +3000 за клетку Старт.
  // Быстрая/Дуэль: аренда ×1.5, 1 попытка, +3000 за проход Старта, +4500 за клетку.
  const [modeConfig, setModeConfig] = useState<{
    mode: string;
    maxPlayers: number;
    turnDurationSec: number;
    fastMode: boolean;
    rentMultiplier: number;
    jailAttempts: number;
    passStartBonus: number;
    landStartBonus: number;
  }>(() => {
    // Fallback из localStorage — если room-settings ещё не пришли.
    // При создании лобби host сохраняет туда maxPlayers, при join
    // может быть пусто — тогда 2.
    let saved = 2;
    try {
      const v = parseInt(localStorage.getItem("arena-lobby-maxPlayers") || "2", 10);
      if (v >= 2 && v <= 5) saved = v;
    } catch {}
    return {
      mode: "Классический",
      maxPlayers: saved,
      turnDurationSec: 45,
      fastMode: false,
      rentMultiplier: 1.0,
      jailAttempts: 3,
      passStartBonus: 2000,
      landStartBonus: 3000,
    };
  });

  // При открытии окна действия (покупка/аренда/налог/шанс) даём игроку свежие 45 секунд
  useEffect(() => {
    if (pendingAction && initialRoomId) {
      socket.emit('timer-start', {
        roomId: initialRoomId,
        durationSec: modeConfig.turnDurationSec,
        playerId: playersRef.current[turnRef.current]?.id,
      });
      timeoutHandled.current = false;
    }
  }, [pendingAction]);
  const [socketConnected, setSocketConnected] = useState(socket.connected);

  // Следим за состоянием соединения — показываем оверлей при разрыве
  useEffect(() => {
    const onConnect = () => {
      setSocketConnected(true);
      if (initialRoomId && currentUser?.id) {
        let me = {
          id: currentUser.id,
          name: currentUser.name,
          initials: currentUser.initials,
          color: "#e63946",
          money: 0,
          position: 0,
          vipUntil: localStorage.getItem("arena-vip-until") || undefined,
          activeSkins: JSON.parse(localStorage.getItem("arena-active-skins") || "{}").activeSkins || {},
        };
        socket.emit('enter-game-room', { roomId: initialRoomId, playerData: me });
      }
    };
    const onDisconnect = () => setSocketConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // ⚡ Если сокет УЖЕ подключён на момент монтирования BoardGame —
    //    эмитим enter-game-room вручную, чтобы сервер снял флаг disconnected
    //    и отменил таймер авто-банкротства.
    if (socket.connected && initialRoomId && currentUser?.id) {
      // Небольшая задержка, чтобы основной useEffect успел положить данные
      window.setTimeout(onConnect, 50);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [initialRoomId, currentUser?.id]);
  const [vote, setVote] = useState<{
    target: Player;
    reason: string;
    votes: Record<string, "yes" | "no">;
    endsAt: number;
  } | null>(null);
  const [, forceVoteTick] = useState(0);
  const [voteLog, setVoteLog] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [reward, setReward] = useState<string | null>(null);
  useEffect(() => { turnRef.current = turn; }, [turn]);

  // Уведомление о наступлении хода: подсветка панели + звук.
  // Не срабатывает на первый рендер (prevTurn === null).
  const prevTurnForNotifRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevTurnForNotifRef.current;
    prevTurnForNotifRef.current = turn;
    if (prev === null) return;
    if (prev === turn) return;
    if (!initialRoomId) return;
    if (gameOverRef.current) return;
    const currentPlayerId = playersRef.current[turn]?.id;
    if (!currentPlayerId) return;
    if (currentPlayerId !== (currentUser?.id || "you")) return;

    playTurnSound();
    setTurnFlash(true);
    const t = window.setTimeout(() => setTurnFlash(false), 800);
    return () => window.clearTimeout(t);
  }, [turn]);
  useEffect(() => { ownersRef.current = owners; }, [owners]);
  useEffect(() => { improvementsRef.current = improvements; }, [improvements]);
  useEffect(() => { mortgagesRef.current = mortgages; }, [mortgages]);
  useEffect(() => { jackpotRef.current = jackpot; }, [jackpot]);
  useEffect(() => { rolledRef.current = rolled; }, [rolled]); // <--- ДОБАВЛЕНО
  useEffect(() => { isDoubleRollRef.current = isDoubleRoll; }, [isDoubleRoll]); // <--- ДОБАВЛЕНО
  useEffect(() => { globalTurnCounterRef.current = globalTurnCounter; }, [globalTurnCounter]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { rewardRef.current = reward; }, [reward]);
  useEffect(() => { auctionRef.current = auction; }, [auction]);
  useEffect(() => { pendingActionRef.current = pendingAction; }, [pendingAction]);
  useEffect(() => { pendingTradeRef.current = pendingTrade; }, [pendingTrade]);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { from: string; text: string; timestamp: number }[]
  >([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [chatAutoScroll, setChatAutoScroll] = useState(true);
  const [globalCustomSkins, setGlobalCustomSkins] = useState<Record<number, string>>({});
  const timeoutHandled = useRef(false);
  const voteHandled = useRef(false);
  const afterAnimRef = useRef<(() => void) | null>(null);

  const current = players && players[turn] ? players[turn] : null;
  const player = current as Player;
  // --- 3D DICE IMPLEMENTATION ---
  const getFinalAngles = (val: number) => {
    switch (val) {
      case 1:
        return { x: 0, y: 0 };
      case 2:
        return { x: 0, y: -90 };
      case 3:
        return { x: 90, y: 0 };
      case 4:
        return { x: -90, y: 0 };
      case 5:
        return { x: 0, y: 90 };
      case 6:
        return { x: 0, y: 180 };
      default:
        return { x: 0, y: 0 };
    }
  };

  const getFaceTransform = (face: number): string => {
    const half = 12; // Половина размера кубика (24px / 2)
    switch (face) {
      case 1:
        return `rotateY(0deg) translateZ(${half}px)`;
      case 2:
        return `rotateY(90deg) translateZ(${half}px)`;
      case 3:
        return `rotateX(-90deg) translateZ(${half}px)`;
      case 4:
        return `rotateX(90deg) translateZ(${half}px)`;
      case 5:
        return `rotateY(-90deg) translateZ(${half}px)`;
      case 6:
        return `rotateY(180deg) translateZ(${half}px)`;
      default:
        return `rotateY(0deg) translateZ(${half}px)`;
    }
  };

  const DieFacePips = ({ value }: { value: number }) => {
    const getPips = () => {
      switch (value) {
        case 1:
          return (
            <div className="w-1.5 h-1.5 rounded-full bg-black absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          );
        case 2:
          return (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute top-1/4 left-3/4 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2" />
            </>
          );
        case 3:
          return (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute top-1/4 left-3/4 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2" />
            </>
          );
        case 4:
          return (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute top-1/4 left-3/4 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute bottom-1/4 left-3/4 -translate-x-1/2 translate-y-1/2" />
            </>
          );
        case 5:
          return (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute top-1/4 left-3/4 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute bottom-1/4 left-3/4 -translate-x-1/2 translate-y-1/2" />
            </>
          );
        case 6:
          return (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute top-1/4 left-3/4 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2" />
              <div className="w-1.5 h-1.5 rounded-full bg-black absolute bottom-1/4 left-3/4 -translate-x-1/2 translate-y-1/2" />
            </>
          );
        default:
          return null;
      }
    };
    return <div className="relative w-full h-full">{getPips()}</div>;
  };

  const ThreeDDice = ({
    value,
    isRolling,
  }: {
    value: number;
    isRolling: boolean;
  }) => {
    const [rotX, setRotX] = useState(0);
    const [rotY, setRotY] = useState(0);

    useEffect(() => {
      let rafId: number | null = null;
      let lastTime = 0;
      const FRAME_MS = 1000 / 60; // 60 FPS
      // Пересчёт скорости: было 12–36° каждые 70мс, стало ≈2.9–8.6° каждые ~16.7мс
      const SPEED = (12 + Math.random() * 24) * (FRAME_MS / 70);

      const tick = (now: number) => {
        if (lastTime === 0) lastTime = now;
        if (now - lastTime >= FRAME_MS) {
          setRotX((prev) => (prev + SPEED) % 360);
          setRotY((prev) => (prev + SPEED) % 360);
          lastTime = now;
        }
        rafId = requestAnimationFrame(tick);
      };

      if (isRolling) {
        rafId = requestAnimationFrame(tick);
      } else {
        // При остановке плавно приходим к целевым углам
        const finalAngles = getFinalAngles(value);
        setRotX(finalAngles.x);
        setRotY(finalAngles.y);
      }
      return () => {
        if (rafId) cancelAnimationFrame(rafId);
      };
    }, [isRolling, value]);

    return (
      <div className="w-6 h-6 relative" style={{ perspective: "300px" }}>
        <div
          className="w-full h-full relative"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
            transition: isRolling
              ? "none"
              : "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((face) => (
            <div
              key={face}
              className="absolute inset-0 flex items-center justify-center bg-white rounded-[2px] border border-gray-300 shadow-sm"
              style={{
                transform: getFaceTransform(face),
              }}
            >
              <DieFacePips value={face} />
            </div>
          ))}
        </div>
      </div>
    );
  };
  // --- END 3D DICE IMPLEMENTATION ---
  const alive = players.filter((p) => !p.bankrupt);
  const total = dice[0] + dice[1];
  const inJail = (player?.jailTurns ?? 0) > 0;
const currentCellName = boardCells[player?.position ?? 0]?.name ?? "?";
  const CORNER = new Set([0, 10, 20, 30]);
  const busy =
    rolled ||
    !!vote ||
    !!pendingAction ||
    !!auction ||
    gameOver ||
    !!animPath ||
    diceRolling;
    jailPaymentPending;

  const dynamicGroups = getDynamicGroups();
const monopolyGroups = dynamicGroups.map((group, gIdx) => ({
  gIdx,
  group,
  has: player?.id ? (group.cells as readonly number[]).every((ci) => owners[ci] === player.id) : false,
})).filter((x) => x.has);
    const getCellCenterPct = (index: number) => {
    const { row, col } = cellGridPos(index);
    const sizes = [1.9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.9];
    const totalFr = 12.8;
    let xFr = 0;
    for (let i = 0; i < col - 1; i++) xFr += sizes[i];
    xFr += sizes[col - 1] / 2;
    let yFr = 0;
    for (let i = 0; i < row - 1; i++) yFr += sizes[i];
    yFr += sizes[row - 1] / 2;
    return { x: (xFr / totalFr) * 100, y: (yFr / totalFr) * 100 };
  };
  const isAnimating = !!animPath && animPath.length > 0;
  const movingPlayerId = isAnimating ? movingPlayerIdRef.current : null;
  const movingPlayer = movingPlayerId ? players.find((p) => p.id === movingPlayerId) : null;
  const movingCellIdx = animPath ? animPath[Math.min(animStep, animPath.length - 1)] : null;

  const getDisplayPos = (pid: string) => {
  if (animPath && pid === movingPlayerIdRef.current)
    return animPath[Math.min(animStep, animPath.length - 1)];
  return players.find((p) => p.id === pid)?.position ?? 0;
};

    const addLog = (entry: string, type: "default" | "special" = "default") => {
    const logEntry = { text: entry, type, timestamp: Date.now() };
    setLog((old) => [...old, logEntry].slice(-50));
    
    // Если это мультиплеер, отправляем лог на сервер, чтобы его увидели другие игроки
    if (initialRoomId) {
      socket.emit('game-log-add', { roomId: initialRoomId, entry: logEntry });
    }
  };

    // Отправляем на сервер событие о выполнении ежедневного квеста.
  // Сервер проверит, что это наш игрок, и засчитает квест.
  const emitQuestEvent = (questId: string) => {
    const myId = currentUser?.id;
    if (!myId) return;
    socket.emit('quest-event', { userId: myId, questId });
  };
    const sendChat = (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    // Отправляем сообщение на сервер в конкретную комнату
    socket.emit('game-chat-message', {
      roomId: initialRoomId,
      from: currentUser?.name || "Игрок",
      text: chatInput.trim(),
      timestamp: Date.now()
    });
    setChatInput("");
  };

  // Автоскролл вниз при новых логах/сообщениях, если пользователь у нижнего края
  useEffect(() => {
    if (!chatAutoScroll) return;
    const el = logContainerRef.current;
    if (!el) return;
    // Прокручиваем в самый низ при появлении новых данных
    el.scrollTop = el.scrollHeight;
  }, [log, chatMessages, chatAutoScroll]);

  // Если пользователь улистал вверх/в середину — через 60 сек возвращаем его вниз
  useEffect(() => {
    if (chatAutoScroll) return; // он уже внизу — таймер не нужен
    const timer = window.setTimeout(() => {
      const el = logContainerRef.current;
      if (!el) return;
      // Плавный скролл вниз
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      // Через мгновение включаем автоскролл, чтобы onScroll не отключил его обратно
      window.setTimeout(() => setChatAutoScroll(true), 400);
    }, 60_000); // 60 секунд
    return () => window.clearTimeout(timer);
  }, [chatAutoScroll]);

    const nextAliveIndex = (from: number) => {
    // Фильтруем null/undefined игроков, чтобы не было краха и застревания хода
    const validPlayers = playersRef.current.filter(p => p !== null && p !== undefined);
    if (validPlayers.length === 0) return from;

    for (let s = 1; s <= validPlayers.length; s++) {
      const i = (from + s) % validPlayers.length;
      if (!validPlayers[i].bankrupt) return i;
    }
    return from;
  };

    const advanceTurn = (fromIdx = turnRef.current, forceNext = false) => {
    const nextGlobalTurn = globalTurnCounterRef.current + 1;
    setGlobalTurnCounter(nextGlobalTurn);

    // Проверяем и очищаем истекшие залоги (если ход counter > залогового срока)
    const expired = Object.keys(mortgagesRef.current).filter(
      (key) => mortgagesRef.current[Number(key)] <= nextGlobalTurn,
    );
    if (expired.length > 0) {
      const newOwners = { ...ownersRef.current };
      const newMortgages = { ...mortgagesRef.current };
      expired.forEach((key) => {
        const idx = Number(key);
        if (newOwners[idx]) {
          addLog(
            `🏚 Залог на «${boardCells[idx].name}» истек. Поле возвращено в банк.`,
          );
          delete newOwners[idx];
          delete newMortgages[idx];
        }
      });
      setOwners(newOwners);
      setMortgages(newMortgages);
    }

    // Если это дубль (1-й или 2-й), мы не переключаем ход, а даём бросать снова тому же игроку
    if (!forceNext && isDoubleRollRef.current && doubleCountRef.current < 3) {
      setRolled(false);
      setImprovedGroupsThisTurn([]);
      timeoutHandled.current = false;
      if (initialRoomId) {
        socket.emit('timer-start', {
          roomId: initialRoomId,
          durationSec: modeConfig.turnDurationSec,
          playerId: playersRef.current[fromIdx]?.id,
        });
      }
      setMessage(`${playersRef.current[fromIdx].name}, дубль! Бросай кубики снова.`);
      return;
    }
    // Ход точно переходит — сбрасываем незавершённые состояния,
    // которые могли остаться от предыдущего хода (полоска договора).
    setPendingTrade(null);
    setTradeInitiator(null);

    const next = nextAliveIndex(fromIdx);
    setTurn(next);
    
    setRolled(false);
    setImprovedGroupsThisTurn([]);
    setDoubleCount(0);
    doubleCountRef.current = 0;
    setIsDoubleRoll(false);
    isDoubleRollRef.current = false;
    timeoutHandled.current = false;
    if (initialRoomId) {
      socket.emit('timer-start', {
        roomId: initialRoomId,
        durationSec: modeConfig.turnDurationSec,
        playerId: playersRef.current[next]?.id,
      });
    }
    setMessage(`${playersRef.current[next].name}, твой ход. Бросай кости.`);
  };
  

  // Настоящее банкротство — даёт право на награду по месту
  const bankruptPlayer = (index: number, reason: string) => {
    const allPlayers = playersRef.current;
    const targetPlayer = allPlayers[index];
    if (!targetPlayer) return;
    if (targetPlayer.bankrupt) return; // уже выбыл

    // Ежедневный квест "Сыграй 1 партию" — засчитываем только тому,
    // кто реально обанкротился внутри партии, а не вышел живым.
    if (targetPlayer.id === currentUser?.id && !targetPlayer.leftAlive) {
      emitQuestEvent("playGame");
    }

    setPlayers((old) =>
      old.map((p, i) => (i === index ? { ...p, bankrupt: true, money: 0 } : p)),
    );

    // Записываем порядок выбывания (первый — последнее место)
    if (!eliminationOrderRef.current.includes(targetPlayer.id)) {
      eliminationOrderRef.current.push(targetPlayer.id);
    }

    addLog(`💀 ${targetPlayer.name} — банкрот: ${reason}`);

    const newOwners = { ...ownersRef.current };
    const newImprovements = { ...improvementsRef.current };
    const newMortgages = { ...mortgagesRef.current };
    Object.keys(newOwners).forEach((key) => {
      const cellIdx = Number(key);
      if (newOwners[cellIdx] === targetPlayer.id) {
        delete newOwners[cellIdx];
        delete newImprovements[cellIdx];
        delete newMortgages[cellIdx];
      }
    });
    setOwners(newOwners);
    setImprovements(newImprovements);
    setMortgages(newMortgages);
    addLog(
      `🏚 Поля, постройки и залоги игрока ${targetPlayer.name} возвращены в банк.`,
    );

    const remainingAlive = allPlayers.filter((p, i) => i !== index && !p.bankrupt);
    if (remainingAlive.length <= 1) {
      setGameOver(true);
      window.setTimeout(finishGame, 300);
    } else {
      advanceTurn(index, true);
    }
  };

  // Выход живым — награду не даёт, в eliminationOrder не попадает
  const handleVoluntaryLeave = (playerId: string) => {
    const allPlayers = playersRef.current;
    const idx = allPlayers.findIndex(p => p.id === playerId);
    if (idx === -1) return;
    const leaving = allPlayers[idx];
    if (leaving.bankrupt) return; // уже выбыл — не наш случай

    setPlayers((old) =>
      old.map((p, i) => (i === idx ? { ...p, bankrupt: true, leftAlive: true, money: 0 } : p)),
    );
    addLog(`🚪 ${leaving.name} покинул игру досрочно (без награды).`);

    const remainingAlive = allPlayers.filter((p, i) => i !== idx && !p.bankrupt);
    if (remainingAlive.length <= 1) {
      setGameOver(true);
      window.setTimeout(() => finishGameRef.current(), 300);
      return;
    }

    // Игра продолжается. Нужно понять: вышел активный игрок или наблюдатель.
    if (turnRef.current === idx) {
      // Вышел тот, чей ход — передаём ход следующему, форсированно.
      // advanceTurn сам запустит timer-start на нового игрока.
      advanceTurnRef.current(idx, true);
    } else if (initialRoomId) {
      // Ход у другого — просто перезапускаем таймер на текущего активного,
      // чтобы не висел старый отсчёт (он мог быть запущен для вышедшего).
      const activeIdx = turnRef.current;
      const activeId = playersRef.current[activeIdx]?.id;
      if (activeId) {
        socket.emit('timer-start', {
          roomId: initialRoomId,
          durationSec: modeConfig.turnDurationSec,
          playerId: activeId,
        });
      }
    }
  };

    // Отправка голоса на сервер. Голосовать может каждый один раз.
  const sendVote = (value: "yes" | "no") => {
    if (!vote || !initialRoomId) return;
    const myId = currentUser?.id || "you";
    if (vote.votes[myId]) return;
    if (vote.target.id === myId) return;
    socket.emit('vote-cast', { roomId: initialRoomId, voterId: myId, value });
  };

  const handleTimeout = (expiredPlayerId?: string) => {
    if (timeoutHandled.current || animPath || diceRolling) return;

    // Если идёт аукцион — не банкротим и не голосуем.
    // Просто авто-отказ от текущего участника аукциона
    // (это должен быть именно он — timer-start идёт на него одного).
    if (auction) {
      const currentBidderId = auction.participants[auction.currentIdx];
      if (currentBidderId === (currentUser?.id || "you")) {
        timeoutHandled.current = true;
        auctionDeclineRef.current();
      }
      return;
    }

    // Тюрьма. Проверяем ДО rolled-check — при jailPaymentPending
    // rolled=true, и без этого блока handleTimeout молча вышел бы.
    const jailTargetId = expiredPlayerId || playersRef.current[turnRef.current]?.id;
    const jailTargetIdx = playersRef.current.findIndex(p => p.id === jailTargetId);
    const jailTarget = jailTargetIdx !== -1 ? playersRef.current[jailTargetIdx] : null;
    if (jailTarget && (jailTarget.jailTurns ?? 0) > 0) {
      timeoutHandled.current = true;

      // Вариант 1: обязательный выкуп (попытки исчерпаны, кнопка «Заплатить»
      // висела, игрок её не нажал). Авто-выкуп если хватает денег,
      // иначе банкрот — это обязательный платёж.
      if (jailPaymentPending) {
        if (jailTarget.money >= 500) {
          addLog(`⏰ ${jailTarget.name} не выкупился сам — авто-выкуп 500 К.`);
          payBail();
        } else {
          addLog(`💀 ${jailTarget.name} — не смог выкупиться из тюрьмы.`);
          bankruptPlayer(jailTargetIdx, "не смог выкупиться из тюрьмы");
        }
        return;
      }

      // Вариант 2: попытки ещё есть. Игрок не бросил — бросаем за него.
      // Дальше rollJail обработает результат как обычно.
      if (initialRoomId) {
        addLog(`⏰ ${jailTarget.name} — авто-бросок кубиков в тюрьме.`);
        socket.emit('roll-dice-request', {
          roomId: initialRoomId,
          playerId: jailTarget.id,
        });
      }
      return;
    }

    // Если ход уже сделан и окон не открыто — тайм-аут ни к чему
    if (rolled && !pendingAction) return;
    timeoutHandled.current = true;

    // Обязательный платёж (аренда / налог / шанс-потеря) — если не заплатил,
    // это не «свободный ход», тут решение стола не нужно. Сразу банкрот.
    const wasObligatoryPayment =
      pendingAction &&
      (pendingAction.type === "rent" ||
       pendingAction.type === "tax" ||
       (pendingAction.type === "chance" && !pendingAction.gain));

    // Закрываем окно действия — игрок проигнорировал
    if (pendingAction) setPendingAction(null);

    if (wasObligatoryPayment) {
      const targetId2 = expiredPlayerId || playersRef.current[turnRef.current]?.id;
      const targetIdx2 = playersRef.current.findIndex(p => p.id === targetId2);
      if (targetIdx2 !== -1) {
        bankruptPlayer(targetIdx2, "не оплатил обязательный платёж");
        return;
      }
    }

    // Определяем игрока, которого наказываем. Приоритет — id из timer-expired,
    // fallback — turn state. Это защищает от рассинхрона: у клиента turn
    // мог не обновиться, а сервер знает точно, у кого истёк таймер.
    const targetId = expiredPlayerId || playersRef.current[turnRef.current]?.id;
    const targetIdx = playersRef.current.findIndex(p => p.id === targetId);
    if (targetIdx === -1) return;
    const target = playersRef.current[targetIdx];

    // Голосовать не с кем только когда живой остался один.
    // При 2 игроках — голосование всё равно запускается: один решает,
    // оставить второго или исключить.
    if (alive.length <= 1) {
      bankruptPlayer(targetIdx, "тайм-аут");
      return;
    }

    // Иначе — всегда голосование за исключение
    if (!initialRoomId) return;
    socket.emit('vote-start', {
      roomId: initialRoomId,
      targetId,
      reason: 'истекло время ожидания хода',
      duration: settings.voteDuration,
    });
    setMessage(`Время вышло. Голосование за ${target?.name}.`);
  };

  // Единый тикер: раз в секунду пересчитываем остаток от timerEndsAt.
  // Это не «счётчик», а отображение серверного endsAt — поэтому
  // в фоне Chrome может троттлить этот интервал, но при возврате
  // во вкладку value сразу правильное (пересчёт от Date.now()).
  useEffect(() => {
    if (!timerEndsAt) return;
    const recompute = () => {
      const remaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    recompute();
    const id = window.setInterval(recompute, 1000);
    const onVis = () => { if (!document.hidden) recompute(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [timerEndsAt]);

    useEffect(() => {
    if (!animPath || animStep >= animPath.length - 1) return;
    const totalSteps = animPath.length - 1;
    // 1-2 шага — 550ms, 3-6 — 416ms, 7+ — 320ms
    const stepDuration = totalSteps <= 2 ? 550 : totalSteps <= 6 ? 416 : 320;
    const t = window.setTimeout(() => setAnimStep((s) => s + 1), stepDuration);
    return () => window.clearTimeout(t);
  }, [animPath, animStep]);

  // Тикер для модалки голосования: секунды обновляются каждую секунду,
  // пока идёт голосование. Просто force-render, значение не используется.
  useEffect(() => {
    if (!vote) return;
    const id = window.setInterval(() => forceVoteTick(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [vote]);

  useEffect(() => {
    if (!animPath || animStep < animPath.length - 1) return;
    const cb = afterAnimRef.current;
    afterAnimRef.current = null;
    const totalSteps = animPath.length - 1;
    // Та же длительность, что и у последнего шага, + небольшой запас
    const stepDuration = totalSteps <= 2 ? 550 : totalSteps <= 6 ? 416 : 320;
    const t = window.setTimeout(() => {
      setAnimPath(null);
      if (cb) cb();
    }, stepDuration + 20);
    return () => window.clearTimeout(t);
  }, [animPath, animStep]);

  // --- processLanding ---
  const processLanding = (
    newPos: number,
    oldPos: number,
    capturedTurn: number,
    isForwardMove = true,
  ) => {
    const cur = playersRef.current[capturedTurn];
    // Бонус за Старт — только при движении вперёд с переходом через 0
    const passedStart = isForwardMove && newPos !== 0 && newPos < oldPos;
    if (passedStart) {
      setPlayers((ps) =>
        ps.map((p, i) =>
          i === capturedTurn ? { ...p, money: p.money + modeConfig.passStartBonus } : p,
        ),
      );
      addLog(`🏁 ${cur.name} прошёл Старт: +${modeConfig.passStartBonus.toLocaleString("ru-RU")} К`);
    }
    const cell = getCell(newPos);
    switch (cell.type) {
      case "start":
        addLog(`🏁 ${cur.name} попал на Старт! +${modeConfig.landStartBonus.toLocaleString("ru-RU")} К`);
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === capturedTurn ? { ...p, money: p.money + modeConfig.landStartBonus } : p,
          ),
        );
        addLog(`🏁 ${cur.name} получил ${modeConfig.landStartBonus.toLocaleString("ru-RU")} К за Старт!`);
        advanceTurn(capturedTurn);
        break;
      case "property": {
        const owner = ownersRef.current[newPos];
        if (!owner) {
          addLog(
            `🏢 ${cur.name} встал на «${cell.name}» (${cell.price?.toLocaleString("ru-RU")} К). Купить?`,
          );
          setPendingAction({
            type: "buy",
            cellIndex: newPos,
            price: cell.price ?? 0,
          });
        } else if (owner === cur.id) {
          addLog(`🏠 ${cur.name} на своём поле «${cell.name}»`);
          advanceTurn(capturedTurn);
        } else {
          const rent = getRent(newPos, improvementsRef.current);
          const ownerName = playersRef.current.find((p) => p.id === owner)?.name ?? "?";
          if (rent === 0) {
            addLog(
              `💸 ${cur.name} попал на «${cell.name}», но поле в залоге. Аренда не взимается.`,
            );
            advanceTurn(capturedTurn);
          } else {
            addLog(
              `💸 ${cur.name} попал на «${cell.name}» и должен заплатить аренду ${rent.toLocaleString("ru-RU")} К → ${ownerName}`,
            );
            setPendingAction({
              type: "rent",
              amount: rent,
              ownerId: owner,
              ownerName,
              cellIndex: newPos,
            });
          }
        }
        break;
      }
      case "tax": {
        // Защита от undefined в настройках
        const tax1 = settings.taxAmount1 ?? defaultSettings.taxAmount1;
        const tax2 = settings.taxAmount2 ?? defaultSettings.taxAmount2;
        const amount = newPos === 4 ? tax1 : tax2;
        addLog(
          `💸 ${cur.name} попал на «Налог» и должен заплатить ${amount.toLocaleString("ru-RU")} К`,
        );
        setPendingAction({ type: "tax", amount });
        break;
      }
      case "chance": {
        const ev =
          CHANCE_EVENTS_DATA[
            Math.floor(Math.random() * CHANCE_EVENTS_DATA.length)
          ];
        const aliveCount = players.filter((p) => !p.bankrupt).length;
        const totalAmt =
          ev.kind === "birthday"
            ? ev.amount * (aliveCount - 1)
            : ev.kind === "hotels"
              ? ev.amount * Object.values(improvements).reduce((s, v) => s + v, 0)
              : ev.kind === "pay_each"
                ? ev.amount * (aliveCount - 1)
                : ev.kind === "mass_gain" || ev.kind === "mass_lose"
                  ? ev.amount * aliveCount
                  : ev.amount;
        const desc = ev.desc.replace(/{name}/g, cur.name);
        addLog(`🎲 ${cur.name} встал на «Шанс»: «${desc}»`);

        switch (ev.kind) {
          case "gain":
            setPlayers((ps) => ps.map((p, i) => (i === capturedTurn ? { ...p, money: p.money + ev.amount } : p)));
            addLog(`💰 ${cur.name} получил ${ev.amount.toLocaleString("ru-RU")} К`);
            advanceTurn(capturedTurn);
            break;
          case "birthday":
            setPlayers((ps) => ps.map((p, i) => {
              if (i === capturedTurn) return { ...p, money: p.money + totalAmt };
              if (!p.bankrupt) return { ...p, money: Math.max(0, p.money - ev.amount) };
              return p;
            }));
            addLog(`🎂 Все игроки скинулись ${cur.name} по ${ev.amount.toLocaleString("ru-RU")} К`);
            advanceTurn(capturedTurn);
            break;
          case "mass_gain":
            setPlayers((ps) => ps.map((p) => p.bankrupt ? p : { ...p, money: p.money + ev.amount }));
            addLog(`💰 Все игроки получили по ${ev.amount.toLocaleString("ru-RU")} К`);
            advanceTurn(capturedTurn);
            break;
          case "pay_each":
            if (totalAmt <= 0) { advanceTurn(capturedTurn); break; }
            setPendingAction({ type: "chance", amount: totalAmt, gain: false, desc });
            break;
          case "hotels":
            if (totalAmt <= 0) {
              addLog(`🎲 ${cur.name} встал на «Шанс»: «${desc}». Ничего не должен, так как нет филиалов и отелей.`);
              advanceTurn(capturedTurn);
            } else {
              setPendingAction({ type: "chance", amount: totalAmt, gain: false, desc });
            }
            break;
          case "mass_lose":
            setPlayers((ps) => ps.map((p) => p.bankrupt ? p : { ...p, money: Math.max(0, p.money - ev.amount) }));
            addLog(`💸 Все игроки потеряли по ${ev.amount.toLocaleString("ru-RU")} К`);
            advanceTurn(capturedTurn);
            break;
          case "lose":
          default:
            if (totalAmt <= 0) { advanceTurn(capturedTurn); break; }
            setPendingAction({ type: "chance", amount: totalAmt, gain: false, desc });
            break;
        }
        break;
      }
       case "challenge": {
        const ev = CHALLENGE_EVENTS_DATA[Math.floor(Math.random() * CHALLENGE_EVENTS_DATA.length)];
        const nPos = (newPos + (ev.forward ? ev.steps : 40 - ev.steps)) % 40;
        const desc = ev.desc.replace(/{name}/g, cur.name);
        addLog(`⚡ ${desc} → «${getCell(nPos).name}»`);

        // Сообщаем наблюдателям — они запустят ту же анимацию и
        // переставят фишку в тот же момент, что и у нас.
        if (initialRoomId) {
          socket.emit('challenge-animation', {
            roomId: initialRoomId,
            playerId: cur.id,
            from: newPos,
            to: nPos,
          });
        }

        // Запускаем огненный след
        setFireTrailAnim({ from: newPos, to: nPos, playerId: cur.id });

        setTimeout(() => {
          setPlayers((ps) =>
            ps.map((p, i) => (i === capturedTurn ? { ...p, position: nPos } : p))
          );
          // Принудительная отправка снапшота — чтобы наблюдатели
          // сразу увидели новую позицию, не дожидаясь действия.
          setSyncNudge((n) => n + 1);

          setTimeout(() => {
            setFireTrailAnim(null);
            processLanding(nPos, newPos, capturedTurn, ev.forward);
          }, 1500); // Увеличили время для более красивого шлейфа
        }, 600);

        break;
      }
            case "gotojail":
        addLog(`👮 ${cur.name} попал на «В тюрьму»! Отправляется за решётку.`);
        setDiagonalAnim({ from: newPos, to: 10, playerId: cur.id });
        // Сообщаем наблюдателям — они запустят ту же анимацию.
        if (initialRoomId) {
          socket.emit('jail-animation', {
            roomId: initialRoomId,
            playerId: cur.id,
            from: newPos,
            to: 10,
          });
        }
        setTimeout(() => {
          setPlayers((ps) =>
            ps.map((p, i) =>
              i === capturedTurn
                ? { ...p, position: 10, jailTurns: modeConfig.jailAttempts, jailAttempts: 0 }
                : p,
            ),
          );
          setDiagonalAnim(null);
          setSyncNudge((n) => n + 1);
          addLog(`🔒 ${cur.name} отправлен в тюрьму (до ${modeConfig.jailAttempts} попыт${modeConfig.jailAttempts === 1 ? "ки" : "ок"} дубля)`);
          advanceTurn(capturedTurn, true);
        }, 1200);
        break;
      case "jail":
        // 1.7.1: landing on Jail cell = same as gotojail
        addLog(
          `🔒 ${cur.name} попал на «Тюрьма» — задержан! До ${modeConfig.jailAttempts} попыт${modeConfig.jailAttempts === 1 ? "ки" : "ок"} дубля или выкуп 500 К.`,
        );
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === capturedTurn
              ? { ...p, position: 10, jailTurns: modeConfig.jailAttempts, jailAttempts: 0 }
              : p,
          ),
        );
        addLog(`🔒 ${cur.name} отправлен в тюрьму (до ${modeConfig.jailAttempts} попыт${modeConfig.jailAttempts === 1 ? "ки" : "ок"} дубля)`);
        advanceTurn(capturedTurn, true);
        break;
      case "jackpot": {
        // Защита от undefined в настройках
        const bet1 = settings.jackpotBet1 ?? defaultSettings.jackpotBet1;
        const bet2 = settings.jackpotBet2 ?? defaultSettings.jackpotBet2;
        const bet3 = settings.jackpotBet3 ?? defaultSettings.jackpotBet3;
        const secret = 1 + Math.floor(Math.random() * 6);
        addLog(
          `🎰 ${cur.name} встал на «Джекпот»! Выбери сколько кубиков бросить: 1 (${bet1.toLocaleString("ru-RU")}М), 2 (${bet2.toLocaleString("ru-RU")}М), 3 (${bet3.toLocaleString("ru-RU")}М).`,
        );
        setPendingAction({
          type: "jackpot-casino",
          jackpotTotal: jackpot,
          secret,
          diceCount: 0,
        });
        break;
      }
    }
  };

  // --- Jackpot casino resolve --- 2.1
  const resolveCasino = (
    pickedNums: number[],
    diceCount: number,
    secret: number,
  ) => {
    setPendingAction(null);
    setCasinoPick([]);
    const entryFee =
      diceCount === 1
        ? settings.jackpotBet1
        : diceCount === 2
          ? settings.jackpotBet2
          : settings.jackpotBet3;

    // Защита: даже если игрок как-то пробрался к вызову с недостатком
    // денег — не списываем в минус, не платим приз. Откатываем.
    if (player.money < entryFee) {
      addLog(`❌ ${player.name} — недостаточно средств для ставки ${entryFee} К.`);
      advanceTurn();
      return;
    }
    const prize =
      diceCount === 1
        ? settings.jackpotWin1
        : diceCount === 2
          ? settings.jackpotWin2
          : settings.jackpotWin3;
    const won = pickedNums.includes(secret);
    // Deduct entry fee
    setPlayers((ps) =>
      ps.map((p, i) =>
        i === turn ? { ...p, money: Math.max(0, p.money - entryFee) } : p,
      ),
    );
    setJackpot((j) => j + entryFee);
    if (won) {
      setPlayers((ps) =>
        ps.map((p, i) =>
          i === turn ? { ...p, money: p.money - entryFee + prize } : p,
        ),
      );
      setJackpot(
        (j) => j - entryFee + (entryFee - prize < 0 ? 0 : entryFee - prize),
      );
      addLog(
        `🎰 ${player.name} угадал! Секретное число: ${secret}. Выиграл ${prize.toLocaleString("ru-RU")} К! (ставка ${entryFee.toLocaleString("ru-RU")} К)`,
      );
    } else {
      addLog(
        `🎰 ${player.name} не угадал. Секретное число: ${secret}. Потерял ${entryFee.toLocaleString("ru-RU")} К.`,
      );
    }
    advanceTurn();
  };

  // --- confirmAction ---
  const confirmAction = () => {
    if (!pendingAction) return;
    const a = pendingAction;
    setPendingAction(null);
    if (!player) return;
    switch (a.type) {
      case "rent":
        if (player.money < a.amount) {
          addLog("❌ Недостаточно средств для оплаты аренды.");
          return;
        }
        setPlayers((ps) =>
          ps.map((p) => {
            if (p.id === player.id)
              return { ...p, money: Math.max(0, p.money - a.amount) };
            if (p.id === a.ownerId) return { ...p, money: p.money + a.amount };
            return p;
          }),
        );
        addLog(
          `💸 Аренда ${a.amount.toLocaleString("ru-RU")} К → ${a.ownerName}`,
        );
        advanceTurn();
        break;
      case "tax":
        if (player.money < a.amount) {
          addLog("❌ Недостаточно средств для оплаты налога.");
          return;
        }
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === turn ? { ...p, money: Math.max(0, p.money - a.amount) } : p,
          ),
        );
        setJackpot((j) => j + a.amount);
        addLog(
          `💸 ${player.name} заплатил налог ${a.amount.toLocaleString("ru-RU")} К в джекпот`,
        );
        advanceTurn();
        break;
      case "chance":
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === turn
              ? {
                  ...p,
                  money: Math.max(0, p.money + (a.gain ? a.amount : -a.amount)),
                }
              : p,
          ),
        );
        addLog(
          `🎲 Шанс: ${a.gain ? "+" : "-"}${a.amount.toLocaleString("ru-RU")} К`,
        );
        advanceTurn();
        break;
      case "gotojail":
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === turn
              ? { ...p, position: 10, jailTurns: modeConfig.jailAttempts, jailAttempts: 0 }
              : p,
          ),
        );
        addLog(`🔒 ${player.name} отправлен в тюрьму (до ${modeConfig.jailAttempts} попыт${modeConfig.jailAttempts === 1 ? "ки" : "ок"} дубля)`);
        advanceTurn();
        break;
      case "jackpot": {
        const amt = a.amount;
        if (amt > 0) {
          setPlayers((ps) =>
            ps.map((p, i) => (i === turn ? { ...p, money: p.money + amt } : p)),
          );
          setJackpot(0);
        }
        addLog(
          amt > 0
            ? `🎰 ${player.name} выиграл Джекпот: +${amt.toLocaleString("ru-RU")} К!`
            : "🎰 Джекпот пуст.",
        );
        advanceTurn();
        break;
      }
    }
  };
    // Добровольная сдача при обязательном платеже. Остаток баланса
  // перечисляется получателю: владельцу поля при аренде, в джекпот
  // при налоге и шансе-потере. Затем игрок банкротится.
  const surrenderPayment = () => {
    if (!pendingAction || !player) return;
    const a = pendingAction;
    const myIdx = playersRef.current.findIndex(p => p.id === player.id);
    if (myIdx === -1) return;
    const myMoney = playersRef.current[myIdx].money;

    // Обновляем playersRef синхронно, чтобы bankruptPlayer увидел
    // актуальные балансы (иначе его inner setPlayers затрёт нашу правку).
    const newPlayers = playersRef.current.map(p => {
      if (p.id === player.id) return { ...p, money: 0 };
      if (a.type === "rent" && p.id === a.ownerId) {
        return { ...p, money: p.money + myMoney };
      }
      return p;
    });
    playersRef.current = newPlayers;
    setPlayers(newPlayers);

    if (a.type === "tax" || (a.type === "chance" && !a.gain)) {
      setJackpot(j => j + myMoney);
    }

    if (a.type === "rent" && myMoney > 0) {
      addLog(`💸 ${player.name} сдался. Остаток ${myMoney.toLocaleString("ru-RU")} К → ${a.ownerName}`);
    } else if (myMoney > 0) {
      addLog(`💸 ${player.name} сдался. Остаток ${myMoney.toLocaleString("ru-RU")} К → в джекпот`);
    } else {
      addLog(`💸 ${player.name} сдался.`);
    }

    setPendingAction(null);
    bankruptPlayer(myIdx, "добровольная сдача");
  };


    const buyProperty = () => {
    if (!pendingAction || pendingAction.type !== "buy") return;
    const { cellIndex, price } = pendingAction;
    const cp = playersRef.current[turnRef.current];
    if (!cp) return;
    if (cp.money < price) {
      addLog("❌ Недостаточно средств!");
      return;
    }
    setOwners((old) => ({ ...old, [cellIndex]: cp.id }));
    setPlayers((ps) =>
      ps.map((p, i) => (i === turnRef.current ? { ...p, money: p.money - price } : p)),
    );
    addLog(
      `🏠 ${cp.name} купил «${getCell(cellIndex).name}» за ${price.toLocaleString("ru-RU")} К`,
    );

    // Ежедневный квест "Купи 1 поле"
    if (cp.id === currentUser?.id) {
      emitQuestEvent("buyProperty");
      // Проверяем монополию: все поля группы теперь у игрока?
      const newOwners = { ...ownersRef.current, [cellIndex]: cp.id };
      const gIdx = getGroupIdx(cellIndex);
      if (gIdx !== -1) {
        const groupCells = getDynamicGroups()[gIdx].cells as readonly number[];
        const hasMonopoly = groupCells.every((ci) => newOwners[ci] === cp.id);
        if (hasMonopoly) {
          emitQuestEvent("monopoly");
        }
      }
    }

    setPendingAction(null);
    advanceTurn();
  };

  // FIX 1.1: initiator is excluded from auction
  const sendToAuction = () => {
    if (!pendingAction || pendingAction.type !== "buy") return;
    const { cellIndex, price } = pendingAction;
    setPendingAction(null);
    const startPrice = Math.max(100, Math.round(price / 100) * 100);

    // 1. Определяем следующего по порядку хода живого игрока (после текущего)
    const firstIdx = nextAliveIndex(turn);
    const firstToActId = players[firstIdx].id;

    // 2. Собираем всех живых игроков, кроме того, кто выставил на аукцион.
    // Также отсеиваем тех, у кого денег меньше стартовой ставки — они
    // физически не могут участвовать, им окно аукциона не показываем.
    let rawParticipants = players
      .filter((p) => !p.bankrupt && p.id !== player.id && p.money >= startPrice)
      .map((p) => p.id);

    // 3. Если игроков больше 1, переставляем список так, чтобы первым шёл следующий по очереди
    if (rawParticipants.length > 0 && rawParticipants[0] !== firstToActId) {
      const pivotIdx = rawParticipants.indexOf(firstToActId);
      if (pivotIdx > 0) {
        const part1 = rawParticipants.slice(0, pivotIdx);
        const part2 = rawParticipants.slice(pivotIdx);
        rawParticipants = [...part2, ...part1];
      }
    }

    // Если никого не осталось для аукциона
    if (rawParticipants.length === 0) {
      addLog("🔨 Аукцион: некому участвовать, поле остаётся свободным.");
      advanceTurn();
      return;
    }

    setAuction({
      cellIndex,
      price: startPrice,
      participants: rawParticipants,
      currentIdx: 0,
      highBidder: null,
    });
    addLog(
      `🔨 ${player.name} выставил на аукцион «${getCell(cellIndex).name}». Старт: ${startPrice.toLocaleString("ru-RU")} К`,
    );
    addLog(`🔨 ${player.name} отказался от участия в аукционе`);

    // Таймер на первого участника аукциона.
    if (initialRoomId && rawParticipants.length > 0) {
      socket.emit('timer-start', {
        roomId: initialRoomId,
        durationSec: AUCTION_TIMER_SEC,
        playerId: rawParticipants[0],
      });
    }
  };

    const auctionRaise = () => {
    if (!auction) return;
    const bidderId = auction.participants[auction.currentIdx];
    const bidder = players.find((p) => p.id === bidderId);
    if (!bidder) return;

    // Последний оставшийся участник: выкупает по ТЕКУЩЕЙ цене
    // (никто не перебивает, +100 не нужно). Либо отказывается.
    if (auction.participants.length === 1) {
      if (bidder.money < auction.price) {
        addLog(
          `❌ У ${bidder.name} недостаточно средств (нужно ${auction.price.toLocaleString("ru-RU")} К).`,
        );
        return;
      }
      const winner = bidder;
      setOwners((old) => ({ ...old, [auction.cellIndex]: bidderId }));
      setPlayers((ps) =>
        ps.map((p) =>
          p.id === bidderId ? { ...p, money: p.money - auction.price } : p,
        ),
      );
      addLog(
        `🏆 ${winner.name} выкупил «${getCell(auction.cellIndex).name}» за ${auction.price.toLocaleString("ru-RU")} К`,
      );
      setAuction(null);
      advanceTurn();
      return;
    }

    // Обычная ставка: +100 к текущей, ход переходит к следующему.
    const newPrice = auction.price + 100;
    if (bidder.money < newPrice) {
      addLog("❌ Недостаточно средств для ставки.");
      return;
    }
    const nextIdx = (auction.currentIdx + 1) % auction.participants.length;
    addLog(`🔨 ${bidder.name} ставит ${newPrice.toLocaleString("ru-RU")} К`);
    setAuction({
      ...auction,
      price: newPrice,
      currentIdx: nextIdx,
      highBidder: bidderId,
    });

    // Таймер на следующего участника аукциона.
    if (initialRoomId) {
      socket.emit('timer-start', {
        roomId: initialRoomId,
        durationSec: AUCTION_TIMER_SEC,
        playerId: auction.participants[nextIdx],
      });
    }
  };

      const auctionDecline = () => {
    if (!auction) return;
    const bidderId = auction.participants[auction.currentIdx];

    // Если это единственный участник и он же highBidder — отказ невозможен.
    // Он обязан выкупить поле по своей последней ставке.
    if (
      auction.participants.length === 1 &&
      auction.highBidder === bidderId
    ) {
      return;
    }
    const bidder = players.find((p) => p.id === bidderId);
    addLog(`🔨 ${bidder?.name ?? "?"} отказался от участия в аукционе`);

    // Отказывается ли текущий лидер? Если да — его ставка аннулируется.
    const wasHighBidder = auction.highBidder === bidderId;

    // Удаляем отказавшегося игрока
    const newParticipants = auction.participants.filter(
      (id) => id !== bidderId,
    );

    // Никого не осталось — аукцион завершён.
    if (newParticipants.length === 0) {
      // Победу отдаём последнему лидеру, ТОЛЬКО если он сам не отказался.
      if (auction.highBidder && !wasHighBidder) {
        const winner = players.find((p) => p.id === auction.highBidder);
        if (winner && winner.money >= auction.price) {
          setOwners((old) => ({
            ...old,
            [auction.cellIndex]: auction.highBidder!,
          }));
          setPlayers((ps) =>
            ps.map((p) =>
              p.id === auction.highBidder
                ? { ...p, money: p.money - auction.price }
                : p,
            ),
          );
          addLog(
            `🏆 ${winner.name} выиграл аукцион! «${getCell(auction.cellIndex).name}» за ${auction.price.toLocaleString("ru-RU")} К`,
          );
        } else {
          addLog("🔨 Аукцион завершён без победителя.");
        }
      } else {
        addLog("🔨 Все отказались. Поле остаётся свободным.");
      }
      setAuction(null);
      advanceTurn();
      return;
    }

    // Остался 1 участник — НЕ отдаём победу автоматом.
    // Открываем окно: он либо выкупит по текущей цене, либо тоже откажется.
    if (newParticipants.length === 1) {
      setAuction({
        ...auction,
        participants: newParticipants,
        currentIdx: 0,
        highBidder: wasHighBidder ? null : auction.highBidder,
      });
      if (initialRoomId) {
        socket.emit('timer-start', {
          roomId: initialRoomId,
          durationSec: AUCTION_TIMER_SEC,
          playerId: newParticipants[0],
        });
      }
      return;
    }

    // Больше 1 участника — продолжаем.
    const nextIdx = auction.currentIdx % newParticipants.length;
    setAuction({
      ...auction,
      participants: newParticipants,
      currentIdx: nextIdx,
      highBidder: wasHighBidder ? null : auction.highBidder,
    });
    if (initialRoomId) {
      socket.emit('timer-start', {
        roomId: initialRoomId,
        durationSec: AUCTION_TIMER_SEC,
        playerId: newParticipants[nextIdx],
      });
    }
  };

  const improveProperty = (cellIdx: number) => {
    const gIdx = getGroupIdx(cellIdx);
    if (gIdx === -1) {
      addLog("ℹ️ Это поле не входит в Монополию.");
      return;
    }
    if (improvedGroupsThisTurn.includes(gIdx)) {
      addLog("ℹ️ В этой Монополии уже было улучшение в этот ход.");
      return;
    }
    const cost = getImproveCost(cellIdx);
    if (player.money < cost) {
      addLog("❌ Недостаточно средств для улучшения!");
      return;
    }
    const lvl = improvements[cellIdx] ?? 0;
    if (lvl >= 5) {
      addLog("ℹ️ Каксимальное улучшение!");
      return;
    }
    const groupCells = getDynamicGroups()[gIdx].cells as readonly number[];
    const allOthersAtLeastCurrent = groupCells.every((ci) => {
      if (ci === cellIdx) return true;
      return (improvements[ci] ?? 0) >= lvl;
    });

    if (!allOthersAtLeastCurrent) {
      addLog(
        "⚠️ Нужно сперва прокачать все остальные поля этой Монополии до текущего уровня!",
      );
      return;
    }
    setImprovements((old) => ({ ...old, [cellIdx]: lvl + 1 }));
    setPlayers((ps) =>
      ps.map((p, i) => (i === turn ? { ...p, money: p.money - cost } : p)),
    );
    setImprovedGroupsThisTurn((old) => [...old, gIdx]);
    addLog(
      `🏗 ${player.name} улучшил «${getCell(cellIdx).name}» → ${IMPROVE_LABELS[lvl + 1]} (-${cost.toLocaleString("ru-RU")} К)`,
    );

    // Ежедневный квест "Улучши 1 поле"
    if (player.id === currentUser?.id) {
      emitQuestEvent("improveProperty");
    }
  };

  const sellProperty = (cellIdx: number) => {
    const lvl = improvements[cellIdx] ?? 0;
    if (lvl === 0) {
      addLog("ℹ️ На этом поле нет строений для продажи.");
      return;
    }
    const owner = owners[cellIdx];
    if (owner !== player.id) {
      addLog("❌ Это поле не ваше.");
      return;
    }
    const cost = getImproveCost(cellIdx); // стоимость постройки одного уровня
    // Понижаем уровень
    setImprovements((old) => ({ ...old, [cellIdx]: lvl - 1 }));
    setPlayers((ps) =>
      ps.map((p, i) => (i === turn ? { ...p, money: p.money + cost } : p)),
    );
    addLog(
      `🏗 ${player.name} продал улучшение на «${getCell(cellIdx).name}» (+${cost.toLocaleString("ru-RU")} К)`,
    );
  };
  const mortgageProperty = () => {
    if (selectedCell === null) return;
    const cellIdx = selectedCell;
    const amt = getMortgage(cellIdx);
    if (owners[cellIdx] !== player.id) {
      addLog("❌ Это поле не ваше.");
      return;
    }
    if (
      mortgages[cellIdx] !== undefined &&
      mortgages[cellIdx] > globalTurnCounter
    ) {
      addLog("ℹ️ Поле уже в залоге.");
      return;
    }

    // Продаем все улучшения при залоге и возвращаем деньги
    let refund = 0;
    const currentLvl = improvements[cellIdx] ?? 0;
    if (currentLvl > 0) {
      refund = currentLvl * getImproveCost(cellIdx);
      setImprovements((prev) => {
        const newPrev = { ...prev };
        delete newPrev[cellIdx];
        return newPrev;
      });
      addLog(
        `🏗 Улучшения проданы, возвращено ${refund.toLocaleString("ru-RU")} К`,
      );
    }

    setMortgages((prev) => ({ ...prev, [cellIdx]: globalTurnCounter + 15 }));
    setPlayers((ps) =>
      ps.map((p, i) =>
        i === turn ? { ...p, money: p.money + amt + refund } : p,
      ),
    );
    addLog(
      `🔒 ${player.name} заложил «${getCell(cellIdx).name}» за ${amt.toLocaleString("ru-RU")} К. Истекает через 15 ходов.`,
    );
    setSelectedCell(null);
  };

  const redeemProperty = () => {
    if (selectedCell === null) return;
    const cellIdx = selectedCell;
    const cost = getRedeemCost(cellIdx); // Новая цена выкупа

    if (owners[cellIdx] !== player.id) {
      addLog("❌ Это поле не ваше.");
      return;
    }
    if (
      mortgages[cellIdx] === undefined ||
      mortgages[cellIdx] <= globalTurnCounter
    ) {
      addLog("ℹ️ Поле не в залоге.");
      return;
    }
    if (player.money < cost) {
      addLog("❌ Недостаточно средств для выкупа!");
      return;
    }
    setMortgages((prev) => {
      const newMort = { ...prev };
      delete newMort[cellIdx];
      return newMort;
    });
    setPlayers((ps) =>
      ps.map((p, i) => (i === turn ? { ...p, money: p.money - cost } : p)),
    );
    addLog(
      `🔓 ${player.name} выкупил «${getCell(cellIdx).name}» за ${cost.toLocaleString("ru-RU")} К.`,
    );
    setSelectedCell(null);
  };

  // --- Trade/Deal ---
  const openTrade = (targetId: string) => {
    setPlayerHover(null);
    setTrade({
      targetId,
      myMoney: 0,
      myCards: [],
      theirMoney: 0,
      theirCards: [],
    });
  };

  const myOwnedCards = player
    ? Object.entries(owners)
        .filter(([, oid]) => oid === player.id)
        .map(([ci]) => Number(ci))
    : [];
  const tradeTarget = trade
    ? players.find((p) => p.id === trade.targetId)
    : null;
  const tradeTargetCards = trade
    ? Object.entries(owners)
        .filter(([, oid]) => oid === trade.targetId)
        .map(([ci]) => Number(ci))
    : [];

  const proposeTrade = () => {
    if (!trade || !tradeTarget) return;
    if (trade.myCards.length === 0 && trade.theirCards.length === 0) {
      addLog("❌ В классическом режиме запрещено менять деньги на деньги!");
      return;
    }
    if (trade.myMoney > player.money) {
      addLog(`❌ У вас недостаточно средств (нужно ${trade.myMoney.toLocaleString("ru-RU")} К, есть ${player.money.toLocaleString("ru-RU")} К).`);
      return;
    }
    if (trade.theirMoney > tradeTarget.money) {
      addLog(`❌ У ${tradeTarget.name} недостаточно средств (нужно ${trade.theirMoney.toLocaleString("ru-RU")} К, есть ${tradeTarget.money.toLocaleString("ru-RU")} К).`);
      return;
    }
    const myVal =
      trade.myMoney +
      trade.myCards.reduce((s, ci) => s + (boardCells[ci].price ?? 0), 0);
    const theirVal =
      trade.theirMoney +
      trade.theirCards.reduce((s, ci) => s + (boardCells[ci].price ?? 0), 0);
    if (myVal > theirVal * 2 || theirVal > myVal * 2) {
      addLog(
        "❌ Договор: разница в стоимости предложений слишком велика (макс 2×).",
      );
      return;
    }

    // Находим индекс получателя
    const targetIdx = players.findIndex((p) => p.id === trade.targetId);
    if (targetIdx === -1) return;

    // Сохраняем информацию об инициаторе и текущем состоянии дублей
    setTradeInitiator({
      id: player.id,
      fromIdx: turn,
      isDouble: isDoubleRoll,
      doubleCount: doubleCount,
    });

    // Отправляем предложение и переключаем ход на получателя
    setPendingTrade({ initiatorId: player.id, trade });
    setTurn(targetIdx); // Принудительно переключаем ход
    socket.emit('trade-proposed', { roomId: initialRoomId, initiatorId: player.id, isDoubleRoll: isDoubleRoll, doubleCount: doubleCount, trade: { ...trade, initiatorId: player.id } });

    setRolled(false); // Сбрасываем флаг броска, если был
    setMessage(
      `Ожидаем ответа от ${tradeTarget.name} на предложение договора...`,
    );
    addLog(
      `🤝 ${player.name} предлагает договор ${tradeTarget.name}. Ожидаем ответа...`,
    );
    setTrade(null); // Закрываем окно у инициатора
  };

  // --- Roll mechanics ---
  const doRollAnimation = (d1: number, d2: number, onDone: () => void) => {
    // Пока летят кубики и фишка идёт по клеткам — таймер у всех на паузе.
    // Новый старт произойдёт: либо через useEffect(pendingAction),
    // либо через advanceTurn в конце обработки.
    if (initialRoomId) {
      socket.emit('timer-pause', { roomId: initialRoomId });
    }
    setTargetDice([d1, d2]);
    setDiceRolling(true); // Показываем оверлей
    setIsSpinning(true); // Запускаем вращение кубиков
    // (удалено — скорость теперь константа)

    // 1. Останавливаем вращение через 1.5 секунды
    setTimeout(() => {
      setIsSpinning(false);
    }, 1000);

    // 2. Оставляем кубики статичными в чате ещё на 0,4 секунды, затем скрываем и завершаем ход
    setTimeout(() => {
      setDiceRolling(false);
      setDice([d1, d2]); // Обновляем значения для подсчета суммы в игре
      onDone();
    }, 2500); // 1000мс (вращение) + 400мс (статичная пауза) = 1500мс
  };

  const rollJail = (d1: number, d2: number, playerId: string) => {
    const steps = d1 + d2;
    // Находим индекс и данные игрока через Ref, чтобы не зависеть от устаревшего замыкания
    const capturedTurn = playersRef.current.findIndex(p => p.id === playerId);
    const player = playersRef.current[capturedTurn];
    // Если открыто окно договора, закрываем его перед попыткой выйти из тюрьмы
    setTrade(null);
    doRollAnimation(d1, d2, () => {
      // ... остальной код
      const attempts = (player.jailAttempts ?? 0) + 1;
      const isDouble = d1 === d2;
      setRolled(true);
      if (isDouble) {
        // Exit jail and move that many steps
        const np = (10 + steps) % 40;
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === capturedTurn
              ? { ...p, position: np, jailTurns: 0, jailAttempts: 0 }
              : p,
          ),
        );
        addLog(
          `🎲 ${player.name} вышел из тюрьмы! Дубль! Двигается на ${steps} → «${getCell(np).name}»`,
        );
          const path: number[] = [10];
        for (let i = 1; i <= steps; i++) path.push((10 + i) % 40);
        afterAnimRef.current = () => processLanding(np, 10, capturedTurn);
        setAnimStep(0);
        setAnimPath(path);
                  } else if (attempts >= modeConfig.jailAttempts) {
        // 3-я попытка: дубль не выпал. Игрок обязан выкупиться, продать/заложить имущество или сдаться.
        setJailPaymentPending(true);
        // ВАЖНО: Сохраняем выпавшие кубики, чтобы после оплаты выкупа передвинуть игрока!
        pendingJailMovementRef.current = { d1, d2, capturedTurn };
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === capturedTurn
              ? {
                  ...p,
                  jailTurns: 1, // <--- ОСТАВЛЯЕМ > 0, чтобы кнопка выкупа не исчезала!
                  jailAttempts: 0,
                }
              : p,
          ),
        );
        
        addLog(
          `❗ ${player.name} — попытки исчерпаны, дубль не выпал. Обязан выкупиться или продать/заложить имущество.`,
        );
        setMessage("Попытки исчерпаны. Оплатите 500 К или продайте/заложите имущество.");
        if (initialRoomId) {
          socket.emit('timer-start', {
            roomId: initialRoomId,
            durationSec: modeConfig.turnDurationSec,
            playerId: playerId,
          });
        }
      } else {
        // No double — stay in jail
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === capturedTurn
              ? {
                  ...p,
                  jailTurns: Math.max(0, (p?.jailTurns ?? modeConfig.jailAttempts) - 1),
                  jailAttempts: attempts,
                }
              : p,
          ),
        );
        addLog(
          `🔒 ${player.name} — дубль не выпал (попытка ${attempts}/3). Остаётся в тюрьме.`,
        );
        window.setTimeout(() => advanceTurn(capturedTurn), 900);
      }
    });
  };

    const payBail = () => {
    if (player.money < 500) {
      setMessage("Недостаточно денег (500 К)!");
      return;
    }

    // Берем сохраненные кубики, если они есть (случай 3-й попытки)
    const pendingMove = pendingJailMovementRef.current;
    setJailPaymentPending(false);
    pendingJailMovementRef.current = null;

    // Снимаем 500 К и выходим из тюрьмы
    setPlayers((ps) =>
      ps.map((p, i) =>
        i === turn
          ? { ...p, money: p.money - 500, jailTurns: 0, jailAttempts: 0 }
          : p,
      ),
    );
    addLog(`🔓 ${player.name} выкупился за 500 К`);

    if (pendingMove) {
      // Если была 3-я попытка, двигаем на выпавшие шаги
      const { d1, d2, capturedTurn } = pendingMove;
      const steps = d1 + d2;
      const np = (10 + steps) % 40;

      setMessage(`Выкупился! Двигается на ${steps} клеток...`);

            const path: number[] = [10];
      for (let i = 1; i <= steps; i++) path.push((10 + i) % 40);
      
      afterAnimRef.current = () => {
        setPlayers((prevPlayers) =>
          prevPlayers.map((p, i) =>
            i === capturedTurn ? { ...p, position: np } : p
          )
        );
        processLanding(np, 10, capturedTurn);
      };
      setAnimStep(0);
      setAnimPath(path);
      
    } else {
      // Если просто выкупился до броска
      setRolled(false);
      if (initialRoomId) {
        socket.emit('timer-start', {
          roomId: initialRoomId,
          durationSec: modeConfig.turnDurationSec,
          playerId: playersRef.current[turnRef.current]?.id,
        });
      }
      setMessage("Выкупился! Теперь бросай кубики.");
    }
  };

 const roll = () => {
    if (busy) return;
     if (!player) return;
    setTrade(null);
    // Всегда отправляем запрос на сервер (даже если в тюрьме), 
    // сервер вернет числа, и логика тюрьмы запустится через rollJail(d1, d2)
    socket.emit('roll-dice-request', { 
      roomId: initialRoomId, 
      playerId: player.id 
    });
  };

  const finishGame = () => {
    // Награды теперь начисляет ТОЛЬКО сервер через game-rewards.
    // Клиент просто ждёт ответа и показывает финальный экран.
    if (rewardGivenRef.current) return;
    rewardGivenRef.current = true;

    // Если сервер не прислал game-rewards за 5 секунд — показываем заглушку
    setTimeout(() => {
      if (!rewardRef.current) {
        setReward("Партия завершена. Ожидаем начисления наград с сервера…");
        setGameOver(true);
      }
    }, 5000);
  };

  // Актуализируем refs на функции каждый рендер. Так socket.on-обработчики,
  // зарегистрированные один раз, всегда вызывают самую свежую версию функции
  // с актуальным state (alive, players, turn и т.д.).
  useEffect(() => {
    handleTimeoutRef.current = handleTimeout;
    bankruptPlayerRef.current = bankruptPlayer;
    advanceTurnRef.current = advanceTurn;
    finishGameRef.current = finishGame;
    handleVoluntaryLeaveRef.current = handleVoluntaryLeave;
    addLogRef.current = addLog;
    auctionDeclineRef.current = auctionDecline;
  });

  const cellGridPos = (index: number) => ({
    row:
      index <= 10 ? 1 : index <= 19 ? index - 9 : index <= 30 ? 11 : 41 - index,
    col:
      index <= 10 ? index + 1 : index <= 19 ? 11 : index <= 30 ? 31 - index : 1,
  });
  const STRIP = "18%";
  const auctionCurPlayer = auction
    ? players.find((p) => p.id === auction.participants[auction.currentIdx])
    : null;
  const isMyAuctionTurn =
    !!auction && auction.participants[auction.currentIdx] === "you";

  type BuyA = { type: "buy"; cellIndex: number; price: number };
  type RentA = {
    type: "rent";
    amount: number;
    ownerId: string;
    ownerName: string;
    cellIndex: number;
  };
  type NumA = { type: string; amount: number };
  type GainA = { type: "chance"; amount: number; gain: boolean; desc: string };


            useEffect(() => {
    if (!initialRoomId) return;
  if (isRemoteUpdate.current) return;
  if (!playersRef.current || playersRef.current.length === 0) return;
  // Suppression window: не отправляем снапшот, если только что применили
  // чужой — иначе эхо-петля A→B→A→B и откаты хода.
  // НО: если у нас критичное состояние (аукцион / окно действия / трейд),
  // suppression НЕ применяем — иначе быстрые действия сразу после
  // получения чужого снапшота не долетят до других игроков.
  const hasCriticalState = !!auctionRef.current || !!pendingActionRef.current || !!pendingTradeRef.current;
  if (!hasCriticalState && Date.now() - remoteAppliedAtRef.current < 250) return;
    // ВАЖНО: Отправляем состояние всегда, когда оно меняется!
    const syncPayload = {
        roomId: initialRoomId,
        senderId: currentUser?.id || "you",
        players: playersRef.current.map(p => ({
            id: p.id,
            name: p.name,
            initials: p.initials,
            color: p.color,
            money: p.money,
            position: p.position,
            bankrupt: p.bankrupt,
            leftAlive: p.leftAlive,
            jailTurns: p.jailTurns,
            jailAttempts: p.jailAttempts,
            isVip: p.isVip,
            vipUntil: p.vipUntil,
            activeSkins: p.activeSkins,
        })),
        owners: ownersRef.current,
        improvements: improvementsRef.current,
        turn: turnRef.current,
        globalTurnCounter: globalTurnCounterRef.current,
        jackpot: jackpotRef.current,
        mortgages: mortgagesRef.current,
        auction: auctionRef.current,
        rolled: rolledRef.current,
        isDoubleRoll: isDoubleRollRef.current,
        pendingAction: pendingAction,
        globalCustomSkins: globalCustomSkins,
        timeLeft: timeLeft
    };
    const syncTotal = JSON.stringify(syncPayload).length;
    if (syncTotal > 50000) {
      const syncPlayers = JSON.stringify(playersRef.current).length;
      const syncSkins = JSON.stringify(globalCustomSkins).length;
      console.warn(`⚠️ sync: ${syncTotal}B | players: ${syncPlayers}B | skins: ${syncSkins}B — выше нормы`);
    }
    socket.emit('sync-game-state', syncPayload);
    }, [turn, owners, improvements, jackpot, mortgages, gameOver, reward, auction, rolled, isDoubleRoll, syncNudge]);

  // Заглушка для мобильных в портретной ориентации — играем только в ландшафте.
  if (isPortraitMobile) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#1c1828] px-6 text-center text-white">
        <div className="text-6xl">📱↻</div>
        <h2 className="font-display text-xl font-bold">
          Поверни телефон
        </h2>
        <p className="max-w-xs text-sm text-[#a39cb1]">
          Игровой стол рассчитан на ландшафтный режим.
          Поверни устройство горизонтально, чтобы продолжить партию.
        </p>
      </div>
    );
  }

  // 🌟 ИДЕАЛЬНАЯ ЗАЩИТА ОТ ОШИБКИ #310: Если в комнате меньше 2 игроков, BoardGame показывает лобби и не рендерит тяжелый стол с хуками!
  if (initialRoomId && (!players || players.length < 2)) {
    if (globalTurnCounter > 0) {
      // Если это не старт, а разгар игры — принудительно вызываем окно завершения матча
      if (!gameOver) {
        setGameOver(true);
        window.setTimeout(finishGame, 100);
      }
    } else {
      // Если игра только-только создаётся — спокойно показываем лобби ожидания
      return (
        <div className="flex h-screen w-screen flex-col gap-3 items-center justify-center bg-[#1c1828] text-xl text-white font-sans">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff5a00]"></div>
          <div>Ожидание подключения игроков ({players?.length || 0}/{modeConfig.maxPlayers})...</div>
          <div className="text-xs text-muted-foreground bg-white/5 px-3 py-1.5 rounded-lg font-mono">
            Код комнаты: #{initialRoomId?.replace('#', '')}
          </div>
        </div>
      );
    }
  }

  return (
    <div
      className="relative flex h-full w-full overflow-hidden bg-[#1c1828] lg:w-auto"
      onClick={() => setPlayerHover(null)}
    >
      {/* Кнопка «Инфо» — только на мобиле и планшете */}
      <button
        onClick={(e) => { e.stopPropagation(); setInfoPanelOpen(v => !v); }}
        className="fixed left-2 top-2 z-30 flex h-10 items-center gap-1.5 rounded-xl bg-[#29233e] px-3 text-xs font-bold text-[#f7f0e3] shadow-lg lg:hidden"
        aria-label="Информация о партии"
      >
        <PanelLeft size={14} />
        Инфо
      </button>

      {/* Затемнение + выезжающая панель с инфо */}
      {infoPanelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setInfoPanelOpen(false)}
        />
      )}
      <div
        className={`fixed left-0 top-0 z-50 h-full w-[220px] transform bg-[#29233e] px-4 py-4 text-[#f7f0e3] shadow-2xl transition-transform duration-200 lg:hidden ${infoPanelOpen ? "translate-x-0" : "-translate-x-full"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="font-bold tracking-wide text-base leading-tight">
            Monopoly <span className="text-[#e7ba68]">Arena</span>
          </div>
          <button
            onClick={() => setInfoPanelOpen(false)}
            className="rounded-lg p-1 text-[#aaa2b4] hover:bg-white/10 hover:text-white"
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 font-mono text-[10px] uppercase leading-relaxed tracking-[.10em] text-primary">
          <div>живая партия</div>
          <div>стол #{initialRoomId?.replace('#', '')}</div>
        </div>

        <h2 className="mb-4 font-display text-lg font-bold leading-tight text-[#f7f0e3]">
          Пятничный клуб
        </h2>

        <div className="space-y-2">
          <div className="rounded-lg bg-[#f3e7c8] px-3 py-2 text-center">
            <div className="font-mono text-[10px] text-[#7a5c1e]">ДЖЕКПОТ</div>
            <div className="text-lg">🎰</div>
          </div>
          <div className="rounded-lg bg-[#f3e7c8] px-3 py-2 text-center">
            <div className="font-mono text-[10px] text-[#7a5c1e]">ТЕЛЕПОРТ</div>
            <div className="text-lg">🌀</div>
          </div>
        </div>

        {/* Игроки в drawer — скрыто, теперь список в правой панели */}
        <div className="mt-4 hidden">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-display text-sm font-bold">Игроки</div>
            <span className="font-mono text-[10px] text-[#aaa2b4]">
              {players.filter(p => !p.bankrupt).length} / {players.length}
            </span>
          </div>
          <div className="space-y-1">
            {players.map((p, i) => {
              const isMyTurn = p.id === (auction ? auction.participants[auction.currentIdx] : players[turn]?.id) && !p.bankrupt;
              return (
                <div
                  key={p.id}
                  className={`relative flex items-center gap-2 overflow-hidden rounded-lg p-1.5 pr-3 ${p.bankrupt ? "opacity-40" : ""}`}
                  style={isMyTurn ? { backgroundColor: "rgba(255,255,255,0.1)" } : undefined}
                >
                  <div
                    className="pointer-events-none absolute right-0 top-0 bottom-0 rounded-r-lg transition-all"
                    style={{
                      width: isMyTurn ? 6 : 4,
                      backgroundColor: p.color,
                      boxShadow: isMyTurn ? `0 0 10px 2px ${p.color}cc` : "none",
                    }}
                    aria-hidden="true"
                  />
                  <Avatar initials={p.initials} color={p.color} size="sm" avatar={p.avatar} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-bold text-[#f7f0e3]">
                      {p.name}
                      {p.bankrupt ? " · банкрот" : ""}
                    </div>
                    <div className="text-[9px] text-[#aaa2b4]">
                      {p.money.toLocaleString("ru-RU")} К
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {!socketConnected && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-2xl bg-card p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            <div className="font-display text-xl font-bold">Восстанавливаем соединение…</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Если не удаётся подключиться более 2 минут — вас банкротят автоматически.
            </div>
          </div>
        </div>
      )}
            {/* Room info strip — absolute left. На мобиле скрыт, там кнопка «Инфо» */}
      <div className="hidden absolute left-0 top-0 z-10 h-full w-[108px] px-3 py-3 bg-foreground text-border border-t-[#29233e] border-r-
      [#29233e] border-b-[#29233e] border-l-[#29233e] pl-[135px] pr-[135px] justify-center items-center flex-col text-center gap-[14px] 
      rounded-tl-[4px] rounded-tr-[4px] rounded-br-[4px] rounded-bl-[4px] lg:flex">
        <div className="font-mono text-[10px] uppercase leading-relaxed tracking-[.10em] text-primary text-left border-t-[0px] border-r-[0px] 
        border-b-[0px] border-l-[0px] pt-[0px] pb-[0px] mt-[0px] mb-[0px]">
          <span className="block whitespace-nowrap">живая партия</span>
<span className="block whitespace-nowrap">стол #{initialRoomId?.replace('#', '')}</span>
        </div>
        <h1 className="font-display text-[15px] font-bold leading-tight text-border">
          Пятничный клуб
        </h1>
        <div className="mt-1 flex flex-col gap-1 items-center">
          {/* Джекпот */}
          <div className="rounded-lg bg-[#f3e7c8] px-1.5 py-1 text-center">
            <div className="font-mono text-[9px] text-[#7a5c1e]">ДЖЕКПОТ</div>
            <div className="text-[14px]">🎰</div>
          </div>
          {/* Телепорт (всегда показываем как часть интерфейса) */}
          <div className="rounded-lg bg-[#f3e7c8] px-1.5 py-1 text-center">
            <div className="font-mono text-[9px] text-[#7a5c1e]">ТЕЛЕПОРТ</div>
            <div className="text-[14px]">🌀</div>
          </div>
        </div>
      </div>
      {/* Board + Right panel — shared centered container */}
      <div className="flex flex-1 items-start justify-center gap-2 overflow-hidden bg-[#1c1828] p-2 lg:items-start lg:justify-center lg:gap-5 lg:py-1.5 lg:pr-2 lg:pl-[268px]">
                <div className="arena-board-square relative aspect-square h-full max-h-full min-w-0 shrink shadow-[0_18px_60px_rgba(41,35,62,.35)]">
          <div
            className="grid h-full w-full gap-px bg-[#5e5a6e]"
            style={{
              gridTemplateColumns: "1.9fr repeat(9, 1fr) 1.9fr",
              gridTemplateRows: "1.9fr repeat(9, 1fr) 1.9fr",
            }}
          >
        {boardCells.map((_, index) => {
  // Базовые данные клетки (учитывает дизайны админа)
  const cell = getCell(index);

  // Скин показывается ТОЛЬКО если поле куплено и у владельца активирован скин для этого слота
  const ownerId = owners[index];
  const ownerPlayer = ownerId ? players.find((p) => p.id === ownerId) : null;
  const ownerHasSkinForSlot = !!(ownerPlayer?.activeSkins && ownerPlayer.activeSkins[index] !== undefined);

  // Ищем товар по slotIndex — работает и со старыми activeSkins вида "card-XXXX"
  const customSkin = ownerHasSkinForSlot
    ? marketItems.find((m) => m.category === "card" && m.slotIndex === index && m.isActive !== false)
    : null;

  // Админский дизайн карточки (применяется по умолчанию)
  const adminDesign = cardDesigns.find((d) => d.slotIndex === index);

  // Скин игрока имеет приоритет над админским дизайном
  const design: CardDesign | undefined = customSkin
    ? {
        id: customSkin.id,
        slotIndex: index,
        name: customSkin.name,
        type: "property" as CellType,
        price: customSkin.price,
        imageDataUrl: customSkin.imageDataUrl,
        scale: customSkin.scale ?? 1,
      }
    : adminDesign;

  const cellName = design?.name ?? cell.name;
  const cellType = design?.type ?? cell.type;
  const cellPrice = design?.price ?? cell.price;
  const imageUrl = design?.imageDataUrl;
  const { row, col } = cellGridPos(index);
  const isCorner = CORNER.has(index);
  const isTopRow = index >= 1 && index <= 9;
  const isRightCol = index >= 11 && index <= 19;
  const isBottomRow = index >= 21 && index <= 29;
  const isLeftCol = index >= 31 && index <= 39;
    // Если поле стало не собственностью — не показываем полоску и не считаем владельца
  const isProperty = cell.type === "property";
  const group = isProperty ? getCellGroup(index) : null;
              const improvLevel = improvements[index] ?? 0;
              const isMortgaged =
                mortgages[index] !== undefined &&
                mortgages[index] > globalTurnCounter;
              const displayPrice = group
                ? ownerId
                  ? getRent(index, improvements)
                  : cell.price
                : null;
              const stripColor = group?.color;
              const stripDir = isTopRow
                ? "top"
                : isRightCol
                  ? "right"
                  : isBottomRow
                    ? "bottom"
                    : isLeftCol
                      ? "left"
                      : null;
              const cellBg =
                cell.type === "start" ||
                cell.type === "gotojail" ||
                cell.type === "jail" ||
                cell.type === "jackpot" ||
                cell.type === "tax" ||
                cell.type === "chance" ||
                cell.type === "challenge"
                  ? "#ffffff"
                  : "#fdfaf5";
              const isHighlighted =
                pendingAction?.type === "buy" &&
                (pendingAction as BuyA).cellIndex === index;
              const logo = CELL_LOGOS[index];
              const specialIcon = !logo ? SPECIAL_ICONS[cell.type] : null;
                const playersHere = players.filter(
                (p) =>
                  !p.bankrupt &&
                  !(animStep > 0 && p.id === movingPlayerId) &&
                  p.id !== diagonalAnim?.playerId &&
                  getDisplayPos(p.id) === index,
              );

              // Font sizing — 1.1 big logos, 1.2 orientation
              const isEdge = isTopRow || isRightCol || isBottomRow || isLeftCol;
              const isHorizCell = isLeftCol || isRightCol;
              // 1.2: top row tops → LEFT (toward START col1); bottom row tops → LEFT (toward GOTOJAIL col1)
              // Both use rotate(180deg). Left/Right cols = horizontal text.
              const nameStyle: React.CSSProperties =
                !isCorner && isEdge
                  ? isHorizCell
                    ? {
                        fontSize: "5.5px",
                        lineHeight: 1.1,
                        fontWeight: 800,
                        color: ownerPlayer ? "#ffffff" : "#1e1b2e",
                        textShadow: ownerPlayer
                          ? "0 0 3px rgba(0,0,0,0.6)"
                          : "none",
                        overflow: "hidden",
                        textAlign: "center",
                        maxWidth: "100%",
                      }
                    : {
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        fontSize: logo ? "7px" : "8.5px",
                        lineHeight: 1.1,
                        fontWeight: 800,
                        color: ownerPlayer ? "#ffffff" : "#1e1b2e",
                        textShadow: ownerPlayer
                          ? "0 0 3px rgba(0,0,0,0.6)"
                          : "none",
                        overflow: "hidden",
                      }
                  : {
                      fontSize: isCorner
                        ? cell.type === "start"
                          ? "9px"
                          : "7px"
                        : "6px",
                      lineHeight: 1.1,
                      fontWeight: 800,
                      color: ownerPlayer ? "#ffffff" : "#1e1b2e",
                      textShadow: ownerPlayer
                        ? "0 0 3px rgba(0,0,0,0.6)"
                        : "none",
                      textAlign: "center",
                      overflow: "hidden",
                    };

              const stripContent = (vertical?: boolean, flip?: boolean) =>
        displayPrice != null ? (
          <span
            style={{
              fontSize: "10px",            // Увеличили размер шрифта на 2 пункта
              letterSpacing: "1px",       // Добавили расстояние между цифрами
              color: "#fff",
              fontWeight: 800,
              writingMode: vertical ? "vertical-rl" : undefined,
            }}
          >
            {displayPrice.toLocaleString("ru-RU")}
          </span>
        ) : null;

              return (
                <div
                  key={index}
                  style={{
                    gridRow: row,
                    gridColumn: col,
                    backgroundColor: ownerPlayer
                      ? ownerPlayer.color + "B3"
                      : cellBg,
                  }}
                  className={`relative flex flex-col items-center justify-center overflow-visible cursor-default ${isHighlighted ? "ring-2 ring-primary ring-inset" : ""}`}
                  onClick={
                    cell.type === "property"
                      ? (e) => {
                          e.stopPropagation();
                          setSelectedCell(index);
                          setSelectedPos({ x: e.clientX, y: e.clientY });
                        }
                      : undefined
                  }
                >
                  {group && stripDir === "top" && (
                    <div
                      className="absolute inset-x-0 top-0 flex items-center justify-center"
                      style={{
                        height: STRIP,
                        backgroundColor: group.color,
                      }}
                    >
                      {stripContent()}
                    </div>
                  )}
                  {group && stripDir === "right" && (
                    <div
                      className="absolute inset-y-0 right-0 flex items-center justify-center"
                      style={{
                        width: STRIP,
                        backgroundColor: group.color,
                      }}
                    >
                      {stripContent(true)}
                    </div>
                  )}
                  {group && stripDir === "bottom" && (
                    <div
                      className="absolute inset-x-0 bottom-0 flex items-center justify-center"
                      style={{
                        height: STRIP,
                        backgroundColor: group.color,
                      }}
                    >
                      {stripContent()}
                    </div>
                  )}
                  {group && stripDir === "left" && (
                    <div
                      className="absolute inset-y-0 left-0 flex items-center justify-center"
                      style={{
                        width: STRIP,
                        backgroundColor: group.color,
                      }}
                    >
                      {stripContent(true, true)}
                    </div>
                  )}
                  {/* ЗАМОК ЗАЛОГА (на белой стороне, вылет за край 50% в сторону чата) */}
                  {isMortgaged && (
                    <div
                      style={{
                        position: "absolute",
                        /* Верхние: вылет снизу (в сторону чата) */
                        ...(stripDir === "top" && {
                          bottom: 0,
                          left: "50%",
                          transform: "translate(-50%, 50%)",
                        }),
                        /* Нижние: вылет сверху (в сторону чата) */
                        ...(stripDir === "bottom" && {
                          top: 0,
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                        }),
                        /* Левые: вылет справа (в сторону чата) + поворот направо */
                        ...(stripDir === "left" && {
                          right: 0,
                          top: "50%",
                          transform: "translate(50%, -50%) rotate(90deg)",
                        }),
                        /* Правые: вылет слева (в сторону чата) + поворот налево */
                        ...(stripDir === "right" && {
                          left: 0,
                          top: "50%",
                          transform: "translate(-50%, -50%) rotate(-90deg)",
                        }),
                        pointerEvents: "none",
                        display: "flex",
                        flexDirection: "row-reverse", // Цифра всегда слева от замка
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "1px",
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        borderRadius: "6px",
                        padding: "2px 6px",
                        zIndex: 10,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#000",
                          fontWeight: 800,
                        }}
                      >
                        {mortgages[index] - globalTurnCounter}
                      </span>
                      <span style={{ fontSize: "12px", color: "#000" }}>
                        🔒
                      </span>
                    </div>
                  )}

                  {/* ЗВЕЗДЫ УЛУЧШЕНИЙ (н   белой стороне, вылет за край 50% в сторону чата) */}
                  {!isMortgaged && improvLevel > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        /* Верхние: вылет снизу (в сторону чата) */
                        ...(stripDir === "top" && {
                          bottom: 0,
                          left: "50%",
                          transform: "translate(-50%, 50%)",
                        }),
                        /* Нижние: вылет сверху (в сторону чата) */
                        ...(stripDir === "bottom" && {
                          top: 0,
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                        }),
                        /* Левые: вылет справа (в сторону чата) */
                        ...(stripDir === "left" && {
                          right: 0,
                          top: "50%",
                          transform: "translate(50%, -50%) rotate(-90deg)",
                        }),
                        /* Правые: вылеЂ слева (в сторону чата) */
                        ...(stripDir === "right" && {
                          left: 0,
                          top: "50%",
                          transform: "translate(-50%, -50%) rotate(90deg)",
                        }),
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: improvLevel === 5 ? "20px" : "12px", // Отель - 20px, обычные - 12px
                          color: improvLevel === 5 ? "#e7ba68" : "#fff",
                          textShadow:
                            improvLevel === 5
                              ? "0 0 8px rgba(231, 186, 104, 0.9), 0 0 3px rgba(0,0,0,0.6)"
                              : "0 0 3px rgba(0,0,0,0.8), 0 0 1px rgba(0,0,0,0.4)",
                        }}
                      >
                        {improvLevel === 5 ? "★" : "★".repeat(improvLevel)}
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      paddingTop: stripDir === "top" ? STRIP : undefined,
                      paddingRight: stripDir === "right" ? STRIP : undefined,
                      paddingBottom: stripDir === "bottom" ? STRIP : undefined,
                      paddingLeft: stripDir === "left" ? STRIP : undefined,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      height: "100%",
                      overflow: "hidden",
                    }}
                  >
                    {/* Logo or special icon */}
                    {imageUrl ? (
                      <div
                        style={{
                          position: "absolute",
                          top: stripDir === "top" ? "18%" : 0,
                          bottom: stripDir === "bottom" ? "18%" : 0,
                          left: stripDir === "left" ? "18%" : 0,
                          right: stripDir === "right" ? "18%" : 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={imageUrl}
                          alt={cellName}
                          style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            width: "auto",
                            height: "auto",
                            objectFit: "contain",
                            transform: `scale(${design?.scale ?? 1})`,
                            transformOrigin: "center center",
                            filter: ownerPlayer
                              ? "drop-shadow(0 1px 2px rgba(0,0,0,0.47)) drop-shadow(0 0 3px rgba(255,255,255,0.47))"
                              : "drop-shadow(0 1px 1px rgba(0,0,0,0.07))",
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        {logo && (
                          <div
                            style={{
                              fontSize: isCorner
                                ? "22px"
                                : isTopRow || isBottomRow
                                  ? "28px"
                                  : isHorizCell
                                    ? "17px"
                                    : "18px",
                              lineHeight: 1,
                              marginBottom: "1px",
                              filter: ownerPlayer
                                ? "drop-shadow(0 1px 2px rgba(0,0,0,0.47)) drop-shadow(0 0 3px rgba(255,255,255,0.47))"
                                : "drop-shadow(0 1px 1px rgba(0,0,0,0.07))",
                            }}
                          >
                            {logo}
                          </div>
                        )}
                        {specialIcon && cell.type !== "start" && (
                          <div
                            style={{
                              fontSize: isCorner
                                ? "26px"
                                : isTopRow || isBottomRow
                                  ? "26px"
                                  : isHorizCell
                                    ? "17px"
                                    : "20px",
                              lineHeight: 1,
                              filter: ownerPlayer
                                ? "drop-shadow(0 1px 2px rgba(0,0,0,0.47)) drop-shadow(0 0 3px rgba(255,255,255,0.47))"
                                : "drop-shadow(0 1px 1px rgba(0,0,0,0.07))",
                            }}
                          >
                            {specialIcon}
                          </div>
                        )}
                      </>
                    )}
                    {/* Cell name — smaller when logo present */}
                  </div>
              {playersHere.length > 0 && (
                <div
                  className="absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 gap-0.5"
                  style={{ zIndex: movingPlayerId && playersHere.some(p => p.id === movingPlayerId) ? 50 : 10 }}
                >
    {playersHere.map((p) => (
                        <div
                    key={p.id}
                    className="arena-chip flex w-[23px] h-[23px] items-center justify-center rounded-full"
                    style={{
                      position: "relative",
                      zIndex: p.id === movingPlayerId ? 2 : 1,
                      background: "linear-gradient(135deg, #fbe6a0 0%, #e8c463 20%, #d4a647 50%, #b08a2d 80%, #8a6d1f 100%)",
                      padding: 2,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.4), inset 0 0 3px rgba(255,255,255,0.7)",
                    }}
                  >
                    <div
                      className="relative flex h-full w-full items-center justify-center rounded-full overflow-hidden"
                      style={{ backgroundColor: p.color }}
                    >
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{ background: "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 30%, transparent 55%)" }}
                      />
                      <Crown size={12} style={{ color: "#faf0c8", position: "absolute" }} />
                    </div>
                  </div>
    ))}
  </div>
)}
{/* Огненный след при испытании рендерится отдельно поверх доски, здесь оставляем пусто */}
                </div>
              );
            })}

            {/* Center - Chat & Action Panel */}
            <div className="col-start-2 col-end-11 row-start-2 row-end-11 flex flex-col overflow-hidden rounded-sm bg-[#3a3155] text-[#f6efdf]">
              {/* Новая шапка без кубиков */}
              <div className="shrink-0 flex items-center justify-center border-b border-white/10 px-2 py-1.5">
                <div className="font-mono uppercase tracking-[.12em] text-[#e7ba68] text-[12px]">
                  MONOPOLY ARENA
                </div>
              </div>

              {/* Action window */}
              {(pendingAction || auction || pendingTrade) && (
                <div className="shrink-0 mx-1.5 mt-1.5 rounded-xl bg-[#1e1b2e] border border-white/20 p-2.5 shadow-xl">
                  {pendingAction?.type === "buy" &&
                    players[turn]?.id === (currentUser?.id || "you") && // <--- Проверка: видит только активный игрок
                    (() => {
                      const a = pendingAction as BuyA;
                      return (
                        <>
                          <div className="text-[10px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                            💼 Покупка поля
                          </div>
                          <div className="text-[10px] font-bold text-white mb-0.5">
                            {CELL_LOGOS[a.cellIndex] ?? ""}{" "}
                            {boardCells[a.cellIndex].name}
                          </div>
                          <div className="text-[11px] text-white/55 mb-2">
                            Если откажешься — поле уйдёт на аукцион среди других
                            игроков.
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={buyProperty}
                              disabled={player.money < a.price}
                              className="flex-1 rounded-lg bg-[#e96852] py-1.5 text-[11px] font-bold text-white disabled:opacity-40 hover:bg-[#d45a43] transition-colors"
                            >
                              Купить {a.price.toLocaleString("ru-RU")} К
                            </button>
                            <button
                              onClick={sendToAuction}
                              className="flex-1 rounded-lg bg-white/15 py-1.5 text-[11px] font-bold text-white hover:bg-white/20 transition-colors"
                            >
                              На аукцион
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  {pendingAction?.type === "rent" &&
                    (() => {
                      const a = pendingAction as RentA;
                      const canAfford = player.money >= a.amount;
                      const shortfall = Math.max(0, a.amount - player.money);
                      const totalAssets = getPlayerTotalAssets(
                        player.id, players, owners, improvements,
                      );
                      const percentLoss = totalAssets > 0
                        ? Math.min(100, Math.round((shortfall / totalAssets) * 100))
                        : 100;
                      return (
                        <>
                          <div className="text-[10px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                            🏠 Аренда
                          </div>
                          <div className="text-[11px] text-white/80 mb-2">
                            Ты на поле{" "}
                            <b className="text-white">
                              {boardCells[a.cellIndex].name}
                            </b>{" "}
                            игрока <b className="text-white">{a.ownerName}</b>.
                          </div>
                          {!canAfford && (
                            <div className="mb-2 rounded-lg bg-[#e96852]/15 border border-[#e96852]/40 px-2.5 py-2 text-[10px] leading-snug text-[#ff8a75]">
                              <div className="font-bold mb-0.5">⚠️ Не хватает {shortfall.toLocaleString("ru-RU")} К</div>
                              Продайте/заложите поле или улучшение, обменяйте предметы. Это ~{percentLoss}% ваших активов (всего {totalAssets.toLocaleString("ru-RU")} К).
                            </div>
                          )}
                          <button
                            onClick={confirmAction}
                            disabled={!canAfford}
                            className="w-full rounded-lg bg-[#e96852] py-1.5 text-[11px] font-bold text-white hover:bg-[#d45a43] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Заплатить {a.amount.toLocaleString("ru-RU")} К
                          </button>
                          {!canAfford && (
                            <button
                              onClick={surrenderPayment}
                              className="mt-1.5 w-full rounded-lg border border-[#e96852]/40 bg-white/5 py-1.5 text-[11px] font-bold text-[#ff8a75] hover:bg-[#e96852]/15 transition-colors"
                            >
                              🏳️ Сдаться (обанкротиться)
                            </button>
                          )}
                        </>
                      );
                    })()}
                  {pendingAction?.type === "tax" &&
                    (() => {
                      const a = pendingAction as NumA;
                      const canAfford = player.money >= a.amount;
                      const shortfall = Math.max(0, a.amount - player.money);
                      const totalAssets = getPlayerTotalAssets(
                        player.id, players, owners, improvements,
                      );
                      const percentLoss = totalAssets > 0
                        ? Math.min(100, Math.round((shortfall / totalAssets) * 100))
                        : 100;
                      return (
                        <>
                          <div className="text-[10px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                            💸 Налог
                          </div>
                          <div className="text-[11px] text-white/70 mb-2">
                            Штраф уйдёт в копилку джекпота.
                          </div>
                          {!canAfford && (
                            <div className="mb-2 rounded-lg bg-[#e96852]/15 border border-[#e96852]/40 px-2.5 py-2 text-[10px] leading-snug text-[#ff8a75]">
                              <div className="font-bold mb-0.5">⚠️ Не хватает {shortfall.toLocaleString("ru-RU")} К</div>
                              Продайте/заложите поле или улучшение, обменяйте предметы. Это ~{percentLoss}% ваших активов (всего {totalAssets.toLocaleString("ru-RU")} К).
                            </div>
                          )}
                          <button
                            onClick={confirmAction}
                            disabled={!canAfford}
                            className="w-full rounded-lg bg-[#e96852] py-1.5 text-[11px] font-bold text-white hover:bg-[#d45a43] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Заплатить {a.amount.toLocaleString("ru-RU")} К
                          </button>
                          {!canAfford && (
                            <button
                              onClick={surrenderPayment}
                              className="mt-1.5 w-full rounded-lg border border-[#e96852]/40 bg-white/5 py-1.5 text-[11px] font-bold text-[#ff8a75] hover:bg-[#e96852]/15 transition-colors"
                            >
                              🏳️ Сдаться (обанкротиться)
                            </button>
                          )}
                        </>
                      );
                    })()}
                  {pendingAction?.type === "chance" &&
                    (() => {
                      const a = pendingAction as GainA;
                      const canAfford = a.gain || player.money >= a.amount;
                      const shortfall = a.gain ? 0 : Math.max(0, a.amount - player.money);
                      const totalAssets = getPlayerTotalAssets(
                        player.id, players, owners, improvements,
                      );
                      const percentLoss = totalAssets > 0 && shortfall > 0
                        ? Math.min(100, Math.round((shortfall / totalAssets) * 100))
                        : 100;
                      return (
                        <>
                          <div className="text-[10px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                            🎲 Шанс
                          </div>
                          <div className="text-[11px] text-white/80 leading-relaxed mb-2">
                            {a.desc}
                          </div>
                          {!canAfford && (
                            <div className="mb-2 rounded-lg bg-[#e96852]/15 border border-[#e96852]/40 px-2.5 py-2 text-[10px] leading-snug text-[#ff8a75]">
                              <div className="font-bold mb-0.5">⚠️ Не хватает {shortfall.toLocaleString("ru-RU")} К</div>
                              Продайте/заложите поле или улучшение, обменяйте предметы. Это ~{percentLoss}% ваших активов (всего {totalAssets.toLocaleString("ru-RU")} К).
                            </div>
                          )}
                          <button
                            onClick={confirmAction}
                            disabled={!canAfford}
                            className="w-full rounded-lg bg-[#e96852] py-1.5 text-[11px] font-bold text-white hover:bg-[#d45a43] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {a.gain ? "Получить" : "Заплатить"} {a.amount.toLocaleString("ru-RU")} К
                          </button>
                          {!canAfford && (
                            <button
                              onClick={surrenderPayment}
                              className="mt-1.5 w-full rounded-lg border border-[#e96852]/40 bg-white/5 py-1.5 text-[11px] font-bold text-[#ff8a75] hover:bg-[#e96852]/15 transition-colors"
                            >
                              🏳️ Сдаться (обанкротиться)
                            </button>
                          )}
                        </>
                      );
                    })()}
                  {pendingAction?.type === "jackpot-casino" &&
                    (() => {
                      const a = pendingAction as {
                        type: "jackpot-casino";
                        jackpotTotal: number;
                        secret: number;
                        diceCount: number;
                      };

                      {
                        /* Окно выкупа из тюрьмы при нехватке средств */
                      }
                      {
                        jailPaymentPending && (
                          <div className="shrink-0 mx-1.5 mt-1.5 rounded-xl bg-[#1e1b2e] border border-white/20 p-2.5 shadow-xl">
                            <div className="text-[7.5px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                              🔒 Выкуп из тюрьмы
                            </div>
                            {player.money < 500 ? (
                              <>
                                <div className="text-[9px] text-white/75 mb-2">
                                  Недостаточно средств (нужно 500 К). Продайте
                                  или заложите имущество.
                                </div>
                                <button
                                  disabled
                                  className="w-full rounded-lg bg-white/10 py-1.5 text-[9px] font-bold text-white/40 cursor-not-allowed"
                                >
                                  Требуется 500 К
                                </button>
                              </>
                            ) : (
                              <>
                                <div className="text-[9px] text-white/75 mb-2">
                                  Средств достаточно! Заплати 500 К и выходи.
                                </div>
                                <button
                                  onClick={() => payBail()}
                                  className="w-full rounded-lg bg-[#e96852] py-1.5 text-[9px] font-bold text-white hover:bg-[#d45a43] transition-colors"
                                >
                                  Оплатить 500 К
                                </button>
                              </>
                            )}
                          </div>
                        );
                      }
                      // casinoPick stores selected number(s) as comma-separated string
                      const pickedNums: number[] = casinoPick;
                      const needPicks = a.diceCount || 0;
                      return (
                        <>
                          <div className="text-[14px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                            🎰 Казино Джекпота!
                          </div>
                          {needPicks === 0 ? (
                            <>
                              <div className="text-[12px] text-white/70 mb-2">
                                Выбери количество кубиков:
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                {([1, 2, 3] as const).map((dc) => {
                                  const fee =
                                    dc === 1
                                      ? settings.jackpotBet1
                                      : dc === 2
                                        ? settings.jackpotBet2
                                        : settings.jackpotBet3;
                                  const prize =
                                    dc === 1
                                      ? settings.jackpotWin1
                                      : dc === 2
                                        ? settings.jackpotWin2
                                        : settings.jackpotWin3;
                                  const chance =
                                    dc === 1 ? "1/6" : dc === 2 ? "2/6" : "3/6";
                                  const canAfford = player.money >= fee;
                                  return (
                                    <button
                                      key={dc}
                                      onClick={() => {
                                        if (!canAfford) {
                                          addLog(`❌ ${player.name} — недостаточно средств для ставки ${fee} К (есть ${player.money.toLocaleString("ru-RU")} К).`);
                                          return;
                                        }
                                        setPendingAction({
                                          ...a,
                                          diceCount: dc,
                                        });
                                      }}
                                      disabled={!canAfford}
                                      className={`rounded-lg px-1 py-2 text-center transition-colors ${canAfford ? "bg-white/15 hover:bg-[#e7ba68]/30" : "bg-white/5 opacity-40 cursor-not-allowed"}`}
                                    >
                                      <div className="text-[16px]">
                                        {"🎲".repeat(dc)}
                                      </div>
                                      <div className="text-[12px] font-bold text-white mt-0.5">
                                        {fee.toLocaleString("ru-RU")} К
                                      </div>
                                      <div className="text-[11px] text-white/50">
                                        приз {prize.toLocaleString("ru-RU")} К
                                      </div>
                                      <div className="text-[11px] text-[#e7ba68]">
                                        шанс {chance}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              <button
                                onClick={() => {
                                  setPendingAction(null);
                                  addLog(
                                    `🎰 ${player.name} пропустил игру в казино.`,
                                  );
                                  advanceTurn();
                                }}
                                className="mt-2 w-full rounded-lg bg-white/10 py-1.5 text-[11px] font-bold text-white hover:bg-white/20 transition-colors"
                              >
                                Пропустить
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="text-[11px] text-white/70 mb-1">
                                {"🎲 ".repeat(needPicks)} Выбери {needPicks}{" "}
                                число
                                {needPicks > 1
                                  ? needPicks === 2
                                    ? "а"
                                    : ""
                                  : ""}{" "}
                                из 1–6:
                              </div>
                              <div className="text-[11px] text-white/40 mb-2">
                                Ставка:{" "}
                                {(needPicks === 1
                                  ? 350
                                  : needPicks === 2
                                    ? 700
                                    : 1000
                                ).toLocaleString("ru-RU")}{" "}
                                К | Приз:{" "}
                                {(needPicks === 1
                                  ? 3000
                                  : needPicks === 2
                                    ? 2000
                                    : 1000
                                ).toLocaleString("ru-RU")}{" "}
                                К
                              </div>
                              <div className="flex justify-center gap-1 mb-2">
                                {[1, 2, 3, 4, 5, 6].map((n) => {
                                  const sel = pickedNums.includes(n);
                                  const canAdd = pickedNums.length < needPicks;
                                  const toggle = () => {
                                    const newNums = sel
                                      ? pickedNums.filter((x) => x !== n)
                                      : canAdd
                                        ? [...pickedNums, n]
                                        : pickedNums;
                                    setCasinoPick(newNums);
                                  };
                                  return (
                                    <button
                                      key={n}
                                      onClick={toggle}
                                      className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all ${sel ? "bg-[#e7ba68] scale-110" : canAdd ? "bg-white/15 hover:bg-white/25" : "bg-white/5 opacity-30 cursor-not-allowed"}`}
                                    >
                                      <DiceFace value={n} size={28} />
                                    </button>
                                  );
                                })}
                              </div>
                              {pickedNums.length === needPicks && (
                                <button
                                  onClick={() =>
                                    resolveCasino(
                                      pickedNums,
                                      needPicks,
                                      a.secret,
                                    )
                                  }
                                  className="w-full rounded-lg bg-[#32786d] py-1.5 text-[11px] font-bold text-white hover:bg-[#266059] transition-colors"
                                >
                                  Поставить на [{pickedNums.join(", ")}] —
                                  испытать удачу!
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setPendingAction({ ...a, diceCount: 0 });
                                  setCasinoPick([]);
                                }}
                                className="mt-1 w-full rounded-lg py-1 text-[11px] text-white/40 hover:text-white/70"
                              >
                                ← Назад
                              </button>
                            </>
                          )}
                        </>
                      );
                    })()}
                  {pendingAction?.type === "gotojail" &&
                    (() => {
                      return (
                        <>
                          <div className="text-[10px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                            🔒 В тюрьму
                          </div>
                          <div className="text-[9px] text-white/75 mb-2">
                            Отправляешься в тюрьму. До 3 попыток дубля.
                          </div>
                          <button
                            onClick={confirmAction}
                            className="w-full rounded-lg bg-[#e96852] py-1.5 text-[11px] font-bold text-white hover:bg-[#d45a43] transition-colors"
                          >
                            ОК
                          </button>
                        </>
                      );
                    })()}
                  {auction && (
                    <>
                      <div className="text-[10px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                        🔨 Аукцион — {CELL_LOGOS[auction.cellIndex] ?? ""} «
                        {boardCells[auction.cellIndex].name}»
                      </div>
                      <div className="flex items-baseline gap-1 mb-0.5">
                        <span className="text-[10px] text-white/60">
                          Текущая ставка:
                        </span>
                        <span className="text-[11px] font-bold text-white">
                          {auction.price.toLocaleString("ru-RU")} К
                        </span>
                      </div>
                      {auction.highBidder && (
                        <div className="text-[10px] text-white/50 mb-0.5">
                          Лидер:{" "}
                          <b className="text-white">
                            {
                              players.find((p) => p.id === auction.highBidder)
                                ?.name
                            }
                          </b>
                        </div>
                      )}
                      <div className="text-[10px] text-white/70 mb-2">
                        Ход:{" "}
                        <b className="text-white">{auctionCurPlayer?.name}</b>
                      </div>
                          {(() => {
                        const currentBidderId =
                          auction.participants[auction.currentIdx];
                        const currentBidder = players.find(
                          (p) => p.id === currentBidderId,
                        );
                        // Если текущий участник банкрот, просто показываем текст
                        if (currentBidder?.bankrupt)
                          return (
                            <div className="text-center text-[10px] text-white/40 italic">
                              Игрок банкрот
                            </div>
                          );

                        // Проверяем, наш ли это ход в аукционе
                        const isMyAuctionAction = currentBidderId === (currentUser?.id || "you");

                        if (isMyAuctionAction) {
                          const isLastParticipant =
                            auction.participants.length === 1;
                          const isObligatedWinner =
                            isLastParticipant &&
                            auction.highBidder === currentBidderId;
                          const buyPrice = isLastParticipant
                            ? auction.price
                            : auction.price + 100;
                          const canAfford =
                            !currentBidder || currentBidder.money >= buyPrice;

                          // Игрок уже делал ставку и остался один — обязан выкупить.
                          // Отказаться нельзя: иначе это не аукцион.
                          if (isObligatedWinner) {
                            return (
                              <div>
                                <div className="text-[10px] text-white/60 mb-1.5 text-center">
                                  Ваша ставка победила — вы обязаны выкупить поле.
                                </div>
                                <button
                                  onClick={auctionRaise}
                                  disabled={!canAfford}
                                  className="w-full rounded-lg bg-[#32786d] py-1.5 text-[11px] font-bold text-white disabled:opacity-40 hover:bg-[#266059] transition-colors"
                                >
                                  Выкупить за {auction.price.toLocaleString("ru-RU")} К
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div className="flex gap-1.5">
                              <button
                                onClick={auctionRaise}
                                disabled={!canAfford}
                                className="flex-1 rounded-lg bg-[#32786d] py-1.5 text-[11px] font-bold text-white disabled:opacity-40 hover:bg-[#266059] transition-colors"
                              >
                                {isLastParticipant
                                  ? `Выкупить за ${buyPrice.toLocaleString("ru-RU")} К`
                                  : `Поставить ${buyPrice.toLocaleString("ru-RU")} К`}
                              </button>
                              <button
                                onClick={auctionDecline}
                                className="flex-1 rounded-lg bg-white/15 py-1.5 text-[11px] font-bold text-white hover:bg-white/20 transition-colors"
                              >
                                Отказаться
                              </button>
                            </div>
                          );
                        } else {
                          // Если ход не наш, просто показываем, кого ждем
                          return (
                            <div className="text-center text-[10px] text-white/50">
                              Ожидание решения от игрока {currentBidder?.name || "..."}
                            </div>
                          );
                        }
                      })()}
                    </>
                  )}
                  {pendingTrade &&
                    pendingTrade.trade.targetId === (currentUser?.id || "you") && (() => {
                      const target = players.find(
                        (p) => p.id === pendingTrade.trade.targetId,
                      );
                      const initiator = players.find(
                        (p) => p.id === pendingTrade.initiatorId,
                      );
                      if (!target || !initiator) return null;
                      return (
                        <div className="shrink-0 mx-1.5 mt-1.5 rounded-xl bg-[#1e1b2e] border border-white/20 p-2.5 shadow-xl">
                          <div className="text-[7.5px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                            🤝 Предложение договора
                          </div>
                          <div className="text-[9px] text-white/80 mb-2">
                            {initiator.name} предлагает тебе обмен.
                       </div>
                      <div className="flex flex-col gap-1 text-[8px] text-white/60 mb-2">
                    <div>
                       <b className="text-white">{initiator.name}</b> отдаёт: 
                        {pendingTrade.trade.myMoney > 0 && ` 💵${pendingTrade.trade.myMoney}`}
                      {pendingTrade.trade.myCards.length > 0 && " 🃏" + pendingTrade.trade.myCards.map(ci => boardCells[ci].name).join(", ")}
                      </div>
                       <div>
                    <b className="text-white">Вы</b> отдаёте: 
                        {pendingTrade.trade.theirMoney > 0 && ` 💵${pendingTrade.trade.theirMoney}`}
                       {pendingTrade.trade.theirCards.length > 0 && " 🃏" + pendingTrade.trade.theirCards.map(ci => boardCells[ci].name).join(", ")}
                     </div>
                       </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                // Применить сделку
                                const nOwners = { ...owners };
                                pendingTrade.trade.myCards.forEach((ci) => {
                                  nOwners[ci] = pendingTrade.trade.targetId;
                                });
                                pendingTrade.trade.theirCards.forEach((ci) => {
                                  nOwners[ci] = initiator.id;
                                });
                                setOwners(nOwners);
                                setPlayers((ps) =>
                                  ps.map((p) => {
                                    if (p.id === initiator.id)
                                      return {
                                        ...p,
                                        money:
                                          p.money -
                                          pendingTrade.trade.myMoney +
                                          pendingTrade.trade.theirMoney,
                                      };
                                    if (p.id === target.id)
                                      return {
                                        ...p,
                                        money:
                                          p.money -
                                          pendingTrade.trade.theirMoney +
                                          pendingTrade.trade.myMoney,
                                      };
                                    return p;
                                  }),
                                );
                                addLog(
                                  `✅ ${target.name} принял договор с ${initiator.name}!`,
                                );

                                socket.emit('trade-resolved', { roomId: initialRoomId, initiatorId: tradeInitiator?.id });

                                // Возвращаем ход инициатору с учётом дублей
                                const initInfo = tradeInitiator;
                                setPendingTrade(null);
                                setTradeInitiator(null);
                                if (initInfo) {
                                  setImprovedGroupsThisTurn([]); // Сбрасываем историю улучшений при возврате хода
                                  // Если у инициатора был дубль и он не исчерпан, вернём ему ход с дублем
                                  if (
                                    initInfo.isDouble &&
                                    initInfo.doubleCount < 3
                                  ) {
                                    setTurn(initInfo.fromIdx);
                                    setDoubleCount(initInfo.doubleCount);
                                    setIsDoubleRoll(true);
                                    setMessage(
                                      `${players[initInfo.fromIdx].name}, дубль! Бросай кубики снова.`,
                                    );
                                    setRolled(false);
                                  } else {
                                    // Иначе просто вернём ход
                                    setTurn(initInfo.fromIdx);
                                    setMessage(
                                      `Ход возвращён ${players[initInfo.fromIdx].name}.`,
                                    );
                                  }
                                } else {
                                  // Если по какой-то причине нет информации об инициаторе, просто продолжим
                                  advanceTurn();
                                }
                              }}
                              className="flex-1 rounded-lg bg-[#32786d] py-1.5 text-[9px] font-bold text-white hover:bg-[#266059] transition-colors"
                            >
                              Принять
                            </button>
                            <button
                              onClick={() => {
                                addLog(
                                  `❌ ${target.name} отказался от договора с ${initiator.name}.`,
                                );
                                // Возвращаем ход инициатору с учётом дублей
                                const initInfo = tradeInitiator;
                                setPendingTrade(null);
                                setTradeInitiator(null);
                                if (initInfo) {
                                  if (
                                    initInfo.isDouble &&
                                    initInfo.doubleCount < 3
                                  ) {
                                    setTurn(initInfo.fromIdx);
                                    setDoubleCount(initInfo.doubleCount);
                                    setIsDoubleRoll(true);
                                    setMessage(
                                      `${players[initInfo.fromIdx].name}, дубль! Бросай кубики снова.`,
                                    );
                                    setRolled(false);
                                  } else {
                                    setTurn(initInfo.fromIdx);
                                    setMessage(
                                      `Ход возвращён ${players[initInfo.fromIdx].name}.`,
                                    );
                                  }
                                } else {
                                  advanceTurn();
                                }
                              }}
                              className="flex-1 rounded-lg bg-white/15 py-1.5 text-[9px] font-bold text-white hover:bg-white/20 transition-colors"
                            >
                              Отказаться
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                </div>
              )}

              {/* Inline trade (1.6) */}
              {trade && tradeTarget && (
                <div className="shrink-0 mx-1.5 mb-1 rounded-xl border border-[#e7ba68]/30 bg-[#1a1729] overflow-hidden">
                  <div className="flex items-center justify-between px-2 py-1.5 bg-[#29233e] border-b border-white/10">
                    <span className="font-mono text-[13px] font-bold text-[#e7ba68] uppercase tracking-wide">
                      🤝 Договор
                    </span>
                    <button
                      onClick={() => setTrade(null)}
                      className="text-white/40 hover:text-white"
                    >
                      <X size={10} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-white/5 text-white">
                    <div className="bg-[#1a1729] p-1.5">
                      <div className="text-[13px] font-bold text-[#e96852] mb-1">
                        {player.name}{" "}
                        <span className="text-white/40 font-normal">
                          предлагает
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[13px] text-white/50">💵</span>
                        <input
  type="number"
  min={0}
  value={trade.myMoney === 0 ? "" : trade.myMoney}
  placeholder="0"
  onFocus={(e) => e.target.select()}
  onChange={(e) =>
    setTrade({
      ...trade,
      myMoney: Math.max(0, Number(e.target.value) || 0),
    })
  }
  className="w-full rounded bg-white/10 px-2 py-1.5 text-[13px] font-mono text-white border-none outline-none placeholder:text-white/70 placeholder:font-mono"
/>
                      </div>
                      <div className="space-y-0.5 max-h-40 overflow-y-auto">
                        {myOwnedCards.map((ci) => (
                          <label
                            key={ci}
                            className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-0.5"
                            style={{ backgroundColor: getCellGroup(ci)?.color || 'transparent' }}
                          >
                            <input
                              type="checkbox"
                              checked={trade.myCards.includes(ci)}
                              onChange={(e) =>
                                setTrade({
                                  ...trade,
                                  myCards: e.target.checked
                                    ? [...trade.myCards, ci]
                                    : trade.myCards.filter((x) => x !== ci),
                                })
                              }
                              className="accent-[#e96852] w-3.5 h-3.5"
                            />
                            <span className="text-[13px] truncate text-white">
                              {CELL_LOGOS[ci] ?? ""} {boardCells[ci].name}
                            </span>
                          </label>
                        ))}
                        {myOwnedCards.length === 0 && (
                          <div className="text-[11px] text-white/30 italic">
                            Нет карточек
                          </div>
                        )}
                      </div>
                      <div className="mt-1 text-[13px] font-bold text-[#e96852]">
                        {(
                          trade.myMoney +
                          trade.myCards.reduce(
                            (s, ci) => s + (boardCells[ci].price ?? 0),
                            0,
                          )
                        ).toLocaleString("ru-RU")}{" "}
                        К
                      </div>
                    </div>
                    <div className="bg-[#1a1729] p-1.5">
                      <div
                        className="text-[13px] font-bold mb-1"
                        style={{ color: tradeTarget.color }}
                      >
                        {tradeTarget.name}{" "}
                        <span className="text-white/40 font-normal">
                          отдаёт
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[13px] text-white/50">💵</span>
                        <input
  type="number"
  min={0}
  value={trade.theirMoney === 0 ? "" : trade.theirMoney}
  placeholder="0"
  onFocus={(e) => e.target.select()}
  onChange={(e) =>
    setTrade({
      ...trade,
      theirMoney: Math.max(0, Number(e.target.value) || 0),
    })
  }
  className="w-full rounded bg-white/10 px-2 py-1.5 text-[13px] font-mono text-white border-none outline-none placeholder:text-white/70 placeholder:font-mono"
/>
                      </div>
                      <div className="space-y-0.5 max-h-40 overflow-y-auto">
                        {tradeTargetCards.map((ci) => (
                          <label
                            key={ci}
                            className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-0.5"
                            style={{ backgroundColor: getCellGroup(ci)?.color || 'transparent' }}
                          >
                            <input
                              type="checkbox"
                              checked={trade.theirCards.includes(ci)}
                              onChange={(e) =>
                                setTrade({
                                  ...trade,
                                  theirCards: e.target.checked
                                    ? [...trade.theirCards, ci]
                                    : trade.theirCards.filter((x) => x !== ci),
                                })
                              }
                              className="accent-[#32786d] w-3.5 h-3.5"
                            />
                            <span className="text-[13px] truncate text-white">
                              {CELL_LOGOS[ci] ?? ""} {boardCells[ci].name}
                            </span>
                          </label>
                        ))}
                        {tradeTargetCards.length === 0 && (
                          <div className="text-[11px] text-white/30 italic">
                            Нет карточек
                          </div>
                        )}
                      </div>
                      <div
                        className="mt-1 text-[13px] font-bold"
                        style={{ color: tradeTarget.color }}
                      >
                        {(
                          trade.theirMoney +
                          trade.theirCards.reduce(
                            (s, ci) => s + (boardCells[ci].price ?? 0),
                            0,
                          )
                        ).toLocaleString("ru-RU")}{" "}
                        К
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const myTotal = trade.myMoney + trade.myCards.reduce((s, ci) => s + (boardCells[ci].price ?? 0), 0);
                    const theirTotal = trade.theirMoney + trade.theirCards.reduce((s, ci) => s + (boardCells[ci].price ?? 0), 0);
                    const overLimit = myTotal > 0 && theirTotal > 0 && (myTotal > theirTotal * 2 || theirTotal > myTotal * 2);
                    const notEnoughMy = trade.myMoney > player.money;
                    const notEnoughTheir = trade.theirMoney > tradeTarget.money;
                    if (!overLimit && !notEnoughMy && !notEnoughTheir) return null;
                    return (
                      <div className="px-2 pb-1.5 bg-[#0f0d1a]">
                        {notEnoughMy && (
                          <div className="rounded bg-[#e96852]/20 border border-[#e96852]/40 px-2 py-1 text-[10px] font-bold text-[#ff8a75]">
                            ❌ У вас недостаточно средств ({trade.myMoney.toLocaleString("ru-RU")} К &gt; {player.money.toLocaleString("ru-RU")} К)
                          </div>
                        )}
                        {notEnoughTheir && (
                          <div className="mt-1 rounded bg-[#e96852]/20 border border-[#e96852]/40 px-2 py-1 text-[10px] font-bold text-[#ff8a75]">
                            ❌ У {tradeTarget.name} недостаточно средств ({trade.theirMoney.toLocaleString("ru-RU")} К &gt; {tradeTarget.money.toLocaleString("ru-RU")} К)
                          </div>
                        )}
                        {overLimit && (
                          <div className="mt-1 rounded bg-[#e96852]/20 border border-[#e96852]/40 px-2 py-1 text-[10px] font-bold text-[#ff8a75]">
                            ⚠️ Разница в стоимости превышает лимит (максимум х2). Сейчас: {myTotal.toLocaleString("ru-RU")} К ↔ {theirTotal.toLocaleString("ru-RU")} К
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex gap-1 p-1.5 bg-[#0f0d1a]">
                    <button
                      onClick={() => setTrade(null)}
                      className="flex-1 rounded py-1 text-[13px] font-bold text-white/50 border border-white/10 hover:border-white/20"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={proposeTrade}
                      className="flex-1 rounded py-1 text-[13px] font-bold text-white bg-[#32786d] hover:bg-[#266059]"
                    >
                      Предложить
                    </button>
                  </div>
                </div>
              )}
              <div className="min-h-0 min-w-0 flex-1 relative overflow-hidden p-1.5 pt-1 text-[14px] lg:text-[12px]">
                {/* Сами логи чата (объединенный и отсортированный поток) */}
                <div
                  ref={logContainerRef}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                    // 20px — небольшой допуск, чтобы «почти у низа» тоже считалось низом
                    setChatAutoScroll(distanceFromBottom <= 20);
                  }}
                  className="space-y-px overflow-y-auto overflow-x-hidden h-full w-full pb-2 [&::-webkit-scrollbar]:hidden"
                >
                  {[...log, ...chatMessages]
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .map((item, i) => {
                      // Проверяем, есть ли поле 'from'. Если есть — это сообщение игрока.
                      if ("from" in item) {
                        return (
                          <div key={`c-${i}`} className="leading-tight break-words whitespace-pre-wrap">
                            <span className="font-bold text-[#e7ba68]">
                              {item.from}:
                            </span>{" "}
                            {item.text}
                          </div>
                        );
                      } else {
                        // Лог игры. Разбиваем строку по символам кубиков —
                        // их рендерим крупнее и без курсива, чтобы точки были видны.
                        const DICE_RE = /([⚀⚁⚂⚃⚄⚅])/;
                        const parts = item.text.split(DICE_RE);
                        const isSpecial = item.type === "special";
                        return (
                          <div
                            key={`l-${i}`}
                            className={`leading-tight break-words whitespace-pre-wrap ${isSpecial ? "text-orange-400" : "italic text-white/65"}`}
                            style={isSpecial ? { color: "#f97316" } : {}}
                          >
                            {parts.map((part, idx) => {
                              const val = DICE_FACE_INDEX[part];
                              if (val) {
                                return <DiceFace key={idx} value={val} size={18} />;
                              }
                              return <span key={idx}>{part}</span>;
                            })}
                          </div>
                        );
                      }
                    })}
                </div>

                {/* ОВЕРЛЕЙ С 3D КУБИКАМИ */}
                {diceRolling && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#3a3155]/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="flex gap-4">
                      {/* Заменили true на isSpinning */}
                      <ThreeDDice
                        value={targetDice[0]}
                        isRolling={isSpinning}
                      />
                      <ThreeDDice
                        value={targetDice[1]}
                        isRolling={isSpinning}
                      />
                    </div>
                  </div>
                )}
              </div>
              <form
                onSubmit={sendChat}
                className="shrink-0 flex gap-1.5 border-t border-white/10 p-1.5"
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Сообщение…"
                  className="min-w-0 flex-1 rounded bg-white/10 px-2 py-1 text-[12px] text-white placeholder:text-white/35 outline-none lg:px-2.5 lg:py-1.5"
                />
                <button
                  type="submit"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#e96852] text-white lg:h-8 lg:w-8"
                >
                  <Send size={12} />
                </button>
              </form>
            </div>
          </div>
                    {movingPlayer && movingCellIdx !== null && (() => {
            // Компенсация: если в стартовой клетке было несколько фишек,
            // летящая фишка должна стартовать с той же точки, где стояла статичная.
            let startOffsetX = 0;
            if (animStep === 0 && animPath && movingPlayerId) {
              const oldPos = animPath[0];
              const allAtOld = players.filter((p) => !p.bankrupt && p.position === oldPos);
              const movingIdx = allAtOld.findIndex((p) => p.id === movingPlayerId);
              if (movingIdx !== -1 && allAtOld.length > 1) {
                // 23px — ширина фишки, 2px — gap-0.5 между ними
                startOffsetX = (movingIdx - (allAtOld.length - 1) / 2) * 25;
              }
            }
            return (
              <div
                className="pointer-events-none absolute z-30"
                style={{
                  left: `${getCellCenterPct(movingCellIdx).x}%`,
                  top: `${getCellCenterPct(movingCellIdx).y}%`,
                  transform: `translate(-50%, -50%) translateX(${startOffsetX}px)`,
                  opacity: animStep === 0 ? 0 : 1,
              transition: `left ${animPath && animPath.length - 1 <= 2 ? 550 : animPath && animPath.length - 1 <= 6 ? 416 : 320}ms linear, top 
              ${animPath && animPath.length - 1 <= 2 ? 550 : animPath && animPath.length - 1 <= 6 ? 416 : 320}ms linear, transform 
              ${animPath && animPath.length - 1 <= 2 ? 550 : animPath && animPath.length - 1 <= 6 ? 416 : 320}ms linear, opacity 0ms`,
                }}
              >
                <div
                  className="arena-chip flex w-[23px] h-[23px] items-center justify-center rounded-full"
                  style={{
                    background: "linear-gradient(135deg, #fbe6a0 0%, #e8c463 20%, #d4a647 50%, #b08a2d 80%, #8a6d1f 100%)",
                    padding: 2,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.4), inset 0 0 3px rgba(255,255,255,0.7)",
                  }}
                >
                  <div
                    className="relative flex h-full w-full items-center justify-center rounded-full overflow-hidden"
                    style={{ backgroundColor: movingPlayer.color }}
                  >
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ background: "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 30%, transparent 55%)" }}
                    />
                    <Crown size={12} style={{ color: "#faf0c8", position: "absolute" }} />
                  </div>
                </div>
              </div>
            );
          })()}
          {diagonalAnim && (() => {
            const dp = players.find((pl) => pl.id === diagonalAnim.playerId);
            if (!dp) return null;
            const from = getCellCenterPct(diagonalAnim.from);
            const to = getCellCenterPct(diagonalAnim.to);
            return (
              <div
                className="pointer-events-none absolute z-30"
                style={{
                  left: `${from.x}%`,
                  top: `${from.y}%`,
                  transform: "translate(-50%, -50%)",
                  transition: "left 1.15s ease-in-out, top 1.15s ease-in-out",
                }}
                ref={(el) => {
                  if (!el) return;
                  requestAnimationFrame(() => {
                    el.style.left = `${to.x}%`;
                    el.style.top = `${to.y}%`;
                  });
                }}
              >
                <div
                  className="arena-chip flex w-[23px] h-[23px] items-center justify-center rounded-full"
                  style={{
                    background: "linear-gradient(135deg, #fbe6a0 0%, #e8c463 20%, #d4a647 50%, #b08a2d 80%, #8a6d1f 100%)",
                    padding: 2,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.4), inset 0 0 3px rgba(255,255,255,0.7)",
                  }}
                >
                  <div
                    className="relative flex h-full w-full items-center justify-center rounded-full overflow-hidden"
                    style={{ backgroundColor: dp.color }}
                  >
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ background: "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 30%, transparent 55%)" }}
                    />
                    <Crown size={12} style={{ color: "#faf0c8", position: "absolute" }} />
                  </div>
                </div>
              </div>
            );
          })()}

                    {/* Огненный след при испытании — пламя за фишкой (4 слоя) */}
          {fireTrailAnim && (() => {
            const from = getCellCenterPct(fireTrailAnim.from);
            const to = getCellCenterPct(fireTrailAnim.to);
            const dp = players.find((pl) => pl.id === fireTrailAnim.playerId);
            if (!dp) return null;

            const lineD = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

            return (
              <div key={`fire-${fireTrailAnim.from}-${fireTrailAnim.to}`} className="pointer-events-none absolute inset-0 z-[100] overflow-visible">
                <style>{`
                  @keyframes tailOuter { to { stroke-dashoffset: -82; } }
                  @keyframes tailMid   { to { stroke-dashoffset: -86; } }
                  @keyframes tailInner { to { stroke-dashoffset: -91; } }
                  @keyframes tailCore  { to { stroke-dashoffset: -95; } }
                  @keyframes flicker1 { 0%,100% { opacity: 0.25; } 50% { opacity: 0.55; } }
                  @keyframes flicker2 { 0%,100% { opacity: 0.55; } 50% { opacity: 0.9; } }
                  @keyframes flicker3 { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }
                  @keyframes emberFloat {
                    0% { transform: translate(0, 0) scale(1); opacity: 1; }
                    100% { transform: translate(-15px, -25px) scale(0); opacity: 0; }
                  }
                `}</style>
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ overflow: 'visible' }}
                >
                  <defs>
                    <filter id="flameBlurSoft"><feGaussianBlur stdDeviation="1.4" /></filter>
                    <filter id="flameBlurMed"><feGaussianBlur stdDeviation="0.8" /></filter>
                    <filter id="flameBlurSharp"><feGaussianBlur stdDeviation="0.4" /></filter>
                    <filter id="flameBlurCrisp"><feGaussianBlur stdDeviation="0.12" /></filter>
                  </defs>

                  {/* Дым/жара — самый длинный, размытый, тёмно-красный. */}
                  <path d={lineD} pathLength="100" fill="none"
                    stroke="#ff2200" strokeWidth="3.2" strokeLinecap="round"
                    strokeDasharray="20 80"
                    filter="url(#flameBlurSoft)"
                    style={{ animation: "tailOuter 1.5s linear forwards, flicker1 0.28s infinite" }}
                  />
                  {/* Основное пламя — оранжевое. */}
                  <path d={lineD} pathLength="100" fill="none"
                    stroke="#ff8c00" strokeWidth="2.0" strokeLinecap="round"
                    strokeDasharray="15 85"
                    filter="url(#flameBlurMed)"
                    style={{ animation: "tailMid 1.5s linear forwards, flicker2 0.22s infinite" }}
                  />
                  {/* Яркая зона — жёлтая. */}
                  <path d={lineD} pathLength="100" fill="none"
                    stroke="#ffd700" strokeWidth="1.1" strokeLinecap="round"
                    strokeDasharray="10 90"
                    filter="url(#flameBlurSharp)"
                    style={{ animation: "tailInner 1.5s linear forwards, flicker3 0.18s infinite" }}
                  />
                  {/* Ядро — белое, тонкое, едет с фишкой. */}
                  <path d={lineD} pathLength="100" fill="none"
                    stroke="#ffffff" strokeWidth="0.5" strokeLinecap="round"
                    strokeDasharray="6 94"
                    filter="url(#flameBlurCrisp)"
                    style={{ animation: "tailCore 1.5s linear forwards" }}
                  />
                </svg>

                {/* Искры у головы пламени */}
                <div className="absolute" style={{ left: `${from.x}%`, top: `${from.y}%` }}>
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-1.5 w-1.5 rounded-full bg-yellow-300"
                      style={{
                        left: `${(Math.random() - 0.5) * 26}px`,
                        top: `${(Math.random() - 0.5) * 26}px`,
                        animation: `emberFloat ${0.4 + Math.random() * 0.5}s infinite ease-out`,
                        animationDelay: `${Math.random() * 0.5}s`,
                        boxShadow: "0 0 8px #ff8c00",
                      }}
                    />
                  ))}
                </div>

                {/* Фишка игрока — летит вместе с пламенем */}
                <div
                  className="arena-chip absolute z-[110] flex w-[23px] h-[23px] items-center justify-center rounded-full"
                  style={{
                    left: `${from.x}%`,
                    top: `${from.y}%`,
                    transform: "translate(-50%, -50%)",
                    background: "linear-gradient(135deg, #fbe6a0 0%, #e8c463 20%, #d4a647 50%, #b08a2d 80%, #8a6d1f 100%)",
                    padding: 2,
                    boxShadow: "0 0 25px #ff8c00, inset 0 0 3px rgba(255,255,255,0.7)",
                    transition: "left 1.5s cubic-bezier(0.4, 0, 0.2, 1), top 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                  ref={(el) => {
                    if (!el) return;
                    requestAnimationFrame(() => {
                      el.style.left = `${to.x}%`;
                      el.style.top = `${to.y}%`;
                    });
                  }}
                >
                  <div
                    className="relative flex h-full w-full items-center justify-center rounded-full overflow-hidden"
                    style={{ backgroundColor: dp.color }}
                  >
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ background: "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 30%, transparent 55%)" }}
                    />
                    <Crown size={12} style={{ color: "#faf0c8", position: "absolute" }} />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right control panel */}
<div className="flex h-full w-[140px] shrink-0 flex-col gap-1.5 overflow-y-auto p-1 lg:w-[255px] lg:gap-2 lg:p-1.5">
          <div className={`rounded-2xl border bg-card p-2 lg:p-3 transition-all duration-300 ${turnFlash ? "border-red-500 ring-2 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]" : "border-card-border"}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[8px] uppercase tracking-[.15em] text-primary">
                  ход сейчас
                </div>
                <h2 className="font-display text-base font-bold leading-tight lg:text-lg">
                  {player.name}
                </h2>
              </div>
              <Avatar
                initials={player.initials}
                color={player.color}
                size="xs"
              />
            </div>
            <div
              className={`mt-1.5 flex items-center justify-between rounded-lg px-2 py-1 text-[11px] lg:mt-2.5 lg:rounded-xl lg:px-3 lg:py-1.5 lg:text-xs ${timeLeft <= 10 ? "bg-[#f6dfd7] text-primary" : "bg-muted"}`}
            >
              <span className="flex items-center gap-1.5 font-bold">
                <Timer size={12} /> Время хода
              </span>
              <span className="font-mono font-bold">{timeLeft} сек</span>
            </div>
            <div className="mt-1.5 rounded-lg bg-muted px-2 py-1.5 text-[12px] leading-snug lg:mt-2 lg:rounded-xl lg:px-3 lg:py-2 lg:text-[11px]">
              {message}
            </div>
            <div className="mt-1.5 flex items-center justify-between lg:mt-2">
              <div>
                <div className="text-[11px] text-muted-foreground">На руках</div>
                <div className="font-mono text-[14px] font-bold lg:text-sm">
                  {player.money.toLocaleString("ru-RU")}{" "}
                  <span className="text-[11px] text-muted-foreground">К</span>
                </div>
              </div>
              <div className="max-w-[90px] text-right lg:max-w-[115px]">
                <div className="text-[11px] text-muted-foreground">Клетка</div>
                <div className="truncate text-[12px] font-bold lg:text-[11px]">
                  {currentCellName}
                </div>
              </div>
            </div>
                        {inJail ? (
              <>
                {/* Кнопка броска видна всем, но активируется только у того, чей ход */}
                <button
                  onClick={() => {
                    console.log("🔒 Нажата тюремная кнопка броска. Отправляем запрос на сервер...");
                    socket.emit('roll-dice-request', { 
                      roomId: initialRoomId, 
                      playerId: player.id || "you" 
                    });
                  }}
                  disabled={
                    busy || 
                    (initialRoomId ? turn !== players.findIndex(p => p.name === (currentUser?.name || player?.name)) : false)
                  }
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-45 lg:mt-3 lg:rounded-xl lg:py-2.5"
                >
                  <Dice5 size={13} />
                  {diceRolling ? "…бросок…" : "Бросить кубики"}
                </button>
                
                {/* Кнопка выкупа: видна и активна только тому, кто сам в тюрьме */}
                {players[turn]?.id === (currentUser?.id || "you") && (
                  <button
                    onClick={payBail}
                    disabled={
                      (busy && !jailPaymentPending) || // <--- ИЗМЕНИЛИ: Разблокируем при обязательном выкупе
                      !!vote ||
                      !!pendingAction ||
                      !!auction ||
                      gameOver ||
                      player.money < 500
                    }
                    className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-muted py-2 text-xs font-bold disabled:opacity-45"
                  >
                    <Banknote size={13} /> Заплатить (500 К)
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => {
                  console.log("🎲 Нажата основная кнопка броска. Отправляем запрос на сервер...");
                  socket.emit('roll-dice-request', { 
                    roomId: initialRoomId, 
                    playerId: player.id || "you" 
                  });
                }}
                disabled={
                  busy || 
                  (initialRoomId ? turn !== players.findIndex(p => p.name === (currentUser?.name || player?.name)) : false)
                }
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-45 lg:mt-3 lg:rounded-xl lg:py-2.5"
              >
                <Dice5 size={15} />
                {diceRolling
                  ? "…бросок…"
                  : rolled
                    ? `Выпало: ${total}`
                    : "Бросить кубики"}
              </button>
            )}
            <button
              onClick={() => {
                const myId = currentUser?.id || "you";
                const me = players.find(p => p.id === myId);

                if (!me) { onExit(); return; }

                // Игрок УЖЕ выбыл (банкрот) — показываем модалку с наградой, потом выходим
                if (me.bankrupt && !me.leftAlive) {
                  if (initialRoomId) socket.emit('leave-game', { roomId: initialRoomId, userId: myId });
                  // Награды начисляет сервер. Клиент просто ждёт game-rewards
                  // и покажет модалку через подписку socket.on('game-rewards').
                  return;
                }

                // Игрок ЖИВОЙ — выходим без награды
                if (initialRoomId) socket.emit('leave-game', { roomId: initialRoomId, userId: myId });
                handleVoluntaryLeave(myId);
                onExit();
              }}
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-input py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted lg:mt-2 lg:rounded-xl lg:py-2"
            >
              <LogOut size={12} /> Покинуть игру
            </button>
          </div>


          {(() => {
            const me = players.find(p => p.id === (currentUser?.id || "you"));
            if (!me || !me.bankrupt || me.leftAlive) return null;
            return (
            <div className="rounded-2xl border border-[#e96852]/40 bg-[#f6dfd7] p-3 text-center">
              <div className="font-bold text-[12px] text-primary">👀 Вы выбыли</div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                Наблюдайте за партией. Нажмите «Покинуть игру», когда захотите выйти — награда будет показана.
              </div>
            </div>
            );
          })()}

          {/* Players list with hover popup */}
          <div className="rounded-2xl border border-card-border bg-card p-1.5 lg:p-3">
            <div className="mb-1.5 flex items-center justify-center gap-3 lg:mb-2 lg:justify-between">
              <h2 className="font-display text-[14px] font-bold lg:text-sm">Игроки</h2>
              <span className="font-mono text-[11px] text-muted-foreground lg:text-[9px]">
                {alive.length} / {players.length}
              </span>
            </div>
            <div className="space-y-0.5 lg:space-y-1">
              {players.map((p, i) => {
                const isCurrentTurn =
                  p.id ===
                    (auction
                      ? auction.participants[auction.currentIdx]
                      : players[turn]?.id) && !p.bankrupt;
                return (
                <div
                  key={p.id}
                  className={`relative flex items-center gap-1.5 overflow-hidden rounded-lg py-0.5 pl-1 pr-2 cursor-pointer lg:gap-2 lg:p-1.5 lg:pr-3 ${!isCurrentTurn ? "hover:bg-muted" : ""} ${p.bankrupt ? "opacity-40" : ""}`}
                  style={
                    isCurrentTurn
                      ? { backgroundColor: "#ffffff" }
                      : undefined
                  }
                  onClick={(e) => {
  e.stopPropagation();
  if (!p.bankrupt) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPlayerHover({
                        pid: p.id,
                        x: rect.left - 4,
                        y: rect.top,
                      });
                    }
                  }}
                >
                  <div
                    className="pointer-events-none absolute right-0 top-0 bottom-0 rounded-r-lg transition-all"
                    style={{
                      width: isCurrentTurn ? 8 : 6,
                      backgroundColor: p.color,
                      boxShadow: isCurrentTurn
                        ? `0 0 12px 3px ${p.color}cc, 0 0 24px 6px ${p.color}66`
                        : "none",
                    }}
                    aria-hidden="true"
                  />
                  <Avatar initials={p.initials} color={p.color} size="xs" avatar={p.avatar} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold lg:text-[11px]">
  {p.name}
  {p.vipUntil && new Date(p.vipUntil) > new Date() && (
    <span className="ml-1 rounded bg-[#d3a247] px-1 py-0.5 text-[9px] font-bold text-white">VIP</span>
  )}
  {p.bankrupt ? " · банкрот" : ""}
  {((p?.jailTurns ?? 0) > 0 ? " 🔒 " : "")}
</div>
                    <div className="text-[10px] text-muted-foreground lg:text-[9px]">
                      {p.money.toLocaleString("ru-RU")} К ·{" "}
                      {boardCells[p.position]?.name ?? "?"}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* Rating panel */}
          {showRating && typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches &&
            (() => {
              const ranked = [...players]
                .map((p) => {
                  const ownedVal = Object.entries(owners)
                    .filter(([, oid]) => oid === p.id)
                    .reduce(
                      (s, [ci]) => s + (boardCells[Number(ci)].price ?? 0),
                      0,
                    );
                  return { ...p, totalWealth: p.money + ownedVal };
                })
                .sort((a, b) => b.totalWealth - a.totalWealth);
              return (
                <div className="hidden rounded-2xl border border-card-border bg-card p-3 lg:block">
                  <div className="mb-2 font-mono text-[8px] uppercase tracking-wide text-muted-foreground">
                    Рейтинг — богатейшие к беднейшим
                  </div>
                  <div className="space-y-1">
                    {ranked.map((p, rank) => (
                      <div
                        key={p.id}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${p.bankrupt ? "opacity-40" : ""} ${rank === 0 ? "bg-[#f3e7c8]" : "bg-muted"}`}
                      >
                        <span
                          className="font-mono text-[10px] font-bold w-4 shrink-0"
                          style={{ color: rank === 0 ? "#99711f" : "#aaa" }}
                        >
                          #{rank + 1}
                        </span>
                        <Avatar
                          initials={p.initials}
                          color={p.color}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-bold">
                            {p.name}
                          </div>
                          <div className="text-[8px] text-muted-foreground">
                            {p.totalWealth.toLocaleString("ru-RU")} К
                          </div>
                        </div>
                        {rank === 0 && !p.bankrupt && (
                          <span className="text-[11px]">👑</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          <button
            onClick={() => setShowRating((r) => !r)}
            className="hidden w-full items-center justify-center gap-2 rounded-xl border border-input bg-card py-2 text-xs font-bold lg:flex"
          >
            <Activity size={12} />{" "}
            {showRating ? "Скрыть рейтинг" : "Рейтинг игроков"}
          </button>
        </div>
      </div>
      {/* Player hover popup (1.8.1) */}
      {playerHover &&
        (() => {
          const tp = players.find((p) => p.id === playerHover.pid);
          if (!tp) return null;
          return (
            <div
              className="fixed z-50 w-44 rounded-xl border border-card-border bg-card shadow-2xl overflow-hidden"
              style={{
                left: Math.max(4, playerHover.x - 180),
                top: playerHover.y,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Avatar initials={tp.initials} color={tp.color} size="sm" avatar={tp.avatar} />
                  <div>
                    <div className="text-[11px] font-bold truncate">
                      {tp.name}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {tp.money.toLocaleString("ru-RU")} К
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-1.5 space-y-0.5">
                {[
                  {
                    icon: "🤝",
  label: "Договор",
  action: () => openTrade(tp.id),
  hidden: tp.id === (currentUser?.id || "you"), // скрываем на себе
  disabled:
    players[turn]?.id !== (currentUser?.id || "you") || // блокируем, если ход не твой
    rolled ||
    inJail ||
    !!auction ||
    !!pendingAction,
                  },
                  {
                    icon: "🗳",
                    label: "Выгнать",
                    hidden: tp.id === (currentUser?.id || "you"),
                    action: () => {
                      setPlayerHover(null);
                      if (!initialRoomId) return;
                      socket.emit('vote-start', {
                        roomId: initialRoomId,
                        targetId: tp.id,
                        reason: 'инициатива игрока',
                        duration: settings.voteDuration,
                      });
                    },
                  },
                  {
                    icon: "🚩",
                    label: "Репорт",
                    hidden: tp.id === (currentUser?.id || "you"),
                    action: () => {
                      setPlayerHover(null);
                      addLog(
                        `🚩 Жалоба на ${tp.name} отправлена администратору.`,
                      );
                    },
                  },
                  {
                    icon: "🏳️",
                    label: "Сдаться",
                    // Кнопка доступна только в попапе на себя — игрок может
                    // сдаться только сам, не за соперника.
                    hidden: tp.id !== (currentUser?.id || "you"),
                    action: () => {
                      setPlayerHover(null);
                      const myIdx = players.findIndex(
                        (pl) => pl.id === (currentUser?.id || "you"),
                      );
                      if (myIdx !== -1) {
                        bankruptPlayer(myIdx, "добровольная сдача");
                      }
                    },
                  },
].filter(item => !item.hidden).map(({ icon, label, action, disabled }) => (
                  <button
                    key={label}
                    onClick={disabled ? undefined : action}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors text-left ${disabled ? "opacity-35 cursor-not-allowed" : "hover:bg-muted"}`}
                  >
                    <span>{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      {/* Trade moved inline to chat center panel */}
      {/* Hover property popup */}
      {/* Selected property popup */}
            {selectedCell !== null &&
  selectedPos &&
  getCell(selectedCell).type === "property" &&
  (() => {
    const baseCell = getCell(selectedCell);
    const customSkinId = globalCustomSkins[selectedCell];
    const customSkinItem = customSkinId ? marketItems.find(m => m.id === customSkinId) : null;
        const cell = customSkinItem
      ? { ...baseCell, name: customSkinItem.name }
      : baseCell;
    const group = getCellGroup(selectedCell);
          const ownedByP = owners[selectedCell]
            ? players.find((p) => p.id === owners[selectedCell])
            : null;
          const improvCost = getImproveCost(selectedCell);
          const mortgage = getMortgage(selectedCell);
          const isMortgaged =
            mortgages[selectedCell] !== undefined &&
            mortgages[selectedCell] > globalTurnCounter;
          const left = Math.min(selectedPos.x + 14, window.innerWidth - 212);
          const top = Math.min(selectedPos.y - 20, window.innerHeight - 360);
          return (
            <div
              className="fixed z-50 w-52 rounded-xl border border-card-border bg-card shadow-2xl overflow-hidden"
              style={{ left, top }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="px-3 py-2.5"
                style={{
                  backgroundColor: ownedByP
                    ? ownedByP.color
                    : (group?.color ?? "#555"),
                }}
              >
                <div className="text-[9px] font-bold uppercase tracking-wider text-white/75">
                  {group?.name ?? "Поле"}
                </div>
                <div className="font-bold text-sm text-white leading-tight">
                  {cell.name}
                </div>
                {ownedByP && (
                  <div className="mt-0.5 text-[10px] text-white/80">
                    Владелец: {ownedByP.name}
                  </div>
                )}
              </div>
              <div className="px-3 py-2">
                {[0, 1, 2, 3, 4, 5].map((lvl) => {
                  const r = getRent(selectedCell, {
                    ...improvements,
                    [selectedCell]: lvl,
                  });
                  const isCurrent = lvl === (improvements[selectedCell] ?? 0);
                  return (
                    <div
                      key={lvl}
                      className={`flex justify-between py-0.5 text-[11px] ${isCurrent ? "font-bold text-foreground" : "text-muted-foreground"}`}
                    >
                      <span>
                        {lvl === 0
                          ? "Базовая рента"
                          : lvl === 5
                            ? "🏨 Отель"
                            : `Филиал ${"★".repeat(lvl)}`}
                      </span>
                      <span>{r.toLocaleString("ru-RU")} К</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border px-3 py-2 space-y-2">
                {isMortgaged && (
                  <div className="flex justify-between text-[11px] text-primary border-b border-border pb-1 mb-1">
                    <span className="text-muted-foreground">
                      Стоимость выкупа
                    </span>
                    <span className="font-bold">
                      {getRedeemCost(selectedCell)} К
                    </span>
                  </div>
                )}
                {[
                  ["Стоимость поля", cell.price],
                  ["Залог", mortgage],
                  ["Филиал", improvCost],
                ].map(([label, val]) => (
                  <div
                    key={String(label)}
                    className="flex justify-between text-[11px]"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-bold">
                      {Number(val).toLocaleString("ru-RU")} К
                    </span>
                  </div>
                ))}
              </div>
              {/* Кнопки управления */}
              {ownedByP && ownedByP.id === player.id && (currentUser?.id || "you") === player.id && (
  <div className="border-t border-border px-3 py-2 space-y-2">
                  <div className="flex gap-1">
                    {!isMortgaged && (
                      <button
                        onClick={mortgageProperty}
                        disabled={
                          isMortgaged || (improvements[selectedCell] ?? 0) > 0
                        }
                        className="flex-1 rounded-lg bg-[#e96852] py-[4px] font-bold text-white disabled:opacity-40 hover:bg-[#d45a43] transition-colors"
                        style={{ fontSize: "11px", lineHeight: "11px" }}
                      >
                        Заложить
                      </button>
                    )}
                    {isMortgaged && (
                      <button
                        onClick={redeemProperty}
                        disabled={player.money < getRedeemCost(selectedCell)}
                        className="flex-1 rounded-lg bg-[#32786d] py-[4px] font-bold text-white disabled:opacity-40 hover:bg-[#266059] transition-colors"
                        style={{ fontSize: "11px", lineHeight: "11px" }}
                      >
                        Выкупить
                      </button>
                    )}

                    <button
                      onClick={() => improveProperty(selectedCell)}
                      disabled={
                        player.id !== players[turn]?.id ||
                        !monopolyGroups.some(
                          (g) => g.gIdx === getGroupIdx(selectedCell),
                        ) ||
                        improvedGroupsThisTurn.includes(
                          getGroupIdx(selectedCell),
                        ) ||
                        (improvements[selectedCell] ?? 0) >= 5 ||
                        isMortgaged
                      }
                      className="flex-1 rounded-lg bg-[#32786d] py-[4px] font-bold text-white disabled:opacity-40 hover:bg-[#266059] transition-colors"
                      style={{ fontSize: "11px", lineHeight: "11px" }}
                    >
                      Улучшить
                    </button>
                    <button
                      onClick={() => sellProperty(selectedCell)}
                      disabled={
                        player.id !== players[turn]?.id ||
                        (improvements[selectedCell] ?? 0) === 0
                      }
                      className="flex-1 rounded-lg bg-[#e96852] py-[4px] font-bold text-white disabled:opacity-40 hover:bg-[#d45a43] transition-colors"
                      style={{ fontSize: "11px", lineHeight: "11px" }}
                    >
                      Продать
                    </button>
                  </div>
                  {improvedGroupsThisTurn.includes(
                    getGroupIdx(selectedCell),
                  ) && (
                    <div
                      className="text-muted-foreground"
                      style={{ fontSize: "5px", lineHeight: "5px" }}
                    >
                      Уже улучшали в этом ходу
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      {/* Vote modal */}
      {vote && (() => {
        const myId = currentUser?.id || "you";
        const myVote = vote.votes[myId];
        const secondsLeft = Math.max(0, Math.ceil((vote.endsAt - Date.now()) / 1000));
        const voters = players.filter(p => !p.bankrupt && p.id !== vote.target.id);
        const votedCount = Object.keys(vote.votes).length;
        const targetIsMe = vote.target.id === myId;
        return (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#29233e]/60 p-5">
            <div className="w-full max-w-lg rounded-2xl border border-card-border bg-card p-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">
                    голосование · {secondsLeft} сек
                  </div>
                  <h2 className="mt-2 font-display text-2xl font-bold">
                    Исключить {vote.target.name}?
                  </h2>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Причина: {vote.reason}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Проголосовали: {votedCount} / {voters.length}
                  </div>
                </div>
                <div className="rounded-xl bg-[#f6dfd7] p-3 text-primary">
                  <Timer size={22} />
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {voters.map((p) => {
                  const v = vote.votes[p.id];
                  const isMe = p.id === myId;
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl bg-muted p-3">
                      <Avatar initials={p.initials} color={p.color} size="sm" />
                      <div className="flex-1 text-sm font-bold">
                        {p.name}
                        {isMe && <span className="ml-2 text-[10px] text-muted-foreground">(вы)</span>}
                      </div>
                      {v === "yes" && <span className="text-xs font-bold text-primary">Исключить</span>}
                      {v === "no" && <span className="text-xs font-bold text-accent">Оставить</span>}
                      {!v && <span className="text-[11px] italic text-muted-foreground">ещё голосует…</span>}
                    </div>
                  );
                })}
              </div>

              {targetIsMe ? (
                <div className="mt-5 rounded-xl bg-[#f6dfd7] px-4 py-3 text-center text-xs font-bold text-primary">
                  Голосование за вас. Ожидайте решения стола.
                </div>
              ) : myVote ? (
                <div className="mt-5 rounded-xl bg-[#dceae3] px-4 py-3 text-center text-xs font-bold text-accent">
                  Ваш голос: {myVote === "yes" ? "Исключить" : "Оставить"}
                </div>
              ) : (
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => sendVote("yes")}
                    className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:brightness-95"
                  >
                    Исключить
                  </button>
                  <button
                    onClick={() => sendVote("no")}
                    className="flex-1 rounded-xl bg-[#dceae3] py-3 text-sm font-bold text-accent hover:brightness-95"
                  >
                    Оставить
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
      {/* Reward modal */}
      {reward && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#29233e]/60 p-5">
          <div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-7 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3e7c8] text-[#99711f]">
              <Gift size={27} />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold">
              Награды партии
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {reward}
            </p>
            <button
              onClick={onExit}
              className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              Вернуться в клуб
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Admin({ onLogout }: { onLogout: () => void }) {
  const [settings, setSettings] = useServerSync<AdminSettings>(
  "arena-admin-settings",
  defaultSettings,
  ['admin-settings', 'admin-settings-updated'],
  'get-admin-settings'
);
  const [saved, setSaved] = useState(false);
  const [adminTab, setAdminTab] = useState<"settings" | "items">("settings");
  const [itemsTab, setItemsTab] = useState<"cards" | "dice" | "cases" | "custom">("cards");
  const [creatingMarketItem, setCreatingMarketItem] = useState(false);
const [editingMarketItem, setEditingMarketItem] = useState<MarketItem | null>(null);
  const [cardDesigns, setCardDesigns] = useServerSync<CardDesign[]>(
  "arena-card-designs",
  [],
  ['card-designs', 'card-designs-updated'],
  'get-card-designs'
);
useEffect(() => { globalCardDesigns = cardDesigns; }, [cardDesigns]);
  const [editingCard, setEditingCard] = useState<CardDesign | null>(null);
  const [editDraft, setEditDraft] = useState<CardDesign | null>(null);
  const [diceDesigns, setDiceDesigns] = useLocalStorage<DiceDesign[]>(
    "arena-dice-designs",
    [],
  );
  const [diceName, setDiceName] = useState("");
  const [diceColor, setDiceColor] = useState("#e96852");
  const [diceImageDataUrl, setDiceImageDataUrl] = useState<string | undefined>(
    undefined,
  );
  const [cases, setCases] = useServerSync<CaseDesign[]>("arena-admin-cases", [], ['admin-cases-updated'], 'get-admin-cases');
  const [caseName, setCaseName] = useState("");
const [caseSelectedItems, setCaseSelectedItems] = useState<string[]>([]);
const [caseDesc, setCaseDesc] = useState("");
const [casePrice, setCasePrice] = useState("100");
const [caseColor, setCaseColor] = useState("#e96852");
const [caseIcon, setCaseIcon] = useState("Package");
const [caseImageDataUrl, setCaseImageDataUrl] = useState<string | undefined>(undefined);
const [caseCardWidth, setCaseCardWidth] = useState(String(CARD_SIZE_DEFAULTS.cardWidth));
const [caseCardHeight, setCaseCardHeight] = useState(String(CARD_SIZE_DEFAULTS.cardHeight));
const [caseImageHeight, setCaseImageHeight] = useState(String(CARD_SIZE_DEFAULTS.imageHeight));
const [caseShopScale, setCaseShopScale] = useState(String(CARD_SIZE_DEFAULTS.shopScale));
const [editingCaseId, setEditingCaseId] = useState<string | null>(null);

const ICON_OPTIONS: Record<string, any> = {
  "Кейс": Package,
  "Подарок": Gift,
  "Корона": Crown,
  "Монеты": Coins,
};
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
const [customSlot, setCustomSlot] = useState("");
const [customPrice, setCustomPrice] = useState("");
  const [marketItems, setMarketItems] = useServerSync<MarketItem[]>("arena-market-items", [], ['custom-items-updated'], 'get-custom-items');

  const DROPPABLE_ITEMS = [
    "Кубики",
    "Фишки",
    "Карточки поля",
    "Жетон удачи",
    "Скидка на аренду",
    "Бесплатный ход",
    "Бонусные Монополки",
  ];

  const update = (key: keyof AdminSettings, value: string) =>
    setSettings({
      ...settings,
      [key]: key === "adminPassword" ? value : Number(value),
    });
  const resetCaseForm = () => {
    setCaseName("");
    setCaseSelectedItems([]);
    setCaseDesc("");
    setCasePrice("100");
    setCaseColor("#e96852");
    setCaseIcon("Package");
    setCaseImageDataUrl(undefined);
    setCaseCardWidth(String(CARD_SIZE_DEFAULTS.cardWidth));
    setCaseCardHeight(String(CARD_SIZE_DEFAULTS.cardHeight));
    setCaseImageHeight(String(CARD_SIZE_DEFAULTS.imageHeight));
    setCaseShopScale(String(CARD_SIZE_DEFAULTS.shopScale));
    setEditingCaseId(null);
  };

  const openEditCase = (c: CaseDesign) => {
    setEditingCaseId(c.id);
    setCaseName(c.name);
    setCaseSelectedItems(c.items || []);
    setCaseDesc(c.desc || "");
    setCasePrice(String(c.price ?? 100));
    setCaseColor(c.color || "#e96852");
    // Найти ключ иконки по функции
    const iconKey = Object.keys(ICON_OPTIONS).find(k => ICON_OPTIONS[k] === c.icon) || "Кейс";
    setCaseIcon(iconKey);
    setCaseImageDataUrl(c.imageDataUrl);
    setCaseCardWidth(String(c.cardWidth ?? CARD_SIZE_DEFAULTS.cardWidth));
    setCaseCardHeight(String(c.cardHeight ?? CARD_SIZE_DEFAULTS.cardHeight));
    setCaseImageHeight(String(c.imageHeight ?? CARD_SIZE_DEFAULTS.imageHeight));
    setCaseShopScale(String(c.shopScale ?? CARD_SIZE_DEFAULTS.shopScale));
  };

  const createCase = (e: FormEvent) => {
  e.preventDefault();
  if (!caseName.trim()) return;

  const caseData: CaseDesign = {
    id: editingCaseId || Date.now().toString(),
    name: caseName.trim(),
    items: caseSelectedItems,
    desc: caseDesc,
    price: Number(casePrice) || 100,
    color: caseColor,
    icon: ICON_OPTIONS[caseIcon] || Package,
    imageDataUrl: caseImageDataUrl,
    isActive: true,
    cardWidth: Number(caseCardWidth) || CARD_SIZE_DEFAULTS.cardWidth,
    cardHeight: Number(caseCardHeight) || CARD_SIZE_DEFAULTS.cardHeight,
    imageHeight: Number(caseImageHeight) || CARD_SIZE_DEFAULTS.imageHeight,
    shopScale: Number(caseShopScale) || CARD_SIZE_DEFAULTS.shopScale,
  };

  const updatedCases = editingCaseId
    ? cases.map(c => c.id === editingCaseId ? caseData : c)
    : [...cases, caseData];

  setCases(updatedCases);
  socket.emit('admin-save-cases', updatedCases);
  resetCaseForm();
};
  const createDice = (e: FormEvent) => {
    e.preventDefault();
    if (!diceName.trim()) return;
    setDiceDesigns([
      ...diceDesigns,
      {
        id: Date.now().toString(),
        name: diceName.trim(),
        color: diceColor,
        imageDataUrl: diceImageDataUrl,
      },
    ]);
    setDiceName("");
    setDiceColor("#e96852");
    setDiceImageDataUrl(undefined);
  };

  const MAX_DESIGNS = 200;
  const CELL_TYPES_LIST: CellType[] = [
    "property",
    "start",
    "chance",
    "tax",
    "challenge",
    "jail",
    "gotojail",
    "jackpot",
  ];
  const CELL_TYPE_LABELS: Record<CellType, string> = {
    property: "Собственность",
    start: "Старт",
    chance: "Шанс",
    tax: "Налог",
    challenge: "Испытание",
    jail: "Тюрьма",
    gotojail: "В тюрьму",
    jackpot: "Джекпот",
  };

  const getCellDimensions = (slotIndex: number) => {
    const BOARD_REF = 600;
    const TOTAL_FR = 12.8;
    const C = Math.round((1.9 / TOTAL_FR) * BOARD_REF); // ~89
    const R = Math.round((1 / TOTAL_FR) * BOARD_REF); // ~47
    const isCorner = [0, 10, 20, 30].includes(slotIndex);
    const isTopBottom =
      (slotIndex >= 1 && slotIndex <= 9) ||
      (slotIndex >= 21 && slotIndex <= 29);
    const isLeftRight =
      (slotIndex >= 11 && slotIndex <= 19) ||
      (slotIndex >= 31 && slotIndex <= 39);
    let wPx = C,
      hPx = C;
    if (isTopBottom) {
      wPx = R;
      hPx = C;
    }
    if (isLeftRight) {
      wPx = C;
      hPx = R;
    }
    const PX_PER_MM = 3.7795; // at 96dpi
    const wMm = Math.round((wPx / PX_PER_MM) * 10) / 10;
    const hMm = Math.round((hPx / PX_PER_MM) * 10) / 10;
    return { wPx, hPx, wMm, hMm, isCorner, isTopBottom, isLeftRight };
  };

  const openEdit = (slotIndex: number) => {
    const existing = cardDesigns.find((d) => d.slotIndex === slotIndex);
    const cell = boardCells[slotIndex];
    const draft: CardDesign = existing ?? {
      id: `card-${slotIndex}-${Date.now()}`,
      slotIndex,
      name: cell?.name ?? `Поле ${slotIndex}`,
      type: cell?.type ?? "property",
      price: cell?.price,
      groupColor: getCellGroup(slotIndex)?.color,
      imageDataUrl: undefined,
      scale: 1,
    };
    setEditingCard({ ...draft });
    setEditDraft({ ...draft });
  };

  const saveCard = () => {
  if (!editDraft) return;
  const existing = cardDesigns.findIndex((d) => d.slotIndex === editDraft.slotIndex);
  let updatedDesigns: CardDesign[];
  if (existing >= 0) {
    updatedDesigns = cardDesigns.map((d, i) => (i === existing ? editDraft : d));
  } else {
    if (cardDesigns.length >= MAX_DESIGNS) return;
    updatedDesigns = [...cardDesigns, { ...editDraft, id: `card-${editDraft.slotIndex}-${Date.now()}` }];
  }
  setCardDesigns(updatedDesigns);
  socket.emit('admin-update-card-designs', updatedDesigns);
  setEditingCard(null);
  setEditDraft(null);
};

  const deleteCard = (slotIndex: number) => {
  const updated = cardDesigns.filter((d) => d.slotIndex !== slotIndex);
  setCardDesigns(updated);
  socket.emit('admin-update-card-designs', updated);
  setEditingCard(null);
  setEditDraft(null);
};

  // Удаление белого фона: все почти-белые пиксели становятся прозрачными
  const removeWhiteBackground = (
    base64: string,
    threshold = 240,
    onDone: (result: string) => void,
  ) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        if (r > threshold && g > threshold && b > threshold) {
          px[i + 3] = 0; // alpha
        }
      }
      ctx.putImageData(data, 0, 0);
      onDone(canvas.toDataURL("image/png"));
    };
    img.src = base64;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editDraft) return;
    compressImageFile(file, 200, 200, 80000)
      .then((compressed) => {
        setEditDraft((d) => (d ? { ...d, imageDataUrl: compressed } : d));
      })
      .catch((err) => {
        console.error("Ошибка сжатия картинки", err);
      });
  };

  const cellBgColor = (type: CellType) => {
    const map: Record<CellType, string> = {
      start: "#ffffff",
      gotojail: "#ffffff",
      jail: "#ffffff",
      jackpot: "#ffffff",
      tax: "#ffffff",
      chance: "#ffffff",
      challenge: "#ffffff",
      property: "#fdfaf5",
    };
    return map[type] ?? "#fdfaf5";
  };

  const allSlots = Array.from({ length: 40 }, (_, i) => i);

  return (
    <div className="animate-rise">
      <SectionHeading
        eyebrow="контрольная комната"
        title="Админ-панель"
        detail="Настройки клуба, карточки поля, Модерация."
        action={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-full bg-[#dceae3] px-3 py-2 text-xs font-bold text-accent">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Система стабильна
            </span>
            <button
              onClick={onLogout}
              className="rounded-lg border border-input bg-card p-2 text-muted-foreground"
            >
              <LogOut size={15} />
            </button>
          </div>
        }
      />

      <div className="mb-6 flex gap-2 rounded-xl bg-muted p-1 w-fit">
        <button
          onClick={() => setAdminTab("settings")}
          className={`rounded-lg px-5 py-2 text-sm font-bold transition-colors ${adminTab === "settings" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          ⚙️ Настройки
        </button>
        <button
          onClick={() => setAdminTab("items")}
          className={`rounded-lg px-5 py-2 text-sm font-bold transition-colors ${adminTab === "items" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          🎁 Предметы
        </button>
      </div>

      {adminTab === "settings" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatTile
              icon={Users}
              label="Активных игроков"
              value="1 842"
              hint="+ 8.4% за неделю"
              tone="teal"
            />
            <StatTile
              icon={Activity}
              label="Партий сегодня"
              value="326"
              hint="Пик в 21:00"
              tone="gold"
            />
            <StatTile
              icon={WalletCards}
              label="Монополок в банке"
              value="8.4M"
              hint="Баланс в норме"
              tone="plum"
            />
            <StatTile
              icon={ShieldCheck}
              label="Жалоб на проверке"
              value="12"
              hint="2 требуют решения"
              tone="coral"
            />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
            <div className="space-y-6 rounded-2xl border border-card-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">
                  Баланс партии
                </h2>
                <Settings2 size={18} className="text-muted-foreground" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["startCapital", "Стартовый капитал"],
                    ["passStart", "Проход Старта"],
                    ["rentPercent", "Аренда, %"],
                    ["thirdDieChance", "Шанс 3-го кубика, %"],
                    ["voteDuration", "Время голосования, сек"],
                    ["voteYesPercent", "Процент «Да» для сохранения, %"],
                    ["taxAmount1", "Налог 1 (сумма списания)"],
                    ["taxAmount2", "Налог 2 (сумма списания)"],
                    ["startBonus", "Бонус за попадание на Старт"],
                  ] as [keyof AdminSettings, string][]
                ).map(([key, label]) => (
                  <label key={key} className="text-xs font-bold">
                    {label}
                    <input
                      type="number"
                      value={settings[key]}
                      onChange={(e) => update(key, e.target.value)}
                      className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
                    />
                  </label>
                ))}
                <div className="col-span-2 mt-1">
                  <div className="mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Джекпот — ставки и выигрыши
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {([1, 2, 3] as const).map((n) => (
                      <div
                        key={n}
                        className="rounded-xl border border-input bg-muted/40 p-3 space-y-2"
                      >
                        <div className="text-[10px] font-bold text-muted-foreground">
                          {"🎲".repeat(n)} {n} кубик
                          {n === 1 ? "" : n === 2 ? "а" : "ов"}
                        </div>
                        <label className="block text-xs font-bold">
                          Ставка
                          <input
                            type="number"
                            value={
                              settings[`jackpotBet${n}` as keyof AdminSettings]
                            }
                            onChange={(e) =>
                              update(
                                `jackpotBet${n}` as keyof AdminSettings,
                                e.target.value,
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                          />
                        </label>
                        <label className="block text-xs font-bold">
                          Выигрыш
                          <input
                            type="number"
                            value={
                              settings[`jackpotWin${n}` as keyof AdminSettings]
                            }
                            onChange={(e) =>
                              update(
                                `jackpotWin${n}` as keyof AdminSettings,
                                e.target.value,
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <label className="block text-xs font-bold">
                Пароль администратора
                <input
                  type="password"
                  value={settings.adminPassword}
                  onChange={(e) => update("adminPassword", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
                />
              </label>
              <button
  onClick={() => {
    socket.emit('admin-update-settings', settings);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }}
  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
>
  {saved ? "Изменения сохранены ✓" : "Сохранить настройки"}
</button>
            </div>
            <div className="space-y-6">
              <div className="rounded-2xl border border-card-border bg-card p-5">
                <h2 className="font-display text-xl font-bold">
                  Модерация игроков
                </h2>
                {[
                  "Роман К. · спам в чате",
                  "Тимур 88 · подозрительная сделка",
                  "Лиза К. · никнейм",
                ].map((item) => (
                  <div
                    key={item}
                    className="mt-3 flex items-center gap-3 rounded-xl bg-muted p-3"
                  >
                    <div className="flex-1 text-xs font-bold">{item}</div>
                    <button className="rounded-lg bg-[#f6dfd7] px-3 py-2 text-[11px] font-bold text-primary">
                      Заблокировать
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {adminTab === "items" && (
        <div>
          <div className="mb-6 flex gap-2 rounded-xl bg-muted p-1 w-fit">
            <button
              onClick={() => setItemsTab("cards")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${itemsTab === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              🃏 Карточки{" "}
              <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                {cardDesigns.length}/{MAX_DESIGNS}
              </span>
            </button>
            <button
              onClick={() => setItemsTab("dice")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${itemsTab === "dice" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              🎲 Кубики{" "}
              <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                {diceDesigns.length}
              </span>
            </button>
            <button
              onClick={() => setItemsTab("cases")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${itemsTab === "cases" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              📦 Кейсы{" "}
              <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                {cases.length}
              </span>
            </button>
            <button onClick={() => setItemsTab("custom")} 
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${itemsTab === "custom" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
           🃏 Товары
            </button>
          </div>

          {itemsTab === "cards" && (
            <div>
              <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                <p className="text-sm text-muted-foreground flex-1">
                  Нажми на карандаш ✏️ чтобы редактировать карточку. Загрузи
                  изображение, смени название или тип. Всего можно создать до{" "}
                  {MAX_DESIGNS} дизайнов.
                </p>

                {/* Кнопка сжатия и индикатор */}
                <div className="flex flex-col items-end gap-2">
                  {compressProgress && (
                    <div className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-lg">
                      {compressProgress}
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      if (isCompressing) return;
                      setIsCompressing(true);
                      setCompressProgress("⏳ Миграция картинок...");
                      try {
                        let compressedItems = 0;
                        let compressedCases = 0;

                        // Товары / карточки для рынка
                        const newItems = await Promise.all(
                          marketItems.map(async (item) => {
                            if (!item.imageDataUrl || item.imageDataUrl.length < 50000) return item;
                            try {
                              const maxDim = item.category === "dice" ? 128 : 300;
                              const compressed = await compressBase64Url(
                                item.imageDataUrl, maxDim, maxDim, 100000,
                              );
                              compressedItems++;
                              return { ...item, imageDataUrl: compressed };
                            } catch (err) {
                              console.error("Ошибка сжатия товара", item.id, err);
                              return item;
                            }
                          })
                        );
                        if (compressedItems > 0) {
                          setMarketItems(newItems);
                          socket.emit('save-custom-items', newItems);
                        }

                        // Кейсы
                        const newCases = await Promise.all(
                          cases.map(async (c) => {
                            if (!c.imageDataUrl || c.imageDataUrl.length < 50000) return c;
                            try {
                              const compressed = await compressBase64Url(
                                c.imageDataUrl, 400, 400, 120000,
                              );
                              compressedCases++;
                              return { ...c, imageDataUrl: compressed };
                            } catch (err) {
                              console.error("Ошибка сжатия кейса", c.id, err);
                              return c;
                            }
                          })
                        );
                        if (compressedCases > 0) {
                          setCases(newCases);
                          socket.emit('admin-save-cases', newCases);
                        }

                        setCompressProgress(
                          `✅ Готово! Сжато товаров: ${compressedItems}, кейсов: ${compressedCases}.`,
                        );
                        setTimeout(() => setCompressProgress(null), 5000);
                      } catch (err) {
                        setCompressProgress(`❌ Ошибка: ${err}`);
                      } finally {
                        setIsCompressing(false);
                      }
                    }}
                    disabled={isCompressing}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                      isCompressing
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-[#32786d] text-white hover:bg-[#266059]"
                    }`}
                  >
                    {isCompressing
                      ? "⏳ Сжимаем..."
                      : "🗜 Пережать картинки товаров и кейсов"}
                  </button>
                  <button
                    onClick={async () => {
                      if (isCompressing) return;
                      setIsCompressing(true);
                      setCompressProgress("⏳ Загрузка данных...");

                      try {
                        const designs = cardDesigns;
if (!designs || designs.length === 0) {
  setCompressProgress("Нет данных для сжатия.");
  setIsCompressing(false);
  return;
}
                        let compressedCount = 0;

                        // Сжатие base64-картинки. PNG пока не превышает 80 KB,
                        // иначе JPEG 0.85 — так все крупные картинки ужмутся.
                        const compressBase64Image = (
                          base64: string,
                          maxWidth: number,
                          maxHeight: number,
                        ): Promise<string> => {
                          return new Promise((resolve, reject) => {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement("canvas");
                              let width = img.width;
                              let height = img.height;
                              if (width > maxWidth) {
                                height = (height * maxWidth) / width;
                                width = maxWidth;
                              }
                              if (height > maxHeight) {
                                width = (width * maxHeight) / height;
                                height = maxHeight;
                              }
                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext("2d");
                              ctx?.drawImage(img, 0, 0, width, height);
                              const hasAlpha = canvasHasTransparency(ctx!, width, height);
                              let dataUrl = canvas.toDataURL("image/png");
                              if (!hasAlpha && dataUrl.length > 80000) {
                                dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                              }
                              resolve(dataUrl);
                            };
                            img.onerror = reject;
                            img.src = base64;
                          });
                        };

                        setCompressProgress("🔄 Сжимаю изображения...");

                        const updatedDesigns = await Promise.all(
                          designs.map(async (d) => {
                            // Проверяем, есть ли большая картинка (больше 50кб)
                            if (
                              d.imageDataUrl &&
                              d.imageDataUrl.length > 50000
                            ) {
                              try {
                                const compressed = await compressBase64Image(
                                  d.imageDataUrl,
                                  200,
                                  200,
                                );
                                compressedCount++;
                                return { ...d, imageDataUrl: compressed };
                              } catch (err) {
                                console.error(
                                  "Ошибка сжатия карточки",
                                  d.slotIndex,
                                  err,
                                );
                                return d;
                              }
                            }
                            return d;
                          }),
                        );

                        // Сохраняем обратно в localStorage и обновляем стейт
                        localStorage.setItem(
  "arena-card-designs",
  JSON.stringify(updatedDesigns),
);
setCardDesigns(updatedDesigns);
socket.emit('admin-update-card-designs', updatedDesigns);

                        setCompressProgress(
                          `✅ Готово! Сжато ${compressedCount} изображений.`,
                        );
                        setTimeout(() => setCompressProgress(null), 4000);
                      } catch (err) {
                        setCompressProgress(`❌ Ошибка: ${err}`);
                      } finally {
                        setIsCompressing(false);
                      }
                    }}
                    disabled={isCompressing}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                      isCompressing
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-[#29233e] text-white hover:bg-[#3b3354]"
                    }`}
                  >
                    {isCompressing
                      ? "⏳ Сжимаем..."
                      : "🔄 Сжать все изображения"}
                  </button>
                </div>
              </div>

              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                }}
              >
                {allSlots.map((slotIndex) => {
                  const cell = boardCells[slotIndex];
                  const design = cardDesigns.find(
                    (d) => d.slotIndex === slotIndex,
                  );
                  const group = getCellGroup(slotIndex);
                  const logo = CELL_LOGOS[slotIndex];
                  const bg = cellBgColor(cell?.type ?? "property");
                  const groupColor = design?.groupColor ?? group?.color;
                  const dim = getCellDimensions(slotIndex);
                  const cellName =
                    design?.name ?? cell?.name ?? `Поле ${slotIndex}`;
                  const cellType = design?.type ?? cell?.type ?? "property";
                  return (
                    <div
                      key={slotIndex}
                      className="relative overflow-hidden rounded-xl border border-card-border bg-card shadow-sm group"
                    >
                      <button
                        onClick={() => openEdit(slotIndex)}
                        className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-lg bg-white/90 text-[#29233e] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-[#e96852] hover:text-white"
                        title="Редактировать"
                      >
                        <Pencil size={12} />
                      </button>
                      <div
                        className="relative flex h-28 flex-col overflow-hidden"
                        style={{ backgroundColor: bg }}
                      >
                        {groupColor && (
                          <div
                            className="h-[18%] w-full shrink-0 flex items-center justify-end pr-1.5"
                            style={{ backgroundColor: groupColor }}
                          >
                            {cell?.price != null && (
                              <span
                                style={{
                                  fontSize: 24,
                                  fontWeight: 800,
                                  color: "#fff",
                                  lineHeight: 1,
                                }}
                              >
                                {(cell.price / 1000).toFixed(0)}k
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex flex-1 items-center justify-center p-1">
                          {design?.imageDataUrl ? (
                            <img
                              src={design.imageDataUrl}
                              alt={cellName}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div style={{ fontSize: 28, lineHeight: 1 }}>
                              {logo ?? SPECIAL_ICONS[cellType] ?? "❓"}
                            </div>
                          )}
                        </div>
                        {design && (
                          <div className="absolute top-0 left-0 h-1.5 w-1.5 rounded-br-lg bg-primary" />
                        )}
                      </div>
                      <div className="p-2">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[9px] text-muted-foreground">
                            #{slotIndex}
                          </span>
                          {design && (
                            <span className="text-[8px] text-primary font-bold">
                              ✦
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[11px] font-bold leading-tight">
                          {cellName}
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {CELL_TYPE_LABELS[cellType]}
                        </div>
                        <div className="mt-0.5 text-[8px] text-muted-foreground/60">
                          {dim.wPx}×{dim.hPx} px · {dim.wMm}×{dim.hMm} Км
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {itemsTab === "dice" && (
            <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
              <div className="rounded-2xl border border-card-border bg-card p-5 space-y-4">
                <h2 className="font-display text-xl font-bold">
                  Новый дизайн кубика
                </h2>
                <form onSubmit={createDice} className="grid gap-3">
                  <label className="text-xs font-bold">
                    Название
                    <input
                      value={diceName}
                      onChange={(e) => setDiceName(e.target.value)}
                      placeholder="Например: Огненный кубик"
                      className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Цвет грани
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="color"
                        value={diceColor}
                        onChange={(e) => setDiceColor(e.target.value)}
                        className="h-9 w-14 cursor-pointer rounded-lg border border-input bg-background p-1"
                      />
                      <span className="text-sm font-normal text-muted-foreground">
                        {diceColor}
                      </span>
                    </div>
                  </label>
                  <label className="text-xs font-bold">
                    Изображение (необязательно)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      compressImageFile(f, 128, 128, 40000)
                        .then((compressed) => setDiceImageDataUrl(compressed))
                        .catch((err) => console.error("Ошибка сжатия кубика:", err));
                    }}
                    className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
                  />
                  </label>
                  {diceImageDataUrl && (
                    <img
                      src={diceImageDataUrl}
                      alt="preview"
                      className="h-20 w-20 rounded-xl object-contain border border-card-border"
                    />
                  )}
                  <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
                    Создать дизайн
                  </button>
                </form>
              </div>
              <div>
                <h2 className="mb-4 font-display text-xl font-bold">
                  Дизайны кубиков{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({diceDesigns.length})
                  </span>
                </h2>
                {diceDesigns.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Пока нет ни одного дизайна. Создай первый!
                  </p>
                )}
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(130px, 1fr))",
                  }}
                >
                  {diceDesigns.map((d) => (
                    <div
                      key={d.id}
                      className="relative overflow-hidden rounded-xl border border-card-border bg-card shadow-sm"
                    >
                      <div
                        className="flex h-20 items-center justify-center"
                        style={{ backgroundColor: d.color + "33" }}
                      >
                        {d.imageDataUrl ? (
                          <img
                            src={d.imageDataUrl}
                            alt={d.name}
                            className="h-14 w-14 object-contain"
                          />
                        ) : (
                          <div className="text-4xl" style={{ color: d.color }}>
                            🎲
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="truncate text-[11px] font-bold">
                          {d.name}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: d.color }}
                          />
                          <span className="text-[9px] text-muted-foreground">
                            {d.color}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setDiceDesigns(
                            diceDesigns.filter((x) => x.id !== d.id),
                          )
                        }
                        className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-lg bg-white/90 text-muted-foreground hover:bg-primary hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {itemsTab === "custom" && (
  <div className="grid gap-4">
    <div className="rounded-2xl border border-card-border bg-card p-5">
      <h2 className="font-display text-xl font-bold">Карточки для рынка</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Создай карточку поля, которую можно будет добавить в кейс. Она заменит базовую клетку на игровом столе.
      </p>
      <button
        onClick={() => setCreatingMarketItem(true)}
        className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
      >
        + Создать Товар
      </button>
    </div>

    {/* Список созданных товаров */}
    <div className="rounded-2xl border border-card-border bg-card p-5">
      <h2 className="font-display text-xl font-bold">Управление товарами</h2>
      <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {marketItems.length === 0 && (
          <div className="text-sm text-muted-foreground">Товаров пока нет</div>
        )}
                {marketItems.map((item) => {
          const isCard = item.category === "card";
          const slotNum = isCard ? Number(item.slotIndex || 0) : 0;
          const groupColor = isCard ? getCellGroup(slotNum)?.color : null;
          const logo = isCard ? CELL_LOGOS[slotNum] : null;
          let stripDir = null;
          if (isCard) {
            if (slotNum >= 1 && slotNum <= 9) stripDir = "top";
            else if (slotNum >= 11 && slotNum <= 19) stripDir = "right";
            else if (slotNum >= 21 && slotNum <= 29) stripDir = "bottom";
            else if (slotNum >= 31 && slotNum <= 39) stripDir = "left";
          }

          return (
            <div key={item.id} className="relative overflow-hidden rounded-xl border border-card-border bg-card shadow-sm group">
              {/* Кнопка редактирования */}
              <button
                onClick={() => setEditingMarketItem(item)}
                className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-lg bg-white/90 text-[#29233e] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-[#e96852] hover:text-white"
                title="Редактировать"
              >
                <Pencil size={12} />
              </button>

              {/* Превью */}
                              <div
                                className="relative flex h-28 items-center justify-center overflow-hidden"
                                style={{
                                  backgroundColor: isCard
                                    ? cellBgColor("property")
                                    : (item.bgColor || "#f3e7c8"),
                                }}
                              >
                  <div className="flex h-full w-full items-center justify-center p-1">
                    {item.imageDataUrl ? (
                      <img src={item.imageDataUrl} alt={item.name} className="h-full w-full object-contain" />
                    ) : isCard ? (
                      <div style={{ fontSize: 28, lineHeight: 1 }}>{logo ?? "❓"}</div>
                    ) : item.category === "dice" ? (
                      <div style={{ fontSize: 32 }}>🎲</div>
                    ) : (
                      <div style={{ fontSize: 32 }}>👑</div>
                    )}
                  </div>
                  {/* Цветная полоска редкости */}
                  <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: item.rarity === "common" ? "#b0b0b0" : item.rarity === "rare" ? "#2563eb" : "#9b5de5" }} />
                </div>

              <div className="p-2">
                <div className="truncate text-[14px] font-bold leading-tight">{item.name}</div>
                <div className="text-[12px] text-muted-foreground">
                  {isCard ? `Слот: ${slotNum}` : item.category === "dice" ? "Кубик" : "VIP"} · {item.rarity}
                </div>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="text-[12px] font-bold text-primary flex items-center gap-0.5">{item.price} <Coins size={12} /></span>
                  <div className="flex gap-1">
                    <button
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${item.isActive ? "bg-[#dceae3] text-accent" : "bg-muted text-muted-foreground"}`}
                      onClick={() => {
                        const updatedItems = marketItems.map(prev => prev.id === item.id ? { ...prev, isActive: !prev.isActive } : prev);
                        setMarketItems(updatedItems);
                        socket.emit('save-custom-items', updatedItems);
                      }}
                    >
                      {item.isActive ? "Вкл" : "Выкл"}
                    </button>
                    <button
                      className="rounded bg-[#f6dfd7] px-1.5 py-0.5 text-[9px] font-bold text-primary"
                      onClick={() => {
                        if (!confirm(`Удалить товар «${item.name}»?`)) return;
                        socket.emit('delete-market-item', { itemId: item.id }, (res: any) => {
                          if (!res?.success) {
                            alert(res?.error || 'Не удалось удалить товар');
                          }
                          // Сервер сам пришлёт custom-items-updated
                        });
                      }}
                    >
                      Удал.
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>

     {/* Модальное окно создания товара */}
    {creatingMarketItem && (
      <MarketItemModal
        onClose={() => setCreatingMarketItem(false)}
        onSave={(newItem) => {
          const updatedItems = [...marketItems, newItem];
          setMarketItems(updatedItems);
          socket.emit('save-custom-items', updatedItems);
          setCreatingMarketItem(false);
        }}
      />
    )}
    {/* Модальное окно редактирования товара */}
    {editingMarketItem && (
      <MarketItemModal
        initialItem={editingMarketItem}
        onClose={() => setEditingMarketItem(null)}
        onSave={(updatedItem) => {
          const updatedItems = marketItems.map(item => item.id === updatedItem.id ? updatedItem : item);
          setMarketItems(updatedItems);
          socket.emit('save-custom-items', updatedItems);
          setEditingMarketItem(null);
        }}
      />
    )}
  </div>
)}

          {itemsTab === "cases" && (
            <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
              <div className="rounded-2xl border border-card-border bg-card p-5 space-y-4">
                <h2 className="font-display text-xl font-bold">
                  {editingCaseId ? "Редактирование кейса" : "Новый кейс"}
                </h2>
                <form onSubmit={createCase} className="grid gap-3">
                  <label className="text-xs font-bold">
                    Название кейса
                    <input
                      value={caseName}
                      onChange={(e) => setCaseName(e.target.value)}
                      placeholder="Например: Редкий кейс"
                      className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
                    />
                  </label>
                  <label className="text-xs font-bold">
    Описание кейса
    <input
        value={caseDesc}
        onChange={(e) => setCaseDesc(e.target.value)}
        placeholder="Например: Редкий предмет"
        className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
    />
</label>
<div className="grid grid-cols-2 gap-3">
    <label className="text-xs font-bold">
        Цена кейса
        <input
            type="number"
            value={casePrice}
            onChange={(e) => setCasePrice(e.target.value)}
            placeholder="100"
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
        />
    </label>
    <label className="text-xs font-bold">
        Цвет фона
        <input
            type="color"
            value={caseColor}
            onChange={(e) => setCaseColor(e.target.value)}
            className="mt-2 h-10 w-full cursor-pointer rounded-xl border border-input bg-background p-1"
        />
    </label>
    <label className="text-xs font-bold">
  Изображение кейса (JPG / PNG / GIF)
  <div className="mt-2 flex items-center gap-3">
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-input px-4 py-2.5 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary transition-colors">
      <Upload size={14} /> Загрузить файл
      <input
        type="file"
        accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          compressImageFile(file, 400, 400, 120000)
            .then((compressed) => setCaseImageDataUrl(compressed))
            .catch((err) => console.error("Ошибка сжатия картинки кейса:", err));
        }}
        className="hidden"
      />
    </label>
    {caseImageDataUrl && (
      <>
        <button
          type="button"
          onClick={() => {
            if (!caseImageDataUrl) return;
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d");
              if (!ctx) return;
              ctx.drawImage(img, 0, 0);
              const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const px = data.data;
              for (let i = 0; i < px.length; i += 4) {
                if (px[i] > 240 && px[i + 1] > 240 && px[i + 2] > 240) {
                  px[i + 3] = 0;
                }
              }
              ctx.putImageData(data, 0, 0);
              setCaseImageDataUrl(canvas.toDataURL("image/png"));
            };
            img.src = caseImageDataUrl;
          }}
          className="rounded-lg bg-[#f3e7c8] px-3 py-1.5 text-[11px] font-bold text-[#7e5f1d] hover:brightness-95"
          title="Все почти-белые пиксели станут прозрачными"
        >
          🧹 Убрать белый фон
        </button>
        <button onClick={() => setCaseImageDataUrl(undefined)} className="text-xs text-primary underline">
          удалить
        </button>
      </>
    )}
  </div>
</label>
</div>
<label className="text-xs font-bold">
    Иконка кейса
    <select
        value={caseIcon}
        onChange={(e) => setCaseIcon(e.target.value)}
        className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
    >
        {Object.keys(ICON_OPTIONS).map((key) => (
            <option key={key} value={key}>{key}</option>
        ))}
    </select>
</label>
<div className="rounded-xl border border-input bg-muted/40 p-3">
  <div className="mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
    📐 Размер карточки кейса
  </div>
  <div className="grid grid-cols-2 gap-3">
    <label className="text-xs font-bold">
      Ширина, px
      <input type="number" value={caseCardWidth} onChange={(e) => setCaseCardWidth(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal" />
    </label>
    <label className="text-xs font-bold">
      Высота карточки, px
      <input type="number" value={caseCardHeight} onChange={(e) => setCaseCardHeight(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal" />
    </label>
    <label className="text-xs font-bold">
      Высота картинки, px
      <input type="number" value={caseImageHeight} onChange={(e) => setCaseImageHeight(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal" />
    </label>
    <label className="text-xs font-bold">
      Масштаб картинки, %
      <input type="number" value={caseShopScale} onChange={(e) => setCaseShopScale(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal" />
    </label>
  </div>
</div>
                  {/* ПРЕВЬЮ КЕЙСА КАК В МАГАЗИНЕ */}
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-input bg-muted/40 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Превью в магазине
                    </div>
                    <div
                      className="flex flex-col rounded-2xl border border-card-border bg-card shadow-sm overflow-hidden"
                      style={{ width: `${Number(caseCardWidth) || CARD_SIZE_DEFAULTS.cardWidth}px` }}
                    >
                      <div
                        className="relative flex items-center justify-center overflow-hidden"
                        style={{
                          height: `${Number(caseImageHeight) || CARD_SIZE_DEFAULTS.imageHeight}px`,
                          backgroundColor: caseColor || "#e96852",
                        }}
                      >
                        {caseImageDataUrl ? (
                          <img
                            src={caseImageDataUrl}
                            alt="preview"
                            style={{
                              maxWidth: "100%",
                              maxHeight: "100%",
                              width: "auto",
                              height: "auto",
                              objectFit: "contain",
                              transform: `scale(${(Number(caseShopScale) || 90) / 100})`,
                              transformOrigin: "center center",
                            }}
                          />
                        ) : (
                          <div className="text-5xl" style={{ color: caseColor || "#e96852" }}>📦</div>
                        )}
                      </div>
                      <div className="p-4 flex flex-col gap-3 flex-1">
                        <div>
                          <h3 className="font-display text-lg font-bold">{caseName || "Название кейса"}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{caseDesc || "Описание кейса"}</p>
                        </div>
                        {caseSelectedItems.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {caseSelectedItems.map((id) => {
                              const it = marketItems.find((m) => m.id === id);
                              return it ? (
                                <span key={id} className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium">
                                  {it.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                        <div className="mt-auto flex items-center justify-between pt-2 border-t border-border">
                          <span className="flex items-center gap-1.5 font-mono text-sm font-bold">
                            <Coins size={15} className="text-[#b18428]" />
                            {Number(casePrice) || 100}
                          </span>
                          <button className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground">
                            Купить
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
<div>
  <div className="mb-2 text-xs font-bold">
    Предметы в кейсе (макс. 10)
  </div>
  <div className="grid gap-2 max-h-48 overflow-y-auto">
    {marketItems.filter(i => i.isActive).map((item) => (
      <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-muted">
        <input
          type="checkbox"
          checked={caseSelectedItems.includes(item.id)}
          onChange={(e) => {
            if (e.target.checked) {
              if (caseSelectedItems.length >= 10) return;
              setCaseSelectedItems([...caseSelectedItems, item.id]);
            } else {
              setCaseSelectedItems(caseSelectedItems.filter((i) => i !== item.id));
            }
          }}
          className="h-3.5 w-3.5 accent-primary"
        />
        {item.name} (Цена: {item.price})
      </label>
    ))}
  </div>
</div>
                  <div className="flex gap-2">
                    <button className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
                      {editingCaseId ? "Сохранить изменения" : "Создать кейс"}
                    </button>
                    {editingCaseId && (
                      <button
                        type="button"
                        onClick={resetCaseForm}
                        className="rounded-xl border border-input px-4 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted"
                      >
                        Отмена
                      </button>
                    )}
                  </div>
                </form>
              </div>
              <div>
                <h2 className="mb-4 font-display text-xl font-bold">
                  Кейсы{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({cases.length})
                  </span>
                </h2>
                {cases.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Пока нет ни одного кейса. Создай первый!
                  </p>
                )}
                                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(220px, 1fr))",
                  }}
                >
                  {cases.map((c) => {
                    const active = c.isActive !== false;
                    return (
                      <div
                        key={c.id}
                        className="relative flex flex-col overflow-hidden rounded-xl border border-card-border bg-card shadow-sm"
                      >
                        {/* Кнопки управления */}
                        <div className="absolute top-2 right-2 z-10 flex gap-1">
                          <button
                            onClick={() => openEditCase(c)}
                            className="flex h-5 w-5 items-center justify-center rounded-md bg-white/90 text-[#29233e] hover:bg-[#e96852] hover:text-white shadow-sm"
                            title="Редактировать"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => {
                              const updatedCases = cases.map((x) =>
                                x.id === c.id ? { ...x, isActive: !active } : x
                              );
                              setCases(updatedCases);
                              socket.emit('admin-save-cases', updatedCases);
                            }}
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              active
                                ? "bg-[#dceae3] text-accent"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {active ? "ВКЛ" : "ВЫКЛ"}
                          </button>
                          <button
                            onClick={() => {
                              const updatedCases = cases.filter(
                                (x) => x.id !== c.id
                              );
                              setCases(updatedCases);
                              socket.emit('admin-save-cases', updatedCases);
                            }}
                            className="flex h-5 w-5 items-center justify-center rounded-md bg-[#f6dfd7] text-primary hover:bg-[#efcec2]"
                            title="Удалить"
                          >
                            <X size={11} />
                          </button>
                        </div>

                        {/* Картинка кейса */}
                        <div
                          className="flex h-36 items-center justify-center overflow-hidden"
                          style={{ backgroundColor: (c.color || "#e96852") + "33" }}
                        >
                          {c.imageDataUrl ? (
                            <img
                              src={c.imageDataUrl}
                              alt={c.name}
                              className="h-full w-full object-contain p-3"
                            />
                          ) : (
                            <div
                              className="text-5xl"
                              style={{ color: c.color || "#e96852" }}
                            >
                              📦
                            </div>
                          )}
                        </div>

                        {/* Нижний блок с инфо */}
                        <div className="flex flex-col gap-2 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-bold text-sm">
                                {c.name}
                              </div>
                              {c.desc && (
                                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                  {c.desc}
                                </div>
                              )}
                            </div>
                            <span className="flex shrink-0 items-center gap-0.5 text-[12px] font-bold text-primary">
                              {c.price ?? 0} <Coins size={12} />
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {(c.items ?? []).length > 0 ? (
                              (c.items ?? []).map((itemId, idx) => (
                                <span
                                  key={`${itemId}-${idx}`}
                                  className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[9px] font-medium"
                                >
                                  {itemId}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] italic text-muted-foreground">
                                Предметы не настроены
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Идеально выверенный блок редактирования карточки */}
      {editingCard &&
        editDraft &&
        (() => {
          const dim = getCellDimensions(editDraft.slotIndex);

          const MAX_PREVIEW_SIZE = 130;
          const scaleRatio = Math.min(
            MAX_PREVIEW_SIZE / dim.hPx,
            MAX_PREVIEW_SIZE / dim.wPx,
          );
          const previewW = dim.wPx * scaleRatio;
          const previewH = dim.hPx * scaleRatio;

          let stripDir = null;
          if (editDraft.slotIndex >= 1 && editDraft.slotIndex <= 9)
            stripDir = "top";
          else if (editDraft.slotIndex >= 11 && editDraft.slotIndex <= 19)
            stripDir = "right";
          else if (editDraft.slotIndex >= 21 && editDraft.slotIndex <= 29)
            stripDir = "bottom";
          else if (editDraft.slotIndex >= 31 && editDraft.slotIndex <= 39)
            stripDir = "left";

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#29233e]/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-card-border bg-card shadow-2xl">
                <div className="flex items-center justify-between bg-[#29233e] px-6 py-4 text-white">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#e7ba68]">
                      редактор карточки
                    </div>
                    <h2 className="mt-0.5 font-display text-xl font-bold">
                      Поле #{editDraft.slotIndex} —{" "}
                      {boardCells[editDraft.slotIndex]?.name}
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setEditingCard(null);
                      setEditDraft(null);
                    }}
                    className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-0">
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <label className="block text-xs font-bold text-foreground">
                        Название поля
                        <input
                          value={editDraft.name}
                          onChange={(e) =>
                            setEditDraft((d) =>
                              d ? { ...d, name: e.target.value } : d,
                            )
                          }
                          className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </label>
                      <label className="block text-xs font-bold text-foreground">
                        Тип поля
                        <select
                          value={editDraft.type}
                          onChange={(e) =>
                            setEditDraft((d) =>
                              d
                                ? { ...d, type: e.target.value as CellType }
                                : d,
                            )
                          }
                          className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {CELL_TYPES_LIST.map((t) => (
                            <option key={t} value={t}>
                              {CELL_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="block text-xs font-bold text-foreground">
                        Стоимость поля (М)
                        <input
                          type="number"
                          value={editDraft.price ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) =>
                              d
                                ? {
                                    ...d,
                                    price: e.target.value
                                      ? Number(e.target.value)
                                      : undefined,
                                  }
                                : d,
                            )
                          }
                          placeholder="Нет цены"
                          className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </label>
                      <label className="block text-xs font-bold text-foreground">
                        Цвет группы (полоска)
                        <div className="mt-1.5 flex items-center gap-2">
                          <input
                            type="color"
                            value={editDraft.groupColor ?? "#cccccc"}
                            onChange={(e) =>
                              setEditDraft((d) =>
                                d ? { ...d, groupColor: e.target.value } : d,
                              )
                            }
                            className="h-9 w-14 cursor-pointer rounded-lg border border-input p-0.5"
                          />
                          <span className="text-xs font-mono text-muted-foreground">
                            {editDraft.groupColor ?? "не задан"}
                          </span>
                          {editDraft.groupColor && (
                            <button
                              onClick={() =>
                                setEditDraft((d) =>
                                  d ? { ...d, groupColor: undefined } : d,
                                )
                              }
                              className="text-[10px] text-primary underline"
                            >
                              сбросить
                            </button>
                          )}
                        </div>
                      </label>
                    </div>

                    {/* ПОЛЗУНОК КАСШТАБА */}
                    <label className="block text-xs font-bold text-foreground">
                      Касштаб изображения на карточке
                      <div className="mt-1.5 flex items-center gap-3">
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.05"
                          value={editDraft.scale ?? 1}
                          onChange={(e) =>
                            setEditDraft((d) =>
                              d
                                ? { ...d, scale: parseFloat(e.target.value) }
                                : d,
                            )
                          }
                          className="flex-1 h-1.5 bg-primary/30 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <span className="font-mono text-sm w-12 text-center">
                          {((editDraft.scale ?? 1) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </label>

                    <label className="block text-xs font-bold text-foreground">
                      Изображение карточки (JPG / PNG / GIF)
                      <div className="mt-1.5 flex items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-input px-4 py-2.5 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                          <Upload size={14} /> Загрузить файл
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>
                        {editDraft.imageDataUrl && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (!editDraft.imageDataUrl) return;
                                removeWhiteBackground(editDraft.imageDataUrl, 240, (res) => {
                                  setEditDraft((d) => d ? { ...d, imageDataUrl: res } : d);
                                });
                              }}
                              className="rounded-lg bg-[#f3e7c8] px-3 py-1.5 text-[11px] font-bold text-[#7e5f1d] hover:brightness-95"
                              title="Все почти-белые пиксели станут прозрачными"
                            >
                              🧹 Убрать белый фон
                            </button>
                            <button
                              onClick={() =>
                                setEditDraft((d) =>
                                  d ? { ...d, imageDataUrl: undefined } : d,
                                )
                              }
                              className="text-xs text-primary underline"
                            >
                              удалить
                            </button>
                          </>
                        )}
                      </div>
                    </label>

                    <div className="rounded-xl bg-muted p-3">
                      <div className="text-xs font-bold mb-1.5">
                        📐 Размер этой карточки (при доске 600px)
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
                        <div>
                          Ширина:{" "}
                          <b className="text-foreground">{dim.wPx} px</b>
                        </div>
                        <div>
                          Высота:{" "}
                          <b className="text-foreground">{dim.hPx} px</b>
                        </div>
                        <div className="col-span-2 text-[10px] opacity-70">
                          Угловые: {dim.isCorner ? "✓" : "—"} · Верх/Низ:{" "}
                          {dim.isTopBottom ? "✓" : "—"} · Лево/Право:{" "}
                          {dim.isLeftRight ? "✓" : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      {cardDesigns.find(
                        (d) => d.slotIndex === editDraft.slotIndex,
                      ) && (
                        <button
                          onClick={() => deleteCard(editDraft.slotIndex)}
                          className="rounded-xl border border-primary px-4 py-2.5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
                        >
                          🗑 Удалить дизайн
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingCard(null);
                          setEditDraft(null);
                        }}
                        className="flex-1 rounded-xl border border-input px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors"
                      >
                        Отмена
                      </button>
                      <button
                        onClick={saveCard}
                        className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
                      >
                        Сохранить
                      </button>
                    </div>
                  </div>

                  {/* Точный предпросмотр */}
                  <div className="border-l border-border bg-muted/50 p-4 flex flex-col items-center gap-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Предпросмотр
                    </div>
                    <div
                      className="relative overflow-hidden rounded-sm shadow-md flex flex-col"
                      style={{
                        width: previewW,
                        height: previewH,
                        backgroundColor: cellBgColor(editDraft.type),
                      }}
                    >
                      {editDraft.groupColor && stripDir && (
                        <div
                          style={{
                            position: "absolute",
                            top:
                              stripDir === "top"
                                ? 0
                                : stripDir === "bottom"
                                  ? undefined
                                  : 0,
                            bottom: stripDir === "bottom" ? 0 : undefined,
                            left:
                              stripDir === "left"
                                ? 0
                                : stripDir === "right"
                                  ? undefined
                                  : 0,
                            right: stripDir === "right" ? 0 : undefined,
                            height:
                              stripDir === "top" || stripDir === "bottom"
                                ? "18%"
                                : "100%",
                            width:
                              stripDir === "left" || stripDir === "right"
                                ? "18%"
                                : "100%",
                            backgroundColor: editDraft.groupColor,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {editDraft.price != null && (
                            <span
                              style={{
                                fontSize:
                                  stripDir === "top" || stripDir === "bottom"
                                    ? 18 // Увеличили с 12
                                    : 15, // Увеличили с 10
                                fontWeight: 800,
                                color: "#fff",
                                writingMode:
                                  stripDir === "left" || stripDir === "right"
                                    ? "vertical-rl"
                                    : undefined,
                                transform:
                                  stripDir === "left"
                                    ? "rotate(180deg)"
                                    : undefined,
                              }}
                            >
                              {(editDraft.price / 1000).toFixed(0)}k
                            </span>
                          )}
                        </div>
                      )}

                      {/* 2. Контейнер картинки, строго ограниченный белой зоной */}
                      <div
                        style={{
                          position: "absolute",
                          top: stripDir === "top" ? "18%" : 0,
                          bottom: stripDir === "bottom" ? "18%" : 0,
                          left: stripDir === "left" ? "18%" : 0,
                          right: stripDir === "right" ? "18%" : 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        {editDraft.imageDataUrl ? (
                          <img
                            src={editDraft.imageDataUrl}
                            alt=""
                            style={{
                              maxWidth: "100%",
                              maxHeight: "100%",
                              width: "auto",
                              height: "auto",
                              objectFit: "contain",
                              transform: `scale(${editDraft.scale ?? 1})`,
                              transformOrigin: "center center", // ВАЖНО: зум от центра!
                            }}
                          />
                        ) : (
                          <div style={{ fontSize: 36 }}>
                            {CELL_LOGOS[editDraft.slotIndex] ??
                              SPECIAL_ICONS[editDraft.type] ??
                              "❓"}
                          </div>
                        )}
                      </div>
                      {/* Блок с названием поля был удалён. Закрывающий тег контейнера идёт ниже */}
                    </div>

                    <div className="text-center text-[9px] text-muted-foreground leading-relaxed">
                      #{editDraft.slotIndex}
                      <br />
                      {dim.wPx}×{dim.hPx} px
                      <br />
                      {dim.wMm}×{dim.hMm} Км
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

function AuthModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (result: { kind: "player" | "admin"; user?: AuthUser }) => void;
}) {
  const [mode, setMode] = useState<"login" | "register" | "guest">("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [regLogin, setRegLogin] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [guestConfirm, setGuestConfirm] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegConfirmPw, setShowRegConfirmPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [savedLogins, setSavedLogins] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("arena-saved-logins") || "[]"); } catch { return []; }
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const loginWrapperRef = useRef<HTMLDivElement>(null);

  // При открытии окна — подставляем сохранённый логин/пароль, если были запомнены
  useEffect(() => {
    try {
      const saved = localStorage.getItem("arena-remembered");
      if (saved) {
        const { login: l, password: p } = JSON.parse(saved);
        if (l) setLogin(l);
        if (p) setPassword(p);
      }
    } catch {}
  }, []);

  // Закрываем выпадашку подсказок при клике вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (loginWrapperRef.current && !loginWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const [settings] = useServerSync<AdminSettings>(
  "arena-admin-settings",
  defaultSettings,
  ['admin-settings', 'admin-settings-updated'],
  'get-admin-settings'
);

  const close = () => {
    setError("");
    setGuestConfirm(false);
    onClose();
  };

  const submitLogin = (event: FormEvent) => {
  event.preventDefault();
  const cleanLogin = login.trim();
  if (!cleanLogin || !password) {
    setError("Заполни логин и пароль.");
    return;
  }
  if (cleanLogin.toLowerCase() === "admin") {
    if (password === (settings.adminPassword || "admin123")) {
      onSuccess({ kind: "admin" });
    } else {
      setError("Неверный пароль администратора.");
    }
    return;
  }
  const timeoutId = setTimeout(() => setError("Ошибка соединения с сервером"), 5000);
  socket.emit('login', { login: cleanLogin, password }, (response: any) => {
  clearTimeout(timeoutId);
  if (response?.success) {
      const user = response.user;
      localStorage.setItem("arena-session-user", JSON.stringify(user));
      localStorage.setItem("arena-user-data-" + user.id, JSON.stringify(response.data));

      // Сохраняем логин в историю подсказок (независимо от «Запомнить пароль»)
      const updated = [cleanLogin, ...savedLogins.filter(x => x !== cleanLogin)].slice(0, 5);
      setSavedLogins(updated);
      localStorage.setItem("arena-saved-logins", JSON.stringify(updated));

      // Запоминаем пароль, если стоит галочка
      if (rememberMe) {
        localStorage.setItem("arena-remembered", JSON.stringify({ login: cleanLogin, password }));
      } else {
        localStorage.removeItem("arena-remembered");
      }

      onSuccess({ kind: "player", user });
    } else {
      setError(response?.error || "Ошибка входа");
    }
  });
};

const submitRegister = (event: FormEvent) => {
  event.preventDefault();
  const cleanLogin = regLogin.trim();
  if (cleanLogin.length < 3) {
    setError("Логин должен быть не менее 3 символов.");
    return;
  }
  if (regPassword.length < 4) {
    setError("Пароль должен быть не менее 4 символов.");
    return;
  }
  if (regPassword !== regConfirm) {
    setError("Пароли не совпадают.");
    return;
  }
  const timeoutId = setTimeout(() => setError("Ошибка соединения с сервером"), 5000);
socket.emit('register', { login: cleanLogin, password: regPassword, name: cleanLogin }, (response: any) => {
  clearTimeout(timeoutId);
  if (response?.success) {
      const user = response.user;
      localStorage.setItem("arena-session-user", JSON.stringify(user));
      localStorage.setItem("arena-user-data-" + user.id, JSON.stringify(response.data));

      // Новый логин сразу попадает в подсказки, а пароль — в «запомненные»
      const updated = [cleanLogin, ...savedLogins.filter(x => x !== cleanLogin)].slice(0, 5);
      setSavedLogins(updated);
      localStorage.setItem("arena-saved-logins", JSON.stringify(updated));
      localStorage.setItem("arena-remembered", JSON.stringify({ login: cleanLogin, password: regPassword }));

      onSuccess({ kind: "player", user });
    } else {
      setError(response?.error || "Ошибка регистрации");
    }
  });
};

  const submitGuest = (event: FormEvent) => {
  event.preventDefault();
  const cleanName = nickname.trim();
  if (cleanName.length < 2) {
    setError("Никнейм должен быть длиннее двух символов.");
    return;
  }
  socket.emit('register', { login: null, password: null, name: cleanName, guest: true }, (response: any) => {
    if (response?.success) {
      const user = response.user;
      localStorage.setItem("arena-session-user", JSON.stringify(user));
      localStorage.setItem("arena-user-data-" + user.id, JSON.stringify(response.data));
      onSuccess({ kind: "player", user });
    } else {
      setError(response?.error || "Ошибка создания гостя");
    }
  });
};

  const fieldCls =
    "mt-2 w-full rounded-xl border border-[#d8ccba] bg-[#fffaf1] px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30";
  const fieldClsNoMargin =
    "w-full rounded-xl border border-[#d8ccba] bg-[#fffaf1] px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30";
  const labelCls = "block text-xs font-bold text-[#29233e]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#29233e]/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md overflow-hidden rounded-[1.5rem] border border-card-border bg-[#f7f0e3] shadow-[0_25px_80px_rgba(41,35,62,.3)]">
        <div className="flex items-center justify-between bg-[#29233e] px-6 py-5 text-[#f7f0e3]">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[.2em] text-[#e7ba68]">
              monopoly arena
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold">
              {mode === "register" ? "Регистрация" : "Войти в клуб"}
            </h2>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-white/65 hover:bg-white/10 hover:text-white"
          >
            <X size={19} />
          </button>
        </div>
        <div className="p-6">
          {mode !== "register" && (
            <div className="mb-5 grid grid-cols-2 rounded-xl bg-[#eadfce] p-1">
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "login" ? "bg-white text-[#29233e] shadow-sm" : "text-[#716b78]"}`}
              >
                Вход с паролем
              </button>
              <button
                onClick={() => {
                  setMode("guest");
                  setError("");
                  setGuestConfirm(false);
                }}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "guest" ? "bg-white text-[#29233e] shadow-sm" : "text-[#716b78]"}`}
              >
                Без регистрации
              </button>
            </div>
          )}

          {mode === "login" && (
            <form onSubmit={submitLogin} className="space-y-3" autoComplete="on">
              <label className={labelCls}>
                Логин
                <div className="relative mt-2" ref={loginWrapperRef}>
                  <input
                    autoFocus
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    onFocus={() => savedLogins.length > 0 && setShowSuggestions(true)}
                    placeholder="Ваш логин"
                    autoComplete="username"
                    name="username"
                    className={fieldClsNoMargin}
                  />
                  {showSuggestions && savedLogins.length > 0 && (() => {
                    const filtered = savedLogins.filter(l => !login || l.toLowerCase().includes(login.toLowerCase()));
                    return (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-auto rounded-xl border border-[#d8ccba] bg-[#fffaf1] shadow-lg">
                        {filtered.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-[#716b78]">Ничего не найдено</div>
                        ) : (
                          filtered.map(l => (
                            <button
                              key={l}
                              type="button"
                              onClick={() => {
                                setLogin(l);
                                setShowSuggestions(false);
                                try {
                                  const saved = localStorage.getItem("arena-remembered");
                                  if (saved) {
                                    const parsed = JSON.parse(saved);
                                    if (parsed.login === l && parsed.password) setPassword(parsed.password);
                                  }
                                } catch {}
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#eadfce]"
                            >
                              <UserRound size={14} className="shrink-0 text-[#716b78]" />
                              <span className="truncate">{l}</span>
                            </button>
                          ))
                        )}
                      </div>
                    );
                  })()}
                </div>
              </label>
              <label className={labelCls}>
                Пароль
                <div className="relative mt-2">
                  <input
                    type={showLoginPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Пароль"
                    autoComplete="current-password"
                    name="password"
                    className={`${fieldClsNoMargin} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#716b78] hover:text-[#29233e] transition-colors"
                    tabIndex={-1}
                    aria-label={showLoginPw ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showLoginPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-[#29233e] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="accent-[#e96852] h-3.5 w-3.5"
                />
                Запомнить пароль
              </label>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
                Войти <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-input py-2.5 text-xs font-bold text-[#29233e] hover:bg-[#eadfce] transition-colors"
              >
                Зарегистрироваться
              </button>
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={submitRegister} className="space-y-3" autoComplete="off">
              <label className={labelCls}>
                Придумай логин
                <input
                  autoFocus
                  value={regLogin}
                  onChange={(e) => setRegLogin(e.target.value)}
                  placeholder="Минимум 3 символа"
                  autoComplete="off"
                  name="new-username"
                  className={fieldCls}
                />
              </label>
              <label className={labelCls}>
                Придумай пароль
                <div className="relative mt-2">
                  <input
                    type={showRegPw ? "text" : "password"}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Минимум 4 символа"
                    autoComplete="new-password"
                    name="new-password"
                    className={`${fieldClsNoMargin} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#716b78] hover:text-[#29233e] transition-colors"
                    tabIndex={-1}
                    aria-label={showRegPw ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showRegPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label className={labelCls}>
                Повтори пароль
                <div className="relative mt-2">
                  <input
                    type={showRegConfirmPw ? "text" : "password"}
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    placeholder="Повтори пароль"
                    autoComplete="new-password"
                    name="confirm-password"
                    className={`${fieldClsNoMargin} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#716b78] hover:text-[#29233e] transition-colors"
                    tabIndex={-1}
                    aria-label={showRegConfirmPw ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showRegConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
                Зарегистрироваться <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-input py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors"
              >
                ← Назад
              </button>
            </form>
          )}

          {mode === "guest" && (
            <form onSubmit={submitGuest}>
              <label className={labelCls}>
                Введите никнейм
                <input
                  autoFocus
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setGuestConfirm(false);
                    setError("");
                  }}
                  placeholder="Например, Иван Иванов"
                  className={fieldCls}
                />
              </label>
              <div className="mt-3 rounded-xl border border-[#e7ba68]/40 bg-[#f3e7c8] px-3 py-2.5 text-[11px] leading-4 text-[#7e5f1d]">
                <div className="mb-1 font-bold">⚠️ Временный режим</div>
                В гостевом режиме вы можете сыграть партию и осмотреться.
                <br />
                <b>Прогресс, ник, Coins, инвентарь и награды не сохраняются</b> — они исчезнут, как только вы закроете сайт.
                <br />
                Чтобы копить и не терять достижения,{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                  className="font-bold text-primary underline"
                >
                  зарегистрируйтесь
                </button>
                .
              </div>
              <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
                {guestConfirm ? "Войти под этим никнеймом" : "Войти"}{" "}
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {error && (
            <div className="mt-3 rounded-lg bg-[#f6dfd7] px-3 py-2 text-xs font-medium text-primary">
              {error}
            </div>
          )}
          {mode !== "register" && (
            <button
              onClick={close}
              className="mt-4 w-full text-center text-xs font-bold text-[#716b78]"
            >
              Отмена
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AppShell({
  tab,
  setTab,
  children,
  name,
  onLogin,
  onLogout,
  isAdmin = false,
  gameMode = false,
  incomingTradesCount = 0,
  friendRequestsCount = 0,
  onOpenWallet,
}: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  children: ReactNode;
  name?: string;
  onLogin: () => void;
  onLogout: () => void;
  isAdmin?: boolean;
  gameMode?: boolean;
  incomingTradesCount?: number;
  friendRequestsCount?: number;
  onOpenWallet?: () => void;
}) {
  const [mobileNav, setMobileNav] = useState(false);

  // Аватарка игрока — читаем из localStorage, обновляем при событии из Профиля.
  const [userAvatar, setUserAvatar] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem("arena-session-user");
      if (!raw || raw === "null") return null;
      const u = JSON.parse(raw);
      return u?.avatar || null;
    } catch { return null; }
  });
  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem("arena-session-user");
        if (!raw || raw === "null") { setUserAvatar(null); return; }
        const u = JSON.parse(raw);
        setUserAvatar(u?.avatar || null);
      } catch { setUserAvatar(null); }
    };
    refresh();
    window.addEventListener("arena-user-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("arena-user-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

const [notifications, setNotifications] = useState<{ text: string; timestamp: number; read: boolean }[]>([]);
const [showNotifications, setShowNotifications] = useState(false);
const [profileMenuOpen, setProfileMenuOpen] = useState(false);
const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifications]);

// Кошелёк и VIP для плашки в шапке
const [walletCoins, setWalletCoins] = useState<number>(() => {
  try { return Number(localStorage.getItem("arena-coins") || 0); } catch { return 0; }
});
const [walletVipUntil, setWalletVipUntil] = useState<string | null>(() => {
  try { return localStorage.getItem("arena-vip-until"); } catch { return null; }
});

useEffect(() => {
  const refresh = () => {
    try {
      setWalletCoins(Number(localStorage.getItem("arena-coins") || 0));
      setWalletVipUntil(localStorage.getItem("arena-vip-until"));
    } catch {}
  };
  // 1) изменения в этой же вкладке (эмитим вручную)
  window.addEventListener("arena-wallet-updated", refresh);
  // 2) изменения в других вкладках
  window.addEventListener("storage", refresh);
  // 3) приходят с сервера после покупок/квестов/рынка
  const onUserData = (data: any) => {
    if (!data) return;
    try {
      if (typeof data.coins === "number") {
        localStorage.setItem("arena-coins", String(data.coins));
      }
      if (data.vipUntil !== undefined) {
        if (data.vipUntil) localStorage.setItem("arena-vip-until", data.vipUntil);
        else localStorage.removeItem("arena-vip-until");
      }
    } catch {}
    refresh();
  };
  socket.on("user-data-updated", onUserData);
  refresh();
  return () => {
    window.removeEventListener("arena-wallet-updated", refresh);
    window.removeEventListener("storage", refresh);
    socket.off("user-data-updated", onUserData);
  };
}, []);
const [serverStatus, setServerStatus] = useState<"online" | "maintenance">(() => {
  try {
    const saved = localStorage.getItem("arena-server-status");
    if (saved === "maintenance" || saved === "online") return saved;
  } catch {}
  return "online";
});

// Подписка на статус сервера напрямую — сработает мгновенно, как статус друзей
useEffect(() => {
  const handleStatus = (newStatus: string) => {
    if (newStatus !== "online" && newStatus !== "maintenance") return;
    setServerStatus(newStatus);
    try { localStorage.setItem("arena-server-status", newStatus); } catch {}
  };
  socket.on('server-status', handleStatus);
  socket.on('server-status-updated', handleStatus);
  // Запрашиваем актуальный статус при монтировании и при переподключении
  socket.emit('get-server-status');
  socket.on('connect', () => socket.emit('get-server-status'));
  return () => {
    socket.off('server-status', handleStatus);
    socket.off('server-status-updated', handleStatus);
    socket.off('connect');
  };
}, []);

const isMaintenance = serverStatus === "maintenance";

useEffect(() => {
    const storedUser = localStorage.getItem("arena-session-user");
    if (!storedUser) return;
    const user = JSON.parse(storedUser);
    if (!user || user.guest) return; // <--- ДОБАВЛЕНО: !user защищает от null
    
    socket.emit('get-notifications', user.id, (response: any) => {
        if (response?.success) setNotifications(response.notifications);
    });
    
    socket.on('new-notification', (newNotifs) => {
        setNotifications(newNotifs);
    });
    
    return () => {
  socket.off('new-notification');
};
}, []);
  const items = isAdmin
    ? navItems
    : navItems.filter((item) => item.id !== "admin");
  const initials = isAdmin
    ? "АД"
    : name
      ? name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase()
      : "Г";
  return (
    <div className="arena-shell arena-noise flex min-h-[100dvh] text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-[165px] bg-[#29233e] text-[#f7f0e3] transition-transform md:static md:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-full flex-col p-3">
          <div className="flex items-center gap-2 px-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e96852]">
              <Crown size={14} />
            </div>
            <div className="text-xs font-bold tracking-wide">
              MONO<span className="text-[#e7ba68]">ARENA</span>
            </div>
          </div>
          <div className="mt-5 px-1 font-mono text-[8px] uppercase tracking-[.18em] text-[#8f8799]">
            {isAdmin ? "Управление" : "Твой клуб"}
          </div>
          <nav className="mt-2 space-y-0.5">
            {items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  setMobileNav(false);
                }}
                className={`nav-pill flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium ${tab === id ? "bg-[#e96852] font-bold text-white shadow-lg shadow-[#e96852]/15" : "text-[#c1bac8] hover:bg-white/5 hover:text-white"}`}
              >
                <Icon size={14} />
                {label}
                {id === "inventory" && incomingTradesCount > 0 && (
                  <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                    {incomingTradesCount}
                  </span>
                )}
                {id === "friends" && friendRequestsCount > 0 && (
                  <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e7ba68] px-1 text-[9px] font-bold text-[#29233e]">
                    {friendRequestsCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-2">
            <div className="flex items-center gap-2">
              {name ? (
                <Avatar
                  initials={isAdmin ? "АД" : initials}
                  color={isAdmin ? "#e96852" : "#32786d"}
                  size="sm"
                  avatar={isAdmin ? null : userAvatar}
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70">
                  <UserRound size={13} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-bold">
  {name || "Гость"}
  {isVipActive() && (
    <span className="ml-1 rounded bg-[#d3a247] px-1 py-0.5 text-[9px] font-bold text-white">
      VIP
    </span>
  )}
</div>
                <div className="font-mono text-[8px] text-[#aaa2b4]">
  {isAdmin ? "ADMIN" : name ? (JSON.parse(localStorage.getItem("arena-session-user") || "{}").id || "MA-XXXX") : "Войди"}
</div>
              </div>
              {name ? (
                <button
                  onClick={onLogout}
                  className="text-[#aaa2b4] hover:text-white"
                  aria-label="Выйти"
                >
                  <LogOut size={13} />
                </button>
              ) : (
                <button
                  onClick={onLogin}
                  className="rounded-md bg-[#e96852] px-2 py-1 text-[9px] font-bold text-white"
                >
                  Войти
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          onClick={() => setMobileNav(false)}
          className="fixed inset-0 z-20 bg-[#29233e]/40 md:hidden"
          aria-label="Закрыть Кеню"
        />
      )}
      <main className="min-w-0 flex-1 pl-[20px] pr-[20px] pt-[5px] pb-[5px]">
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b border-card-border bg-[#f1eadc]/90 px-4 backdrop-blur-md md:px-6 ml-[-20px] mr-[-20px] justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileNav(true)}
              className="rounded-lg p-1.5 hover:bg-muted md:hidden"
            >
              <PanelLeft size={17} />
            </button>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              {isAdmin ? (
                // Админ — управление статусом через выпадашку
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${isMaintenance ? "bg-orange-500" : "bg-accent"}`}
                  />
                  <select
                    value={serverStatus}
                    onChange={(e) => {
                      const newStatus = e.target.value as "online" | "maintenance";
                      setServerStatus(newStatus);
                      try { localStorage.setItem("arena-server-status", newStatus); } catch {}
                      socket.emit('admin-update-server-status', newStatus);
                    }}
                    className={`cursor-pointer rounded-lg border border-input bg-card px-2 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/30 ${
                      isMaintenance ? "text-orange-600" : "text-accent"
                    }`}
                  >
                    <option value="online">Сервер Онлайн</option>
                    <option value="maintenance">Технические работы</option>
                  </select>
                </div>
              ) : (
                // Обычный игрок — просто текст со статусом
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${isMaintenance ? "bg-orange-500" : "bg-accent"}`}
                  />
                  <span
                    className={`font-bold ${isMaintenance ? "text-orange-600" : "text-accent"}`}
                  >
                    {isMaintenance ? "Технические работы" : "Сервер Онлайн"}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-[20px] mr-[20px]">
            {name && !isAdmin && (
              <div className="flex items-center gap-1 rounded-xl bg-[#f3e7c8] px-2 py-1.5 text-[11px] font-bold text-[#7e5f1d] sm:gap-1.5 sm:px-3 sm:text-xs">
                <Coins size={14} className="shrink-0" />
                <span className="font-mono">{walletCoins.toLocaleString("ru-RU")}</span>
                {(() => {
                  if (!walletVipUntil) return null;
                  const end = new Date(walletVipUntil);
                  if (end < new Date()) return null;
                  const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <>
                      <span className="mx-0.5 text-[#7e5f1d]/40">·</span>
                      <Crown size={14} className="shrink-0" />
                      <span className="font-mono">{daysLeft}д</span>
                    </>
                  );
                })()}
              </div>
            )}
            <button className="hidden rounded-lg p-1.5 text-muted-foreground hover:bg-muted sm:block">
              <CircleHelp size={16} />
            </button>
            <div className="relative" ref={notificationsRef}>
        <button
        onClick={() => {
          const willOpen = !showNotifications;
          setShowNotifications(willOpen);
          if (willOpen && notifications.some(n => !n.read)) {
            const storedUser = localStorage.getItem("arena-session-user");
            if (storedUser) {
              const u = JSON.parse(storedUser);
              if (u && !u.guest) {
                socket.emit('mark-notifications-read', u.id);
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
              }
            }
          }
        }}
        className="relative rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
    >
        <Bell size={16} />
        {notifications.filter(n => !n.read).length > 0 && (
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
        )}
    </button>
      {showNotifications && (
        <div className="fixed left-3 right-3 top-14 z-50 rounded-xl border border-card-border bg-card p-3 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-10 sm:w-72">
            <div className="mb-2 flex items-center justify-between">
                <div className="font-bold text-sm">Уведомления</div>
                {notifications.length > 0 && (
                    <button
                        onClick={() => {
                            const storedUser = localStorage.getItem("arena-session-user");
                            if (!storedUser) return;
                            const u = JSON.parse(storedUser);
                            if (!u || u.guest) return;
                            socket.emit('clear-notifications', u.id);
                            setNotifications([]);
                        }}
                        className="rounded-md px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-[#f6dfd7] transition-colors"
                        title="Очистить все уведомления"
                    >
                        Очистить
                    </button>
                )}
            </div>
            {notifications.length === 0 ? (
                <div className="text-xs text-muted-foreground">Нет уведомлений</div>
            ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {notifications.map((n, i) => (
                        <div key={i} className="rounded-lg bg-muted p-2 text-xs">
                            {n.text}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )}
</div>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <div className="flex items-center gap-2">
              {name ? (
                <>
                  <div className="relative">
                    <button
                      onClick={() => setProfileMenuOpen((v) => !v)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted"
                    >
                      <Avatar
                        initials={isAdmin ? "АД" : initials}
                        color={isAdmin ? "#e96852" : "#32786d"}
                        size="sm"
                        avatar={isAdmin ? null : userAvatar}
                      />
                      <span className="max-w-[110px] truncate text-xs font-bold sm:max-w-none">
                        {name}
                        {isVipActive() && (
                          <span className="ml-1 rounded bg-[#d3a247] px-1 py-0.5 text-[9px] font-bold text-white">
                            VIP
                          </span>
                        )}
                      </span>
                      <ChevronDown size={12} className="hidden shrink-0 text-muted-foreground sm:block" />
                    </button>
                    {profileMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setProfileMenuOpen(false)}
                        />
                        <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-card-border bg-card shadow-2xl">
                          {!isAdmin && onOpenWallet && (
                            <button
                              onClick={() => {
                                onOpenWallet();
                                setProfileMenuOpen(false);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold transition-colors hover:bg-muted"
                            >
                              <Coins size={14} className="text-[#b18428]" />
                              Кошелёк
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setProfileMenuOpen(false);
                              onLogout();
                            }}
                            className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-xs font-bold text-muted-foreground transition-colors hover:bg-muted"
                          >
                            <LogOut size={14} />
                            Выйти
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <button
                  onClick={onLogin}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                >
                  <UserRound size={13} /> Войти
                </button>
              )}
            </div>
          </div>
        </header>
        <div key={tab} className="mx-auto max-w-[1600px] p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

function GameShell({ children, name }: { children: ReactNode; name?: string }) {
  const initials = name
    ? name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "Г";
  return (
    <div className="arena-shell arena-noise flex h-[100dvh] overflow-hidden text-foreground">
      {/* Сайдбар — только на десктопе. На мобиле и планшете скрывается,
          чтобы освободить максимум места под игровой стол. */}
      <aside className="hidden w-[143px] shrink-0 flex-col bg-[#29233e] p-4 text-[#f7f0e3] lg:flex">
        <div className="flex flex-col">
          <span className="font-bold tracking-wide text-[20px] leading-tight">
            Monopoly
          </span>
          <span className="font-bold tracking-wide text-[20px] leading-tight text-[#e7ba68]">
            Arena
          </span>
        </div>
        <nav className="mt-4"></nav>
      </aside>
      <main className="flex min-h-0 flex-1 overflow-hidden bg-foreground">
        {children}
      </main>
    </div>
  );
}

function Home() {
  const [legacyName] = useState<string | null>(() => {
    try {
      return localStorage.getItem("arena-nickname") || null;
    } catch {
      return null;
    }
  });
  const [player, setPlayer] = useLocalStorage<AuthUser | null>(
    "arena-session-user",
    legacyName ? makeAuthUser(legacyName, undefined, undefined, true) : null,
  );
  const [adminAuthed, setAdminAuthed] = useLocalStorage(
    "arena-admin-auth",
    false,
  );
  const [tab, setTab] = useState<Tab>("dashboard");
  const [game, setGame] = useState(false);
const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pending, setPending] = useState<"create" | "find" | "join" | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);

  // Если с лендинга прилетел сигнал «открой окно авторизации» —
  // открываем AuthModal один раз и убираем флаг.
  useEffect(() => {
    try {
      if (localStorage.getItem("arena-open-auth") === "1") {
        localStorage.removeItem("arena-open-auth");
        // Открываем модалку только если игрок ещё не авторизован.
        if (!player && !adminAuthed) {
          setAuthOpen(true);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pendingChatFriend, setPendingChatFriend] = useState<{ id: string; name: string; online: boolean } | null>(null);
  const [activeGame, setActiveGame] = useState<{ roomId: string; roomName: string; disconnected: boolean } | null>(null);
  const [incomingTradesCount, setIncomingTradesCount] = useState(0);
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);

  useEffect(() => {
    if (!player?.id || player.guest) {
      setFriendRequestsCount(0);
      return;
    }
    const fetch = () => {
      socket.emit("get-friend-requests", player.id, (res: any) => {
        if (res?.success) setFriendRequestsCount((res.requests || []).length);
      });
    };
    fetch();
    // Обновляем счётчик при любых событиях друзей
    socket.on("friend-status-changed", fetch);
    return () => {
      socket.off("friend-status-changed", fetch);
    };
  }, [player?.id, player?.guest]);
  const [walletOpen, setWalletOpen] = useState(false);
  useEffect(() => {
    if (!player?.id) {
      setIncomingTradesCount(0);
      return;
    }
    const fetch = () => {
      socket.emit("get-trades", player.id, (res: any) => {
        if (res?.success) {
          setIncomingTradesCount((res.incoming || []).length);
        }
      });
    };
    fetch();
    socket.on("trades-updated", fetch);
    return () => {
      socket.off("trades-updated", fetch);
    };
  }, [player?.id]);

  // Запрашиваем активную игру при логине
  useEffect(() => {
    if (!player?.id) { setActiveGame(null); return; }
    const fetchActive = () => {
      socket.emit('get-active-game', player.id, (res: any) => {
        if (res?.success && res.room) setActiveGame(res.room);
        else setActiveGame(null);
      });
    };
    fetchActive();
    // Обновляем при переподключении сокета
    socket.on('connect', fetchActive);
    return () => { socket.off('connect', fetchActive); };
  }, [player?.id]);

  const isAuthed = !!(player || adminAuthed);

  // Gate actions behind login when not authenticated
  const requestCreate = () => {
    if (isAuthed) {
      setCreateOpen(true);
    } else {
      setPending("create");
      setAuthOpen(true);
    }
  };
  const requestFind = () => {
    if (isAuthed) {
      setFindOpen(true);
    } else {
      setPending("find");
      setAuthOpen(true);
    }
  };
    const gameTriggerRef = useRef<string | null>(null);

// Добавь этот useEffect после всех useState в Home
useEffect(() => {
    if (gameTriggerRef.current && currentRoomId) {
        setGame(true);
        gameTriggerRef.current = null;
    }
}, [currentRoomId]);
  // Автосжатие старого аватара. Если в БД лежит большая base64-картинка
  // (> 20 KB, что ≈ 15 KB бинарника) — один раз за сессию пережимаем
  // до 256×256 и отправляем update-avatar. Защита от цикла — ref.
  const avatarCompressedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!player?.id || !player.avatar) return;
    if (player.avatar.length < 20000) return;
    if (avatarCompressedRef.current === player.id) return;
    avatarCompressedRef.current = player.id;

    (async () => {
      try {
        const compressed = await compressBase64Url(player.avatar!, 256, 256, 60000);
        if (compressed.length < player.avatar!.length - 1000) {
          socket.emit('update-avatar', { userId: player.id, avatar: compressed }, (res: any) => {
            if (res?.success) {
              try {
                const raw = localStorage.getItem("arena-session-user");
                if (raw && raw !== "null") {
                  const u = JSON.parse(raw);
                  u.avatar = compressed;
                  localStorage.setItem("arena-session-user", JSON.stringify(u));
                  window.dispatchEvent(new Event("arena-user-updated"));
                }
              } catch {}
              console.log(`♻️ Аватар ${player.id} сжат: ${player.avatar!.length} → ${compressed.length}`);
            }
          });
        }
      } catch (err) {
        console.error("Ошибка автосжатия аватара:", err);
      }
    })();
  }, [player?.id, player?.avatar]);


// Счётчик минут онлайн: +1 каждые 60 секунд, пока игрок авторизован
useEffect(() => {
  if (!player?.id) return;
  const interval = setInterval(() => {
    const key = "arena-user-data-" + player.id;
    const existing = JSON.parse(localStorage.getItem(key) || "{}");
    const current = existing.minutesOnline || 0;
    const updated = { ...existing, minutesOnline: current + 1 };
    localStorage.setItem(key, JSON.stringify(updated));
    // Синхронизируем с сервером каждые 5 минут (и на каждой 1-й минуте — тоже, чтобы не терять данные при неожиданном выходе)
    if ((current + 1) % 5 === 0 || current === 0) {
      socket.emit('save-user-data', { userId: player.id, newData: { minutesOnline: current + 1 } });
    }
  }, 60_000);
  return () => clearInterval(interval);
}, [player?.id]);

const requestJoin = (roomId?: string) => {
    if (isAuthed) {
        if (roomId) setCurrentRoomId(roomId);
        // Запоминаем, что нужно запустить игру, но ждём обновления currentRoomId
        gameTriggerRef.current = roomId || null;
    } else {
        setPending("join");
        setAuthOpen(true);
    }
};

    const onAuthSuccess = (result: {
  kind: "player" | "admin";
  user?: AuthUser;
}) => {
  setAuthOpen(false);
  if (result.kind === "admin") {
    setAdminAuthed(true);
    setPlayer(null);
    setPending(null);
    localStorage.removeItem("arena-session-user"); // <--- ДОБАВЛЕНО: очищаем старую сессию
    return;
}
  if (result.user) {
    const user = result.user; // Сохраняем в константу
    setPlayer(user);
    setAdminAuthed(false);
    localStorage.setItem("arena-nickname", user.name);
    
    // Загружаем данные пользователя с сервера (если их ещё нет в кэше)
    socket.emit('get-user-data', user.id, (response: any) => {
            if (response?.success) {
        const data = response.data;
        // Полная запись user-data — её читает Профиль
        localStorage.setItem("arena-user-data-" + user.id, JSON.stringify(data));
        localStorage.setItem("arena-coins", String(data.coins || 2400));
        localStorage.setItem("arena-inventory", JSON.stringify(data.inventory || []));
        localStorage.setItem("arena-stats", JSON.stringify(data.stats || {}));
localStorage.setItem("arena-friends", JSON.stringify(data.friends || []));
const vipUntil = data.vipUntil;
if (vipUntil) {
  localStorage.setItem("arena-vip-until", vipUntil);
} else {
  localStorage.removeItem("arena-vip-until");
}
// Восстанавливаем активные скины из серверных данных
      if (data.activeSkins && typeof data.activeSkins === "object") {
  try {
    const current = JSON.parse(localStorage.getItem("arena-active-skins") || "{}");
    localStorage.setItem("arena-active-skins", JSON.stringify({
      dice: current.dice || "none",
      token: current.token || "none",
      board: current.board || "none",
      activeSkins: data.activeSkins,
    }));
  } catch {}
}
      // Обновляем все реактивные элементы шапки (аватар, кошелёк, VIP).
      window.dispatchEvent(new Event("arena-user-updated"));
      window.dispatchEvent(new Event("arena-wallet-updated"));
      window.dispatchEvent(new Event("storage"));
      } else {
        // Если данных нет, создаём их по умолчанию и сохраняем
        const defaultData = {
          inventory: [],
          coins: 2400,
          stats: { games: 0, wins: 0, xp: 0, level: 0 },
          friends: []
        };
        // ВАЖНО: здесь используем user.id, а не result.user.id
        socket.emit('save-user-data', { userId: user.id, newData: defaultData });
      }
    });
  }
  const action = pending;
  setPending(null);
  if (action === "create") setCreateOpen(true);
  else if (action === "find") setFindOpen(true);
  else if (action === "join") setGame(true);
};
  const logout = () => {
    setPlayer(null);
    setAdminAuthed(false);
    setGame(false);
    setTab("dashboard");
    setCreateOpen(false);
    setFindOpen(false);
    localStorage.removeItem("arena-nickname");
  };

  if (adminAuthed) {
    if (game) {
      return (
        <>
          <GameShell name="Администратор">
            <BoardGame onExit={() => setGame(false)} initialRoomId={currentRoomId} currentUser={player} />
          </GameShell>
          {authOpen && (
            <AuthModal
              onClose={() => {
                setAuthOpen(false);
                setPending(null);
              }}
              onSuccess={onAuthSuccess}
            />
          )}
        </>
      );
    }

    let adminContent: ReactNode;
    switch (tab) {
      case "dashboard":
                adminContent = (
          <Dashboard
            isAdmin={true}
            player={player}
  onTab={setTab}
  onOpenFriendChat={(friend) => {
    setPendingChatFriend(friend);
    setTab("friends");
  }}
  onJoinGame={requestJoin}
            onRequestCreate={requestCreate}
            onRequestFind={requestFind}
            createOpen={createOpen}
            findOpen={findOpen}
            onCloseCreate={() => setCreateOpen(false)}
            onCloseFind={() => setFindOpen(false)}
            playerName="Администратор"
          />
        );
        break;
      case "friends":
        adminContent = <Friends 
  player={player}
  pendingChatFriend={pendingChatFriend}
  onPendingChatConsumed={() => setPendingChatFriend(null)}
/>;
        break;
      case "shop":
        adminContent = <Shop />;
        break;
      case "profile":
        adminContent = <Profile onInventory={() => setTab("inventory")} onOpenWallet={() => setWalletOpen(true)} player={player} />;
        break;
      case "inventory":
        adminContent = <Inventory onMarket={() => setTab("market")} />;
        break;
      case "market":
        adminContent = <Market />;
        break;
      case "admin":
        adminContent = <Admin onLogout={logout} />;
        break;
      default:
        adminContent = (
          <Dashboard
            player={player}
  onTab={setTab}
  onJoinGame={requestJoin}
            onRequestCreate={requestCreate}
            onRequestFind={requestFind}
            createOpen={createOpen}
            findOpen={findOpen}
            onCloseCreate={() => setCreateOpen(false)}
            onCloseFind={() => setFindOpen(false)}
            playerName="Администратор"
          />
        );
    }

    return (
      <AppShell
        key={tab}
        tab={tab}
        setTab={setTab}
        name="Администратор"
        onLogin={() => setAuthOpen(true)}
        isAdmin={true}
        onLogout={logout}
        incomingTradesCount={incomingTradesCount}
        friendRequestsCount={friendRequestsCount}
        onOpenWallet={() => setWalletOpen(true)}
      >
        {adminContent}
      </AppShell>
    );
  }
  // ДОБАВИЛИ ПРОВЕРКУ game && currentRoomId, чтобы не запускать игру с null ID
  if (game && currentRoomId) {
    return (
      <>
        <GameShell name={player?.name}>
          <BoardGame onExit={() => setGame(false)} initialRoomId={currentRoomId} currentUser={player} />
        </GameShell>
        {authOpen && (
          <AuthModal
            onClose={() => {
              setAuthOpen(false);
              setPending(null);
            }}
            onSuccess={onAuthSuccess}
          />
        )}
      </>
    );
  }

    const dashboard = (
    <Dashboard
      player={player}
  onTab={setTab}
  onOpenFriendChat={(friend) => {
    setPendingChatFriend(friend);
    setTab("friends");
  }}
  onJoinGame={requestJoin}
      onRequestCreate={requestCreate}
      onRequestFind={requestFind}
      createOpen={createOpen}
      findOpen={findOpen}
      onCloseCreate={() => setCreateOpen(false)}
      onCloseFind={() => setFindOpen(false)}
      playerName={player?.name}
      activeGame={activeGame}
      onReconnectGame={(roomId) => {
        setActiveGame(null);
        setCurrentRoomId(roomId);
        setGame(true);
      }}
      onLeaveActiveGame={() => {
        if (!activeGame || !player?.id) return;
        socket.emit('leave-game', { roomId: activeGame.roomId, userId: player.id });
        setActiveGame(null);
      }}
    />
  );
  const content =
    tab === "dashboard" ? (
      dashboard
    ) : tab === "friends" ? (
      <Friends 
  player={player}
  pendingChatFriend={pendingChatFriend}
  onPendingChatConsumed={() => setPendingChatFriend(null)}
/>
    ) : tab === "shop" ? (
      <Shop />
    ) : tab === "profile" ? (
      <Profile onInventory={() => setTab("inventory")} onOpenWallet={() => setWalletOpen(true)} player={player} />
    ) : tab === "inventory" ? (
      <Inventory onMarket={() => setTab("market")} />
    ) : tab === "market" ? (
      <Market />
    ) : (
      dashboard
    );
  return (
    <>
      <AppShell
        tab={tab}
        setTab={setTab}
        name={player?.name}
        onLogin={() => setAuthOpen(true)}
        onLogout={logout}
        incomingTradesCount={incomingTradesCount}
        friendRequestsCount={friendRequestsCount}
        onOpenWallet={() => setWalletOpen(true)}
      >
        {content}
      </AppShell>
      {authOpen && (
        <AuthModal
          onClose={() => {
            setAuthOpen(false);
            setPending(null);
          }}
          onSuccess={onAuthSuccess}
        />
      )}
      {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
    </>
  );
}

function AccessGate({ children }: { children: ReactNode }) {
  const [granted, setGranted] = useState<boolean>(() => {
    try {
      return localStorage.getItem("arena-access-granted") === "1";
    } catch {
      return false;
    }
  });
  const [input, setInput] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (input === SITE_ACCESS_PASSWORD) {
      try { localStorage.setItem("arena-access-granted", "1"); } catch {}
      setGranted(true);
    } else {
      setError("Неверный пароль. Попробуйте ещё раз.");
      setInput("");
    }
  };

  if (granted) return <>{children}</>;

  return (
    <div className="arena-shell arena-noise flex min-h-[100dvh] items-center justify-center bg-[#f1eadc] p-4 text-foreground">
      <div className="w-full max-w-md overflow-hidden rounded-[1.5rem] border border-card-border bg-[#f7f0e3] shadow-[0_25px_80px_rgba(41,35,62,.25)]">
        <div className="bg-[#29233e] px-6 py-5 text-[#f7f0e3]">
          <div className="font-mono text-[10px] uppercase tracking-[.2em] text-[#e7ba68]">
            monopoly arena
          </div>
          <h2 className="mt-1 font-display text-2xl font-bold">
            Сайт в разработке
          </h2>
        </div>
        <form onSubmit={submit} className="p-6">
          <p className="text-sm leading-6 text-[#29233e]">
            Сайт находится в режиме тестирования.
            <br />
            Планируемая дата запуска —{" "}
            <b className="text-primary">Октябрь 2026 года</b>.
          </p>
          <p className="mt-3 text-xs text-[#716b78]">
            Если у вас есть пароль доступа — введите его ниже.
          </p>
          <label className="mt-5 block text-xs font-bold text-[#29233e]">
            Пароль
            <div className="relative mt-2">
              <input
                autoFocus
                type={showPw ? "text" : "password"}
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(""); }}
                placeholder="Введите пароль"
                className="w-full rounded-xl border border-[#d8ccba] bg-[#fffaf1] px-3.5 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#716b78] hover:text-[#29233e] transition-colors"
                tabIndex={-1}
                aria-label={showPw ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {error && (
            <div className="mt-3 rounded-lg bg-[#f6dfd7] px-3 py-2 text-xs font-medium text-primary">
              {error}
            </div>
          )}
          <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
            Войти на сайт <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  // Флаг «уже входил в приложение». Если нет — показываем лендинг,
  // если да — сразу игру (без повторного просмотра лендинга).
  // Google/Яндекс заходят без флага → видят лендинг → индексируют.
  const [entered, setEntered] = useState<boolean>(() => {
    try {
      return localStorage.getItem("arena-entered") === "1";
    } catch {
      return false;
    }
  });

  const handleEnter = () => {
    try {
      localStorage.setItem("arena-entered", "1");
    } catch {}
    setEntered(true);
  };

  // То же самое, но с сигналом для Home «открой окно авторизации».
  // Home смонтируется в новом рендере и сразу прочитает флаг.
  const handleEnterWithAuth = () => {
    try {
      localStorage.setItem("arena-open-auth", "1");
    } catch {}
    handleEnter();
  };

  // При каждом (пере)подключении сокета сообщаем серверу,
  // что мы всё ещё онлайн, чтобы он поставил нас в onlineUsers
  // и уведомил друзей. Нужно после рестарта сервера или долгого отсутствия.
  useEffect(() => {
    const handleConnect = () => {
      try {
        const raw = localStorage.getItem("arena-session-user");
        if (!raw || raw === "null") return;
        const u = JSON.parse(raw);
        if (u && u.id) {
          socket.emit('reconnect-session', { userId: u.id }, (res: any) => {
            if (!res?.success) return;
            console.log("♻️ Сессия восстановлена на сервере");

            // Синхронизируем localStorage свежими данными с сервера.
            // Иначе инвентарь/кошелёк/скины останутся старыми до следующего логина.
            const data = res.data || {};
            localStorage.setItem("arena-user-data-" + u.id, JSON.stringify(data));
            localStorage.setItem("arena-coins", String(data.coins || 2400));
            localStorage.setItem("arena-inventory", JSON.stringify(data.inventory || []));
            localStorage.setItem("arena-stats", JSON.stringify(data.stats || {}));
            if (data.vipUntil) {
              localStorage.setItem("arena-vip-until", data.vipUntil);
            } else {
              localStorage.removeItem("arena-vip-until");
            }
            if (data.activeSkins && typeof data.activeSkins === "object") {
              try {
                const current = JSON.parse(localStorage.getItem("arena-active-skins") || "{}");
                localStorage.setItem("arena-active-skins", JSON.stringify({
                  dice: current.dice || "none",
                  token: current.token || "none",
                  board: current.board || "none",
                  activeSkins: data.activeSkins,
                }));
              } catch {}
            }
          });
        }
      } catch {}
    };
    socket.on('connect', handleConnect);
    if (socket.connected) handleConnect();
    return () => {
      socket.off('connect', handleConnect);
    };
  }, []);

  useEffect(() => {
    const handleServerToken = (token: string) => {
      if (!token) return;
      const stored = sessionStorage.getItem("arena-server-token");
      if (stored && stored !== token) {
        // ВАЖНО: обновляем токен ДО reload, иначе после перезагрузки
        // снова будет несовпадение и страница уйдёт в бесконечный цикл.
        sessionStorage.setItem("arena-server-token", token);
        console.log("🔁 Сервер перезапущен. Жёсткая перезагрузка страницы…");
        fetch(window.location.href, { cache: "reload", mode: "no-cors" })
          .catch(() => {})
          .finally(() => {
            window.location.reload();
          });
        return;
      }
      sessionStorage.setItem("arena-server-token", token);
    };
    socket.on("server-start-token", handleServerToken);
    // На случай, если сервер уже успел отправить токен до монтирования
    socket.emit("get-server-start-token");
    return () => {
      socket.off("server-start-token", handleServerToken);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {entered ? (
          <AccessGate>
            <Home />
          </AccessGate>
        ) : (
          <Landing onEnter={handleEnter} onLogin={handleEnterWithAuth} />
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function MarketItemModal({ onClose, onSave, initialItem }: { onClose: () => void; onSave: (item: MarketItem) => void; initialItem?: MarketItem | null }) {
  const [name, setName] = useState(initialItem?.name || "");
  const [price, setPrice] = useState(String(initialItem?.price || 500));
  const [slot, setSlot] = useState(String(initialItem?.slotIndex || 1));
  const [rarity, setRarity] = useState<MarketItemRarity>(initialItem?.rarity || "common");
  const [image, setImage] = useState<string | undefined>(initialItem?.imageDataUrl);
  const [scale, setScale] = useState(initialItem?.scale || 1);
  const [caseId, setCaseId] = useState("");
  const [category, setCategory] = useState<MarketItemCategory>(initialItem?.category || "card");
  const [vipDays, setVipDays] = useState(String(initialItem?.vipDuration || 7));
  const [description, setDescription] = useState(initialItem?.description || "");
  const [bgColor, setBgColor] = useState(initialItem?.bgColor || "#d3a247");
    const [cardWidth, setCardWidth] = useState(String(initialItem?.cardWidth ?? CARD_SIZE_DEFAULTS.cardWidth));
  const [cardHeight, setCardHeight] = useState(String(initialItem?.cardHeight ?? CARD_SIZE_DEFAULTS.cardHeight));
  const [imageHeight, setImageHeight] = useState(String(initialItem?.imageHeight ?? CARD_SIZE_DEFAULTS.imageHeight));
  const [shopScale, setShopScale] = useState(String(initialItem?.shopScale ?? CARD_SIZE_DEFAULTS.shopScale));
  const slotNum = Number(slot) || 1;
  const dim = category === "card" ? getCellDimensions(slotNum) : null;
  const MAX_PREVIEW_SIZE = 130;
  const scaleRatio = dim ? Math.min(MAX_PREVIEW_SIZE / dim.hPx, MAX_PREVIEW_SIZE / dim.wPx) : 1;
  const previewW = dim ? dim.wPx * scaleRatio : 100;
  const previewH = dim ? dim.hPx * scaleRatio : 100;

  let stripDir = null;
  if (category === "card") {
    if (slotNum >= 1 && slotNum <= 9) stripDir = "top";
    else if (slotNum >= 11 && slotNum <= 19) stripDir = "right";
    else if (slotNum >= 21 && slotNum <= 29) stripDir = "bottom";
    else if (slotNum >= 31 && slotNum <= 39) stripDir = "left";
  }

  const groupColor = category === "card" ? (getCellGroup(slotNum)?.color || "#2563eb") : "#2563eb";

  const CELL_TYPES_LIST: CellType[] = [
    "property", "start", "chance", "tax", "challenge", "jail", "gotojail", "jackpot"
  ];
  const CELL_TYPE_LABELS: Record<CellType, string> = {
    property: "Собственность",
    start: "Старт",
    chance: "Шанс",
    tax: "Налог",
    challenge: "Испытание",
    jail: "Тюрьма",
    gotojail: "В тюрьму",
    jackpot: "Джекпот"
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const compressImage = (
      file: File,
      maxWidth: number,
      maxHeight: number,
    ): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);
            const hasAlpha = canvasHasTransparency(ctx!, width, height);
            let dataUrl = canvas.toDataURL("image/png");
            if (!hasAlpha && dataUrl.length > 150000) {
              dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            }
            resolve(dataUrl);
          };
          img.onerror = reject;
          img.src = ev.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };

    compressImage(file, 300, 300)
      .then((compressed) => setImage(compressed))
      .catch((err) => console.error("Ошибка сжатия картинки:", err));
  };

    const save = () => {
    if (!name.trim()) return;
    const newItem: MarketItem = {
      id: initialItem?.id || `КТП-${Math.floor(10000 + Math.random() * 90000)}`,
      name: name.trim(),
      category,
      slotIndex: category === "card" ? Number(slot) : undefined,
      vipDuration: category === "vip" ? Number(vipDays) || 7 : undefined,
      price: Number(price) || 100,
      rarity,
      imageDataUrl: image,
      scale,
      isActive: initialItem?.isActive ?? true,
      description: description.trim() || undefined,
      bgColor: category === "vip" ? bgColor : undefined,
      cardWidth: Number(cardWidth) || CARD_SIZE_DEFAULTS.cardWidth,
      cardHeight: Number(cardHeight) || CARD_SIZE_DEFAULTS.cardHeight,
      imageHeight: Number(imageHeight) || CARD_SIZE_DEFAULTS.imageHeight,
      shopScale: Number(shopScale) || CARD_SIZE_DEFAULTS.shopScale,
    };
    onSave(newItem);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#29233e]/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-card-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <h2 className="font-display text-2xl font-bold">{initialItem ? "Редактирование карточки" : "Новая карточка для рынка"}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <label className="text-xs font-bold">
  Название
  <input value={name} onChange={e => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
</label>
<label className="text-xs font-bold">
  Категория
  <select value={category} onChange={e => setCategory(e.target.value as MarketItemCategory)} className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm">
    <option value="card">Карточка поля</option>
    <option value="dice">Кубики</option>
    <option value="vip">VIP-статус</option>
  </select>
</label>
<label className="text-xs font-bold">
  Цена (Coins)
  <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
</label>
{category === "vip" && (
  <label className="text-xs font-bold">
    Дней VIP
    <input
      type="number"
      min="1"
      value={vipDays}
      onChange={e => setVipDays(e.target.value)}
      className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
    />
  </label>
)}
{category === "card" && (
  <label className="text-xs font-bold">
    Заменяет слот (0-39)
    <input type="number" min="0" max="39" value={slot} onChange={e => setSlot(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
  </label>
)}
<label className="text-xs font-bold">
  Редкость
  <select value={rarity} onChange={e => setRarity(e.target.value as MarketItemRarity)} className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm">
    <option value="common">Белый (обычный)</option>
    <option value="rare">Синий (редкий)</option>
    <option value="epic">Фиолетовый (супер-редкий)</option>
  </select>
</label>
<label className="text-xs font-bold">
  Описание
  <input
    value={description}
    onChange={e => setDescription(e.target.value)}
    placeholder="Например: VIP на 7 дней с бонусами"
    className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
  />
</label>
{category === "vip" && (
  <label className="text-xs font-bold">
    Цвет фона
    <input
      type="color"
      value={bgColor}
      onChange={e => setBgColor(e.target.value)}
      className="mt-2 h-10 w-full cursor-pointer rounded-xl border border-input bg-background p-1"
    />
  </label>
)}
<label className="text-xs font-bold">
  Кейс (название)
  <input value={caseId} onChange={e => setCaseId(e.target.value)} placeholder="Например: Классика" className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
</label>
        </div>

        {/* РАЗМЕРЫ КАРТОЧКИ В МАГАЗИНЕ / ИНВЕНТАРЕ / РЫНКЕ */}
        <div className="mt-4 rounded-xl border border-input bg-muted/40 p-3">
          <div className="mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
            📐 Размер карточки (магазин / инвентарь / рынок)
          </div>
          <div className="grid grid-cols-4 gap-3">
            <label className="text-xs font-bold">
              Ширина, px
              <input type="number" value={cardWidth} onChange={e => setCardWidth(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal" />
            </label>
            <label className="text-xs font-bold">
              Высота карточки, px
              <input type="number" value={cardHeight} onChange={e => setCardHeight(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal" />
            </label>
            <label className="text-xs font-bold">
              Высота картинки, px
              <input type="number" value={imageHeight} onChange={e => setImageHeight(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal" />
            </label>
            <label className="text-xs font-bold">
              Масштаб картинки, %
              <input type="number" value={shopScale} onChange={e => setShopScale(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal" />
            </label>
          </div>
        </div>

        <label className="mt-4 block text-xs font-bold">
          Изображение карточки (JPG / PNG / GIF)
          <div className="mt-2 flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-input px-4 py-2.5 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              <Upload size={14} /> Загрузить файл
              <input type="file" accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif" onChange={handleImageUpload} className="hidden" />
            </label>
            {image && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!image) return;
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement("canvas");
                      canvas.width = img.width;
                      canvas.height = img.height;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) return;
                      ctx.drawImage(img, 0, 0);
                      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
                      const px = data.data;
                      for (let i = 0; i < px.length; i += 4) {
                        if (px[i] > 240 && px[i + 1] > 240 && px[i + 2] > 240) {
                          px[i + 3] = 0;
                        }
                      }
                      ctx.putImageData(data, 0, 0);
                      setImage(canvas.toDataURL("image/png"));
                    };
                    img.src = image;
                  }}
                  className="rounded-lg bg-[#f3e7c8] px-3 py-1.5 text-[11px] font-bold text-[#7e5f1d] hover:brightness-95"
                  title="Все почти-белые пиксели станут прозрачными"
                >
                  🧹 Убрать белый фон
                </button>
                <button onClick={() => setImage(undefined)} className="text-xs text-primary underline">
                  удалить
                </button>
              </>
            )}
          </div>
        </label>

        {image && (
          <div className="mt-3">
            <div className="text-xs font-bold mb-1">Масштаб: {Math.round(scale * 100)}%</div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={scale}
              onChange={e => setScale(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        )}

                <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl border border-input px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted">
            Отмена
          </button>
          <button onClick={save} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">
  {initialItem ? "Сохранить изменения" : "Сохранить"}
</button>
        </div>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ ПРЕВЬЮ */}
      <div className="border-l border-border bg-muted/50 p-4 flex gap-4 overflow-auto">
        {/* ЛЕВОЕ ПРЕВЬЮ — как на игровом столе */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            Как на столе
          </div>
          {category === "card" ? (
            <div
              className="relative overflow-hidden rounded-sm shadow-md shrink-0"
              style={{
                width: previewW,
                height: previewH,
                backgroundColor: cellBgColor("property"),
              }}
            >
              {stripDir && (
                <div
                  style={{
                    position: "absolute",
                    top: stripDir === "top" ? 0 : stripDir === "bottom" ? undefined : 0,
                    bottom: stripDir === "bottom" ? 0 : undefined,
                    left: stripDir === "left" ? 0 : stripDir === "right" ? undefined : 0,
                    right: stripDir === "right" ? 0 : undefined,
                    height: stripDir === "top" || stripDir === "bottom" ? "18%" : "100%",
                    width: stripDir === "left" || stripDir === "right" ? "18%" : "100%",
                    backgroundColor: groupColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {Number(price) > 0 && (
                    <span
                      style={{
                        fontSize: stripDir === "top" || stripDir === "bottom" ? 18 : 15,
                        fontWeight: 800,
                        color: "#fff",
                        writingMode: stripDir === "left" || stripDir === "right" ? "vertical-rl" : undefined,
                        transform: stripDir === "left" ? "rotate(180deg)" : undefined,
                      }}
                    >
                      {Math.round(Number(price) / 1000)}k
                    </span>
                  )}
                </div>
              )}
              <div
                style={{
                  position: "absolute",
                  top: stripDir === "top" ? "18%" : 0,
                  bottom: stripDir === "bottom" ? "18%" : 0,
                  left: stripDir === "left" ? "18%" : 0,
                  right: stripDir === "right" ? "18%" : 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {image ? (
                  <img
                    src={image}
                    alt=""
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      width: "auto",
                      height: "auto",
                      objectFit: "contain",
                      transform: `scale(${scale})`,
                      transformOrigin: "center center",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 36 }}>
                    {CELL_LOGOS[slotNum] ?? SPECIAL_ICONS["property"] ?? "❓"}
                  </div>
                )}
              </div>
            </div>
          ) : category === "dice" ? (
            <div className="flex flex-col items-center">
              {image ? (
                <img src={image} alt="preview" className="h-20 w-20 object-contain" />
              ) : (
                <div className="text-4xl" style={{ color: "#e96852" }}>🎲</div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center w-full">
              <div
                className="flex h-32 w-full items-center justify-center overflow-hidden rounded-xl"
                style={{ backgroundColor: bgColor }}
              >
                {image ? (
                  <img src={image} alt="preview" className="h-full w-full object-contain p-2" />
                ) : (
                  <Crown size={48} style={{ color: bgColor }} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ПРАВОЕ ПРЕВЬЮ — как в магазине (полная карточка с ценой и кнопкой) */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            Как в магазине
          </div>
          <div
            className="flex flex-col rounded-2xl border border-card-border bg-card shadow-sm overflow-hidden shrink-0"
            style={{
              width: `${Number(cardWidth) || CARD_SIZE_DEFAULTS.cardWidth}px`,
            }}
          >
            <div
              className="relative flex items-center justify-center overflow-hidden"
              style={{
                height: `${Number(imageHeight) || CARD_SIZE_DEFAULTS.imageHeight}px`,
                backgroundColor: category === "vip" ? bgColor : "#fdfaf5",
              }}
            >
              {image ? (
                <img
                  src={image}
                  alt=""
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                    transform: `scale(${(Number(shopScale) || 90) / 100})`,
                    transformOrigin: "center center",
                  }}
                />
              ) : (
                <div className="text-3xl">❓</div>
              )}
              <div
                className="absolute bottom-0 left-0 right-0 h-1"
                style={{
                  backgroundColor:
                    rarity === "common" ? "#b0b0b0" :
                    rarity === "rare" ? "#2563eb" :
                    rarity === "epic" ? "#9b5de5" : "#b0b0b0",
                }}
              />
            </div>
            <div className="p-4 flex flex-col gap-2 flex-1">
              <div>
                <h3 className="font-display text-lg font-bold">{name || "Название"}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {category === "card" ? `Заменяет слот: ${slotNum} · ${rarity}` :
                   category === "dice" ? `Кубики · ${rarity}` :
                   `VIP на ${vipDays} дней`}
                </p>
              </div>
              <div className="mt-auto flex items-center justify-between pt-2 border-t border-border">
                <span className="flex items-center gap-1.5 font-mono text-sm font-bold">
                  <Coins size={15} className="text-[#b18428]" />
                  {price}
                </span>
                <button className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground">
                  Купить
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default App;
