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
} from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient();

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
  jailTurns?: number;
  jailAttempts?: number;
};
type ChatMessage = {
  from: string;
  text: string;
  time: string;
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
};
type OwnedItem = GameItem & { ownedAt: string };
type Listing = {
  id: string;
  item: GameItem;
  seller: string;
  sellerId: string;
  price: number;
};
type AuthUser = {
  id: string;
  login?: string;
  password?: string;
  name: string;
  initials: string;
  color: string;
  guest?: boolean;
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
type CaseDesign = { id: string; name: string; rarity: string; items: string[] };
type LobbyMode = "Классический" | "2×2" | "3×3";
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
  noRent: boolean;
  password?: string;
  started?: boolean;
  createdAt?: number;
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

const RENT_MULTIPLIERS = [1, 5, 10, 15, 25, 40];
const IMPROVE_LABELS = [
  "",
  "Филиал ★",
  "Филиал ★★",
  "Филиал ★★★",
  "Филиал ★★★★",
  "Отель 🏨",
];

const roundTo10 = (val: number) => Math.round(val / 10) * 10;

const getMortgage = (cellIdx: number) => {
  const basePrice = boardCells[cellIdx].price ?? 0;
  return roundTo10(basePrice * 0.6);
};
const getRedeemCost = (cellIdx: number) => {
  const mortgage = getMortgage(cellIdx);
  return roundTo10(mortgage * 1.15);
};
const getImproveCost = (cellIdx: number) => {
  const g = GROUPS.findIndex((gr) =>
    (gr.cells as readonly number[]).includes(cellIdx),
  );
  return g >= 0 ? (g + 1) * 400 : 0;
};
const getGroupIdx = (cellIdx: number) =>
  GROUPS.findIndex((gr) => (gr.cells as readonly number[]).includes(cellIdx));

const CHANCE_EVENTS_DATA = [
  {
    desc: "Все игроки поздравили тебя с днём рождения — по 500 К с каждого!",
    kind: "birthday" as const,
    amount: 500,
  },
  {
    desc: "Удачная биржевая сделка! Получи 2 000 К",
    kind: "gain" as const,
    amount: 2000,
  },
  {
    desc: "Налоговая проверка — штраф 1 500 К",
    kind: "lose" as const,
    amount: 1500,
  },
  {
    desc: "Дивиденды от акций — +1 200 К",
    kind: "gain" as const,
    amount: 1200,
  },
  {
    desc: "Авария — ремонт авто обошёлся в 800 К",
    kind: "lose" as const,
    amount: 800,
  },
  {
    desc: "Коллеги скинулись — бонус +1 000 К",
    kind: "gain" as const,
    amount: 1000,
  },
  {
    desc: "Штраф за нарушение ПДД — 600 К",
    kind: "lose" as const,
    amount: 600,
  },
  {
    desc: "Успешный стартап принёс инвесторам прибыль! +2 500 К",
    kind: "gain" as const,
    amount: 2500,
  },
  {
    desc: "Игрок должен заплатить за каждый свой филиал и отель по 500 К!",
    kind: "hotels" as const,
    amount: 500,
  },
] as const;

const CHALLENGE_EVENTS_DATA = [
  { desc: "Рывок вперёд! Перемещаешься на 3 поля.", steps: 3, forward: true },
  { desc: "Неудача — откат на 2 поля.", steps: 2, forward: false },
  { desc: "Попутный ветер — 5 полей вперёд!", steps: 5, forward: true },
  { desc: "Задержка в пути — 4 поля назад.", steps: 4, forward: false },
  { desc: "Скоростной старт — 6 полей вперёд!", steps: 6, forward: true },
  { desc: "Крюк по городу — 3 поля назад.", steps: 3, forward: false },
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

const getCellGroup = (idx: number) =>
  GROUPS.find((g) => (g.cells as readonly number[]).includes(idx)) ?? null;

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
    name: "Лада Север",
    initials: "ЛС",
    color: PLAYER_COLORS[0],
    money: 15000,
    position: 0,
    jailTurns: 0,
    jailAttempts: 0,
  },
  ];

const seedFriends = [
  {
    id: "MA-8724",
    name: "Макс Волков",
    initials: "МВ",
    color: "#32786d",
    online: true,
    status: "В комнате «Пятничный клуб»",
  },
  {
    id: "MA-1108",
    name: "Вика Рэй",
    initials: "ВР",
    color: "#d3a247",
    online: true,
    status: "Свободна для игры",
  },
  {
    id: "MA-3901",
    name: "Рома К.",
    initials: "РК",
    color: "#6b5b93",
    online: false,
    status: "Был в сети 24 Кин назад",
  },
  {
    id: "MA-6612",
    name: "Саша Лис",
    initials: "СЛ",
    color: "#aa6850",
    online: true,
    status: "В Кагазине",
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

const seedLobbyRooms: LobbyRoom[] = [
  {
    id: "#A7F3D",
    name: "Пятничный клуб",
    host: "Макс Волков",
    hostId: "max",
    players: 3,
    maxPlayers: 4,
    mode: "Классический",
    jackpot: true,
    teleport: true,
    noRent: false,
    createdAt: Date.now(),
  },
  {
    id: "#B2K8Q",
    name: "Только свои",
    host: "Лада Север",
    hostId: "you",
    players: 2,
    maxPlayers: 4,
    mode: "2×2",
    jackpot: true,
    teleport: false,
    noRent: false,
    password: "club",
  },
  {
    id: "#C9M1R",
    name: "Большая Косква",
    host: "Илья Н.",
    hostId: "ilya",
    players: 5,
    maxPlayers: 6,
    mode: "3×3",
    jackpot: true,
    teleport: true,
    noRent: false,
  },
  {
    id: "#D4V6T",
    name: "После полуночи",
    host: "Саша Лис",
    hostId: "sasha",
    players: 1,
    maxPlayers: 4,
    mode: "Классический",
    jackpot: false,
    teleport: true,
    noRent: true,
    password: "night",
  },
];

const seedGlobalChat: GlobalChatMessage[] = [
  {
    nickname: "Макс Волков",
    text: "Сегодня забираю Арбат. Не обижайся.",
    timestamp: "2026-08-08T20:41:00.000Z",
  },
  {
    nickname: "Лада Север",
    text: "Сначала догони.",
    timestamp: "2026-08-08T20:43:00.000Z",
  },
];

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
}: {
  initials: string;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-xs",
    lg: "h-16 w-16 text-lg",
  };
  return (
    <div
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm`}
      style={{ backgroundColor: color }}
    >
      {initials}
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

function Dashboard({
  onTab,
  onJoinGame,
  onRequestCreate,
  onRequestFind,
  createOpen,
  findOpen,
  onCloseCreate,
  onCloseFind,
  playerName,
  isAdmin = false, // <--- Добавить эту строку
}: {
  onTab: (tab: Tab) => void;
  onJoinGame: () => void;
  onRequestCreate: () => void;
  onRequestFind: () => void;
  createOpen: boolean;
  findOpen: boolean;
  onCloseCreate: () => void;
  onCloseFind: () => void;
  playerName?: string;
  isAdmin?: boolean; // <--- Добавить эту строку
}) {
  const [rooms, setRooms] = useLocalStorage<LobbyRoom[]>(
    "arena-lobby-rooms",
    seedLobbyRooms,
  );
  const [chat, setChat] = useLocalStorage<GlobalChatMessage[]>(
    "global_chat_messages",
    seedGlobalChat,
  );
  const [isSpinning, setIsSpinning] = useState(false);
  const [jailPaymentPending, setJailPaymentPending] = useState(false);
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
  const [createNoRent, setCreateNoRent] = useState(false);
  const [createPassword, setCreatePassword] = useState("");
  const [findMode, setFindMode] = useState<"Все" | LobbyMode>("Все");
  const [findNotice, setFindNotice] = useState("");
  const [lobbyDeletedNotice, setLobbyDeletedNotice] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  const friends = seedFriends.filter((friend) =>
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
      room.noRent && "Без аренды",
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
      setCreateNoRent(false);
      setCreatePassword("");
    }
  }, [createOpen, playerName]);

  const createRoom = (event: FormEvent) => {
    event.preventDefault();
    const mode = createMode;
    const maxPlayers =
      mode === "2×2"
        ? 4
        : mode === "3×3"
          ? 6
          : Math.min(5, Math.max(2, createPlayers));
    const room: LobbyRoom = {
      id: `#${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      name: createName.trim() || `Комната ${playerName || "Игрока"}`,
      host: playerName || "Гость клуба",
      hostId: playerName || "guest",
      players: 1,
      maxPlayers,
      mode,
      jackpot: createJackpot,
      teleport: createTeleport,
      noRent: createNoRent,
      password: createPassword.trim() || undefined,
      createdAt: Date.now(),
    };
    setRooms([room, ...rooms]);
    // Сохраняем выбранное количество игроков в локальное хранилище
    localStorage.setItem("arena-lobby-maxPlayers", String(maxPlayers));
    setNotice(`Комната «${room.name}» создана. Код ${room.id}`);
    onCloseCreate();
  };

  const joinRoom = (room: LobbyRoom, password = "") => {
    if (room.password && room.password !== password) {
      setNotice("Неверный пароль комнаты.");
      return;
    }
    if (room.players >= room.maxPlayers) {
      setNotice("В этой комнате уже нет свободных Кест.");
      return;
    }
    const newRooms = rooms.map((item) =>
      item.id === room.id ? { ...item, players: item.players + 1 } : item,
    );
    setRooms(newRooms);
    setJoinTarget(null);
    setJoinPassword("");

    const updatedRoom = newRooms.find((r) => r.id === room.id);
    if (updatedRoom && updatedRoom.players >= updatedRoom.maxPlayers) {
      setNotice(`🚀 Комната заполнена! Игра начинается.`);
      onJoinGame();
    } else {
      setNotice(
        `Ты присоединился к «${room.name}». Ожидаем игроков... (${updatedRoom?.players}/${updatedRoom?.maxPlayers})`,
      );
    }
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
    setChat([
      ...chat,
      {
        nickname: playerName || "Гость клуба",
        text: chatText.trim(),
        timestamp: new Date().toISOString(),
      },
    ]);
    setChatText("");
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
                <h2 className="font-display text-xl font-bold">Комнаты</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {rooms.length} открытых столов
                </p>
              </div>
              <ArrowRight size={16} className="text-primary" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-muted p-2.5">
                <div className="font-mono text-lg font-bold">
                  {rooms.length}
                </div>
                <div className="text-[9px] text-muted-foreground">столов</div>
              </div>
              <div className="rounded-xl bg-muted p-2.5">
                <div className="font-mono text-lg font-bold">
                  {rooms.filter((r) => r.players < r.maxPlayers).length}
                </div>
                <div className="text-[9px] text-muted-foreground">
                  с местами
                </div>
              </div>
              <div className="rounded-xl bg-muted p-2.5">
                <div className="font-mono text-lg font-bold">47</div>
                <div className="text-[9px] text-muted-foreground">
                  мин партия
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-card-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary" />
              <h2 className="font-display text-xl font-bold">Друзья</h2>
            </div>
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
            <div className="mt-3 space-y-1">
              {friends.slice(0, 4).map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted"
                >
                  <div className="relative">
                    <Avatar initials={f.initials} color={f.color} size="sm" />
                    <span
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card ${f.online ? "bg-accent" : "bg-muted-foreground/40"}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold">{f.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {f.online ? "В сети" : "Не в сети"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-card-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">
                Последние события
              </h2>
              <Bell size={15} className="text-muted-foreground" />
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["МВ", "Макс Волков", "отправил приглашение", "#32786d"],
                ["ВР", "Вика Рэй", "открыла кейс «Классика»", "#d3a247"],
                ["РК", "Рома К.", "поднялся на 2 уровня", "#6b5b93"],
              ].map(([initials, name, ev, color]) => (
                <div key={name} className="flex items-center gap-2">
                  <Avatar initials={initials} color={color} size="sm" />
                  <div className="min-w-0 text-[11px]">
                    <div className="truncate">
                      <b>{name}</b> {ev}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      недавно
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* === ПЕРЕНЕСЕННЫЙ ЧАТ === */}
          <div className="rounded-2xl border border-card-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <MessageCircle size={17} className="text-primary" />
                  <h2 className="font-display text-xl font-bold">Чат</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Общий разговор для всех игроков на главной.
                </p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[10px]">
                {chat.length} сообщений
              </span>
            </div>
            <div className="grid max-h-[300px] gap-3 overflow-auto py-4 sm:grid-cols-2">
              {chat.map((message, index) => (
                <div
                  key={`${message.timestamp}-${index}`}
                  className={`flex gap-2 ${message.nickname === playerName ? "sm:col-start-2 sm:justify-end" : ""}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 ${message.nickname === playerName ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted"}`}
                  >
                    <div className="text-[11px] font-bold">
                      {message.nickname}
                    </div>
                    <div className="mt-1 text-xs">{message.text}</div>
                    <div
                      className={`mt-1 text-[9px] ${message.nickname === playerName ? "text-white/60" : "text-muted-foreground"}`}
                    >
                      {formatChatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form
              onSubmit={sendGlobalChat}
              className="flex items-end gap-2 border-t border-border pt-4"
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
                  // Shift+Enter = перенос строки, Enter = отправка
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
                className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none resize-none overflow-hidden focus:ring-2 focus:ring-primary/30 min-h-[44px] max-h-[120px]"
              />
              <button
                type="submit"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:brightness-95"
              >
                <Send size={17} />
              </button>
            </form>
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
            <div className="relative min-w-0 flex-1">
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
            <select
              value={roomMode}
              onChange={(ev) =>
                setRoomMode(ev.target.value as "Все" | LobbyMode)
              }
              className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none"
            >
              <option>Все</option>
              <option>Классический</option>
              <option>2×2</option>
              <option>3×3</option>
            </select>
            <button
              onClick={onRequestCreate}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
            >
              <Plus size={15} /> Создать
            </button>
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
                  </div>
                  <div className="flex items-center gap-2">
                    {(isAdmin || room.hostId === playerName) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Удалить лобби "${room.name}"?`)) {
                            setRooms((prev) =>
                              prev.filter((r) => r.id !== room.id),
                            );
                          }
                        }}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
                        title={
                          isAdmin
                            ? "Удалить лобби (Админ)"
                            : "Удалить мое лобби"
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
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
              </div>
            )}
          </div>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#29233e]/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={createRoom}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-auto rounded-2xl border border-card-border bg-card p-6 shadow-2xl"
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
              <label className="text-xs font-bold">
                Режим игры
                <select
                  value={createMode}
                  onChange={(event) =>
                    setCreateMode(event.target.value as LobbyMode)
                  }
                  className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
                >
                  <option>Классический</option>
                  <option>2×2</option>
                  <option>3×3</option>
                </select>
              </label>
              <label className="text-xs font-bold">
                Количество игроков
                <select
                  value={createPlayers}
                  onChange={(event) =>
                    setCreatePlayers(Number(event.target.value))
                  }
                  disabled={createMode !== "Классический"}
                  className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal disabled:opacity-50"
                >
                  {[2, 3, 4, 5].map((count) => (
                    <option key={count} value={count}>
                      {count} игрока
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5">
              <div className="text-xs font-bold">Бонусы стола</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["jackpot", "Джекпот", createJackpot, setCreateJackpot],
                    ["teleport", "Телепорт", createTeleport, setCreateTeleport],
                    ["noRent", "Без аренды", createNoRent, setCreateNoRent],
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
              <input
                type="password"
                value={createPassword}
                onChange={(event) => setCreatePassword(event.target.value)}
                placeholder="Оставь пустым для открытой комнаты"
                className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
              />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#29233e]/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={findGame}
            className="w-full max-w-md rounded-2xl border border-card-border bg-card p-6 shadow-2xl"
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
              {(["Все", "Классический", "2×2", "3×3"] as const).map((mode) => (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#29233e]/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              joinRoom(joinTarget, joinPassword);
            }}
            className="w-full max-w-sm rounded-2xl border border-card-border bg-card p-6 shadow-2xl"
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
      host: "Лада Север",
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
          <option>3 × 3</option>
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

function ChatPanel({ title = "Чат клуба" }: { title?: string }) {
  const [friends] = useLocalStorage("arena-friends", seedFriends);
  const [recipient, setRecipient] = useState("all");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>("arena-chat", [
    {
      from: "Макс Волков",
      text: "Сегодня забираю Арбат. Не обижайся.",
      time: "20:41",
      recipient: "all",
    },
    {
      from: "Лада Север",
      text: "Сначала догони.",
      time: "20:43",
      recipient: "all",
    },
  ]);
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setMessages([
      ...messages,
      {
        from: "Лада Север",
        text: message.trim(),
        time: new Date().toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        recipient,
      },
    ]);
    setMessage("");
  };
  return (
    <div className="flex min-h-[440px] flex-col rounded-2xl border border-card-border bg-card p-5">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <MessageCircle size={17} className="text-primary" />
          <h2 className="font-display text-xl font-bold">{title}</h2>
        </div>
        <select
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="max-w-[125px] rounded-lg border border-input bg-background px-2 py-1.5 text-[11px]"
        >
          <option value="all">Всем игрокам</option>
          {friends.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 space-y-3 overflow-auto py-5">
        {messages.map((m, i) => (
          <div
            key={`${m.time}-${i}`}
            className={`flex ${m.from === "Лада Север" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${m.from === "Лада Север" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"}`}
            >
              <div>{m.text}</div>
              <div
                className={`mt-1 text-[9px] ${m.from === "Лада Север" ? "text-white/65" : "text-muted-foreground"}`}
              >
                {m.time}
                {m.recipient !== "all" && " · лично"}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-border pt-4">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Напиши что-нибудь..."
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

function Friends() {
  const [friends] = useLocalStorage("arena-friends", seedFriends);
  const [search, setSearch] = useState("");
  const matches = friends.filter((f) =>
    `${f.name} ${f.id}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="animate-rise">
      <SectionHeading
        eyebrow="социальный клуб"
        title="Друзья"
        detail="Собери состав, который знает твои слабые Кеста."
      />
      <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ID или никнейм игрока"
              className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="mt-5 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Твои игроки</h2>
            <span className="rounded-full bg-muted px-2 py-1 font-mono text-[10px]">
              {friends.length} / 50
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {matches.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-muted"
              >
                <div className="relative">
                  <Avatar
                    initials={friend.initials}
                    color={friend.color}
                    size="sm"
                  />
                  {friend.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-accent" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <b className="truncate text-sm">{friend.name}</b>
                    <MessageCircle
                      size={16}
                      className="text-muted-foreground"
                    />
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {friend.id} · {friend.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setSearch("MA-")}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-input py-3 text-xs font-bold text-primary"
          >
            <Plus size={15} /> Добавить по ID
          </button>
        </div>
        <ChatPanel title="Чат лобби" />
      </div>
    </div>
  );
}

function Shop() {
  const [coins, setCoins] = useLocalStorage("arena-coins", 2400);
  const [inventory, setInventory] = useLocalStorage<OwnedItem[]>(
    "arena-inventory",
    seedInventory,
  );
  const [section, setSection] = useState<"cases" | "skins">("cases");
  const [notice, setNotice] = useState("");
  const cases = [
    {
      name: "Классика",
      desc: "Случайный токен или кубики",
      price: 300,
      color: "#e96852",
      icon: Package,
    },
    {
      name: "Ночной рейс",
      desc: "Редкий городской предмет",
      price: 650,
      color: "#5d4c83",
      icon: Gift,
    },
    {
      name: "Большая ставка",
      desc: "Шанс на легендарный предмет",
      price: 1200,
      color: "#d3a247",
      icon: Crown,
    },
  ];
  const buySkin = (item: GameItem) => {
    if (coins < item.price) {
      setNotice("Не хватает Coins — загляни в ежедневный бонус.");
      return;
    }
    setCoins(coins - item.price);
    setInventory([
      ...inventory,
      {
        ...item,
        id: `${item.id}-${Date.now()}`,
        ownedAt: new Date().toISOString(),
      },
    ]);
    setNotice(`«${item.name}» добавлен в инвентарь.`);
  };
  const buyCase = (name: string, price: number) => {
    if (coins < price) {
      setNotice("Не хватает Coins — загляни в ежедневный бонус.");
      return;
    }
    const drop = shopSkins[Math.floor(Math.random() * shopSkins.length)];
    setCoins(coins - price);
    setInventory([
      ...inventory,
      {
        ...drop,
        id: `${drop.id}-${Date.now()}`,
        ownedAt: new Date().toISOString(),
      },
    ]);
    setNotice(`Кейс «${name}» открыт: получен предмет «${drop.name}».`);
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
      <div className="mb-5 flex gap-2 rounded-xl bg-muted p-1 w-fit">
        <button
          onClick={() => setSection("cases")}
          className={`rounded-lg px-4 py-2 text-xs font-bold ${section === "cases" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
        >
          Кейсы
        </button>
        <button
          onClick={() => setSection("skins")}
          className={`rounded-lg px-4 py-2 text-xs font-bold ${section === "skins" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
        >
          Прямые скины
        </button>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {section === "cases"
          ? cases.map((product) => {
              const Icon = product.icon;
              return (
                <div
                  key={product.name}
                  className="lift overflow-hidden rounded-2xl border border-card-border bg-card"
                >
                  <div
                    className="relative flex h-44 items-center justify-center overflow-hidden"
                    style={{ backgroundColor: product.color }}
                  >
                    <div className="absolute h-36 w-36 rounded-full border border-white/20"></div>
                    <div className="absolute h-24 w-24 rounded-full border border-white/20"></div>
                    <Icon size={48} className="relative text-white/90" />
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-xl font-bold">
                      {product.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {product.desc}
                    </p>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-mono text-sm font-bold">
                        <Coins size={15} className="text-[#b18428]" />
                        {product.price}
                      </span>
                      <button
                        onClick={() => buyCase(product.name, product.price)}
                        className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground"
                      >
                        Открыть кейс
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          : shopSkins.map((product) => (
              <div
                key={product.id}
                className="lift overflow-hidden rounded-2xl border border-card-border bg-card"
              >
                <div
                  className="flex h-36 items-center justify-center"
                  style={{ backgroundColor: product.color }}
                >
                  <div className="rounded-2xl border border-white/30 p-5 text-white">
                    <Dice5 size={36} />
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-bold">
                      {product.name}
                    </h3>
                    <span className="text-[10px] font-bold uppercase text-primary">
                      {product.rarity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {product.description}
                  </p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-sm font-bold">
                      <Coins size={15} className="text-[#b18428]" />
                      {product.price}
                    </span>
                    <button
                      onClick={() => buySkin(product)}
                      className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground"
                    >
                      Купить
                    </button>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

function Inventory({ onMarket }: { onMarket: () => void }) {
  const [inventory, setInventory] = useLocalStorage<OwnedItem[]>(
    "arena-inventory",
    seedInventory,
  );
  const [active, setActive] = useLocalStorage<Record<ItemType, string>>(
    "arena-active-skins",
    { dice: "none", token: "none", board: "none" },
  );
  const [notice, setNotice] = useState("");
  const apply = (item: OwnedItem) => {
    setActive({ ...active, [item.type]: item.id });
    setNotice(`«${item.name}» применён для следующих партий.`);
  };
  return (
    <div className="animate-rise">
      <SectionHeading
        eyebrow="твоя коллекция"
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
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-card-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Всего предметов</div>
          <div className="mt-1 font-mono text-2xl font-bold">
            {inventory.length}
          </div>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Активных</div>
          <div className="mt-1 font-mono text-2xl font-bold">
            {Object.values(active).filter((v) => v !== "none").length}
          </div>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Можно выставить</div>
          <div className="mt-1 font-mono text-2xl font-bold">
            {inventory.length}
          </div>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {inventory.map((item) => (
          <div
            key={item.id}
            className="lift overflow-hidden rounded-2xl border border-card-border bg-card"
          >
            <div
              className="flex h-32 items-center justify-center"
              style={{ backgroundColor: item.color }}
            >
              <div className="rounded-xl border border-white/30 p-4 text-white">
                <Dice5 size={32} />
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold">{item.name}</h3>
                {active[item.type] === item.id && (
                  <span className="rounded-full bg-[#dceae3] px-2 py-1 text-[10px] font-bold text-accent">
                    Активен
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.description}
              </p>
              <button
                onClick={() => apply(item)}
                className="mt-4 w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground"
              >
                {active[item.type] === item.id ? "Применён" : "Применить"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {inventory.length === 0 && (
        <div className="rounded-2xl border border-dashed border-card-border bg-card p-12 text-center">
          <Package size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 font-bold">Инвентарь пока пуст</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Загляни в Кагазин и открой первый кейс.
          </p>
        </div>
      )}
    </div>
  );
}

function Market() {
  const [coins, setCoins] = useLocalStorage("arena-coins", 2400);
  const [inventory, setInventory] = useLocalStorage<OwnedItem[]>(
    "arena-inventory",
    seedInventory,
  );
  const [listings, setListings] = useLocalStorage<Listing[]>(
    "arena-market",
    seedListings,
  );
  const [filter, setFilter] = useState<"all" | ItemType>("all");
  const [selected, setSelected] = useState("");
  const [price, setPrice] = useState("500");
  const [notice, setNotice] = useState("");
  const visible = listings.filter(
    (l) => filter === "all" || l.item.type === filter,
  );
  const typeName = (type: ItemType) =>
    type === "dice" ? "Кубики" : type === "token" ? "Фишки" : "Темы поля";
  const sell = (e: FormEvent) => {
    e.preventDefault();
    const item = inventory.find((i) => i.id === selected);
    const amount = Number(price);
    if (!item || !Number.isFinite(amount) || amount < 1) return;
    setListings([
      ...listings,
      {
        id: `listing-${Date.now()}`,
        item,
        seller: "Лада Север",
        sellerId: "you",
        price: amount,
      },
    ]);
    setInventory(inventory.filter((i) => i.id !== selected));
    setSelected("");
    setNotice(`«${item.name}» выставлен на рынке.`);
  };
  const buy = (listing: Listing) => {
    if (listing.sellerId === "you") return;
    if (coins < listing.price) {
      setNotice("Недостаточно Coins для этой сделки.");
      return;
    }
    setCoins(coins - listing.price);
    setInventory([
      ...inventory,
      {
        ...listing.item,
        id: `${listing.item.id}-${Date.now()}`,
        ownedAt: new Date().toISOString(),
      },
    ]);
    setListings(listings.filter((l) => l.id !== listing.id));
    setNotice(`Покупка завершена: «${listing.item.name}» в инвентаре.`);
  };
  return (
    <div className="animate-rise">
      <SectionHeading
        eyebrow="обмен клуба"
        title="Рынок"
        detail="Продавай предметы из коллекции и находи редкие скины."
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
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((listing) => (
              <div
                key={listing.id}
                className="lift rounded-2xl border border-card-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-xl"
                    style={{ backgroundColor: listing.item.color }}
                  >
                    <Dice5 size={27} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold">{listing.item.name}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {typeName(listing.item.type)} · {listing.item.rarity}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Продавец: {listing.seller}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="flex items-center gap-1 font-mono text-sm font-bold">
                    <Coins size={14} className="text-[#b18428]" />
                    {listing.price}
                  </span>
                  {listing.sellerId === "you" ? (
                    <span className="text-xs font-bold text-muted-foreground">
                      Твоё объявление
                    </span>
                  ) : (
                    <button
                      onClick={() => buy(listing)}
                      className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground"
                    >
                      Купить
                    </button>
                  )}
                </div>
              </div>
            ))}
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

function Profile({ onInventory }: { onInventory: () => void }) {
  const [name, setName] = useLocalStorage("arena-nickname", "Лада Север");
  const [saved, setSaved] = useState(false);
  const [inventory] = useLocalStorage<OwnedItem[]>(
    "arena-inventory",
    seedInventory,
  );
  const save = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  return (
    <div className="animate-rise">
      <SectionHeading
        eyebrow="карточка игрока"
        title="Профиль"
        detail="Твоя история, титул и коллекция на виду."
      />
      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-2xl bg-[#29233e] p-6 text-[#f7f0e3]">
          <div className="flex items-center gap-4">
            <Avatar initials="ЛС" color="#e96852" size="lg" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[.2em] text-[#e7ba68]">
                MA-4821
              </div>
              <h2 className="mt-1 font-display text-2xl font-bold">{name}</h2>
              <div className="mt-1 text-xs text-[#bbb4c5]">
                Доминант · уровень 12
              </div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3 border-t border-white/10 pt-5 text-center">
            <div>
              <div className="font-mono text-xl font-bold">27</div>
              <div className="text-[10px] text-[#aaa2b4]">побед</div>
            </div>
            <div>
              <div className="font-mono text-xl font-bold">68%</div>
              <div className="text-[10px] text-[#aaa2b4]">винрейт</div>
            </div>
            <div>
              <div className="font-mono text-xl font-bold">19 ч</div>
              <div className="text-[10px] text-[#aaa2b4]">на арене</div>
            </div>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-[11px]">
              <span>Прогресс уровня</span>
              <span className="font-mono text-[#e7ba68]">760 / 1 000 XP</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[76%] rounded-full bg-[#e7ba68]" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Настройки игрока</h2>
            <button
              onClick={onInventory}
              className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-bold"
            >
              <Package size={14} /> Инвентарь · {inventory.length}
            </button>
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
                <Hash size={15} /> MA-4821
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

function BoardGame({ onExit }: { onExit: () => void }) {
  const [settings] = useLocalStorage<AdminSettings>(
    "arena-admin-settings",
    defaultSettings,
  );
  const [cardDesigns] = useLocalStorage<CardDesign[]>("arena-card-designs", []);
  const [players, setPlayers] = useState<Player[]>(() => {
    // 1. Определяем, сколько игроков должно быть (из лобби, по умолчанию 4)
    let maxPlayers = 4;
    try {
      const savedMax = localStorage.getItem("arena-lobby-maxPlayers");
      if (savedMax) {
        const parsed = parseInt(savedMax, 10);
        if (parsed >= 2 && parsed <= 6) maxPlayers = parsed;
      }
    } catch {
      /* ignore */
    }

    // 2. Определяем текущего игрока (как и было в старом коде)
    let me: { name: string; initials: string; color: string } = {
      name: "Лада Север",
      initials: "ЛС",
      color: "#e96852",
    };
    try {
      const stored = localStorage.getItem("arena-session-user");
      if (stored) {
        const u = JSON.parse(stored) as AuthUser;
        if (u?.name) {
          const parts = u.name.trim().split(/\s+/);
          const initials = parts
            .slice(0, 2)
            .map((p: string) => p[0])
            .join("")
            .toUpperCase();
          me = {
            name: u.name,
            initials: u.initials || initials,
            color: PLAYER_COLORS[0],
          };
        }
      } else {
        const nickname = localStorage.getItem("arena-nickname");
        if (nickname) {
          const parts = nickname.trim().split(/\s+/);
          const initials = parts
            .slice(0, 2)
            .map((p: string) => p[0])
            .join("")
            .toUpperCase();
          me = { name: nickname, initials, color: PLAYER_COLORS[0] };
        }
      }
    } catch {
      /* ignore */
    }

    // Функция перемешивания Кассива (Фишер-Йетс)
    function shuffleArray<T>(array: T[]): T[] {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    // 3. Берем нужное количество игроков, применяем данные и перемешиваем
    const playersArray = initialPlayers
      .slice(0, maxPlayers)
      .map((p) =>
        p.id === "you"
          ? { ...p, ...me, money: settings.startCapital, position: 0 }
          : { ...p, money: settings.startCapital, position: 0 },
      );
    // Возвращаем перемешанный Кассив (первый игрок в Кассиве будет ходить первым)
    return shuffleArray(playersArray);
  });
  const [turn, setTurn] = useState(0);
  const [mortgages, setMortgages] = useState<Record<number, number>>({});
  const [globalTurnCounter, setGlobalTurnCounter] = useState(0);
  const getRent = (cellIdx: number, impr: Record<number, number>) => {
    if (
      mortgages[cellIdx] !== undefined &&
      mortgages[cellIdx] > globalTurnCounter
    ) {
      return 0;
    }
    return Math.floor(
      (boardCells[cellIdx].rent ?? 0) *
        RENT_MULTIPLIERS[Math.min(impr[cellIdx] ?? 0, 5)],
    );
  };

  const [dice, setDice] = useState<[number, number]>([2, 3]);
  const [targetDice, setTargetDice] = useState<[number, number]>([2, 3]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  const [rolled, setRolled] = useState(false);
  const [owners, setOwners] = useState<Record<number, string>>({});
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
  const [animStep, setAnimStep] = useState(0);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [selectedPos, setSelectedPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [jailPaymentPending, setJailPaymentPending] = useState(false);
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
  const [vote, setVote] = useState<{
    target: Player;
    votes: Record<string, "yes" | "no">;
    left: number;
  } | null>(null);
  const [voteLog, setVoteLog] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [reward, setReward] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { from: string; text: string; timestamp: number }[]
  >([]);
  const [doubleCount, setDoubleCount] = useState(0);
  const [isDoubleRoll, setIsDoubleRoll] = useState(false);
  const timeoutHandled = useRef(false);
  const voteHandled = useRef(false);
  const afterAnimRef = useRef<(() => void) | null>(null);

  const current = players[turn];
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
      let interval: NodeJS.Timeout | null = null;
      if (isRolling) {
        // Вращение с уменьшенной на 40% скоростью (интервал 70мс, угол 12-36)
        interval = setInterval(() => {
          setRotX((prev) => (prev + 12 + Math.random() * 24) % 360);
          setRotY((prev) => (prev + 12 + Math.random() * 24) % 360);
        }, 70); // <-- Увеличили время с 50 до 70 Кс
      } else {
        // При остановке плавно приходим к целевым углам
        const finalAngles = getFinalAngles(value);
        setRotX(finalAngles.x);
        setRotY(finalAngles.y);
      }
      return () => {
        if (interval) clearInterval(interval);
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
  const inJail = (current.jailTurns ?? 0) > 0;
  const currentCellName = boardCells[current.position]?.name ?? "?";
  const CORNER = new Set([0, 10, 20, 30]);
  const busy =
    rolled ||
    !!vote ||
    !!pendingAction ||
    !!auction ||
    gameOver ||
    !!animPath ||
    diceRolling;

  const monopolyGroups = GROUPS.map((g, gIdx) => ({
    gIdx,
    group: g,
    has: g.cells.every((ci) => owners[ci] === current.id),
  })).filter((x) => x.has);
  const getDisplayPos = (pid: string) => {
    if (animPath && pid === current.id)
      return animPath[Math.min(animStep, animPath.length - 1)];
    return players.find((p) => p.id === pid)?.position ?? 0;
  };

  const addLog = (entry: string, type: "default" | "special" = "default") =>
    setLog((old) =>
      [...old, { text: entry, type, timestamp: Date.now() }].slice(-50),
    );
  const sendChat = (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages((old) => [
      ...old,
      { from: current.name, text: chatInput.trim(), timestamp: Date.now() },
    ]);
    setChatInput("");
  };

  const nextAliveIndex = (from: number) => {
    for (let s = 1; s <= players.length; s++) {
      const i = (from + s) % players.length;
      if (!players[i].bankrupt) return i;
    }
    return from;
  };

  const advanceTurn = (fromIdx = turn, forceNext = false) => {
    const nextGlobalTurn = globalTurnCounter + 1;
    setGlobalTurnCounter(nextGlobalTurn);

    // Проверяем и очищаем истекшие залоги (если ход counter > залогового срока)
    const expired = Object.keys(mortgages).filter(
      (key) => mortgages[Number(key)] <= nextGlobalTurn,
    );
    if (expired.length > 0) {
      const newOwners = { ...owners };
      const newMortgages = { ...mortgages };
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
    // Если это дубль (1-й или 2-й), Кы не переключаем ход, а даём бросать снова тому же игроку
    if (!forceNext && isDoubleRoll && doubleCount < 3) {
      setRolled(false);
      setTimeLeft(45);
      setImprovedGroupsThisTurn([]);
      timeoutHandled.current = false;
      setMessage(`${players[fromIdx].name}, дубль! Бросай кубики снова.`);
      return; // Ход не Кеняется
    }
    const next = nextAliveIndex(fromIdx);
    setTurn(next);
    setRolled(false);
    setTimeLeft(45);
    setImprovedGroupsThisTurn([]);
    setDoubleCount(0);
    setIsDoubleRoll(false);
    timeoutHandled.current = false;
    setMessage(`${players[next].name}, твой ход. Бросай кости.`);
  };

  const bankruptPlayer = (index: number, reason: string) => {
    setPlayers((old) =>
      old.map((p, i) => (i === index ? { ...p, bankrupt: true, money: 0 } : p)),
    );
    addLog(`💀 ${players[index].name} — банкрот: ${reason}`);

    // Очищаем поля, постройки И ЗАЛОГИ банкрота
    const newOwners = { ...owners };
    const newImprovements = { ...improvements };
    const newMortgages = { ...mortgages };
    Object.keys(newOwners).forEach((key) => {
      const cellIdx = Number(key);
      if (newOwners[cellIdx] === players[index].id) {
        delete newOwners[cellIdx];
        delete newImprovements[cellIdx];
        delete newMortgages[cellIdx]; // Очищаем залог!
      }
    });
    setOwners(newOwners);
    setImprovements(newImprovements);
    setMortgages(newMortgages); // Применяем очистку залогов
    addLog(
      `🏚 Поля, постройки и залоги игрока ${players[index].name} возвращены в банк.`,
    );

    const remainingAlive = players.filter((p, i) => i !== index && !p.bankrupt);
    if (remainingAlive.length <= 1) {
      setGameOver(true);
      window.setTimeout(finishGame, 300);
    } else {
      advanceTurn(index, true); // forceNext = true, чтобы дубли не Кешали смене хода
    }
  };

  const resolveVote = (votes: Record<string, "yes" | "no">, target: Player) => {
    const yes = Object.values(votes).filter((v) => v === "yes").length;
    const tot = Object.values(votes).length;
    const stays = tot > 0 && yes / tot >= settings.voteYesPercent / 100;
    const result = `🗳 Голосование: ${yes}/${tot} «Да». ${target.name} ${stays ? "остаётся" : "выбывает"}.`;
    addLog(result);
    setVote(null);
    if (stays) advanceTurn(turn);
    else bankruptPlayer(turn, "решение стола");
  };

  const castVote = (voter: string, value: "yes" | "no") => {
    if (!vote || vote.votes[voter]) return;
    const nv = { ...vote.votes, [voter]: value };
    const others = players.filter(
      (p) => p.id !== vote.target.id && !p.bankrupt,
    );
    if (Object.keys(nv).length >= others.length) resolveVote(nv, vote.target);
    else setVote({ ...vote, votes: nv });
  };

  const handleTimeout = () => {
    if (
      timeoutHandled.current ||
      rolled ||
      pendingAction ||
      auction ||
      animPath ||
      diceRolling
    )
      return;
    timeoutHandled.current = true;
    if (alive.length <= 2) {
      bankruptPlayer(turn, "тайм-аут");
      return;
    }
    voteHandled.current = false;
    setVote({ target: current, votes: {}, left: settings.voteDuration });
    setMessage(`Время вышло. Голосование за ${current.name}.`);
  };

  useEffect(() => {
    if (
      rolled ||
      vote ||
      gameOver ||
      pendingAction ||
      auction ||
      animPath ||
      diceRolling
    )
      return;
    const id = window.setInterval(
      () =>
        setTimeLeft((old) => {
          if (old <= 1) {
            window.setTimeout(handleTimeout, 0);
            return 0;
          }
          return old - 1;
        }),
      1000,
    );
    return () => window.clearInterval(id);
  });

  useEffect(() => {
    if (!vote) return;
    const id = window.setInterval(
      () =>
        setVote((old) => {
          if (!old) return null;
          if (old.left <= 1) {
            if (!voteHandled.current) {
              voteHandled.current = true;
              window.setTimeout(() => resolveVote(old.votes, old.target), 0);
            }
            return { ...old, left: 0 };
          }
          return { ...old, left: old.left - 1 };
        }),
      1000,
    );
    return () => window.clearInterval(id);
  });

  useEffect(() => {
    if (!animPath || animStep >= animPath.length - 1) return;
    const t = window.setTimeout(() => setAnimStep((s) => s + 1), 310);
    return () => window.clearTimeout(t);
  }, [animPath, animStep]);

  useEffect(() => {
    if (!animPath || animStep < animPath.length - 1) return;
    const cb = afterAnimRef.current;
    afterAnimRef.current = null;
    const t = window.setTimeout(() => {
      setAnimPath(null);
      if (cb) cb();
    }, 180);
    return () => window.clearTimeout(t);
  }, [animPath, animStep]);

  // --- processLanding ---
  const processLanding = (
    newPos: number,
    oldPos: number,
    capturedTurn: number,
  ) => {
    const cur = players[capturedTurn];
    const passedStart = newPos !== 0 && newPos < oldPos;
    if (passedStart) {
      setPlayers((ps) =>
        ps.map((p, i) =>
          i === capturedTurn ? { ...p, money: p.money + 2000 } : p,
        ),
      );
      addLog(`🏁 ${cur.name} прошёл Старт: +2 000 К`);
    }
    const cell = boardCells[newPos];
    switch (cell.type) {
      case "start":
        addLog(`🏁 ${cur.name} попал на Старт! +3 000 К`);
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === capturedTurn ? { ...p, money: p.money + 3000 } : p,
          ),
        );
        addLog(`🏁 ${cur.name} получил 3 000 К за Старт!`);
        advanceTurn(capturedTurn);
        break;
      case "property": {
        const owner = owners[newPos];
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
          const rent = getRent(newPos, improvements);
          const ownerName = players.find((p) => p.id === owner)?.name ?? "?";
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
              ? ev.amount *
                Object.values(improvements).reduce((s, v) => s + v, 0)
              : ev.amount;
        const gain = ev.kind === "gain" || ev.kind === "birthday";
        addLog(`🎲 ${cur.name} встал на «Шанс»: «${ev.desc}»`);
        if (gain) {
          // Auto-credit gains
          if (ev.kind === "birthday") {
            setPlayers((ps) =>
              ps.map((p, i) => {
                if (i === capturedTurn)
                  return { ...p, money: p.money + totalAmt };
                if (!p.bankrupt)
                  return { ...p, money: Math.max(0, p.money - ev.amount) };
                return p;
              }),
            );
            addLog(
              `🎂 Все игроки скинулись ${cur.name} по ${ev.amount.toLocaleString("ru-RU")} К`,
            );
          } else {
            setPlayers((ps) =>
              ps.map((p, i) =>
                i === capturedTurn ? { ...p, money: p.money + totalAmt } : p,
              ),
            );
            addLog(
              `💰 ${cur.name} получил ${totalAmt.toLocaleString("ru-RU")} К`,
            );
          }
          advanceTurn(capturedTurn);
        } else {
          setPendingAction({
            type: "chance",
            amount: totalAmt,
            gain: false,
            desc: ev.desc,
          });
        }
        break;
      }
      case "challenge": {
        const ev =
          CHALLENGE_EVENTS_DATA[
            Math.floor(Math.random() * CHALLENGE_EVENTS_DATA.length)
          ];
        const nPos = (newPos + (ev.forward ? ev.steps : 40 - ev.steps)) % 40;
        addLog(
          `⚡ ${cur.name} встал на «Испытание»: «${ev.desc}» → «${boardCells[nPos].name}»`,
        );
        // Перемещаем игрока
        setPlayers((ps) =>
          ps.map((p, i) => (i === capturedTurn ? { ...p, position: nPos } : p)),
        );
        // ЗАПУСКАЕМ ПРИЗЕМЛЕНИЕ на новое поле (чтобы предложить покупку)
        window.setTimeout(() => {
          processLanding(nPos, newPos, capturedTurn);
        }, 10);
        break;
      }
      case "gotojail":
        addLog(`👮 ${cur.name} попал на «В тюрьму»! Отправляется за решётку.`);
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === capturedTurn
              ? { ...p, position: 10, jailTurns: 3, jailAttempts: 0 }
              : p,
          ),
        );
        addLog(`🔒 ${cur.name} отправлен в тюрьму (до 3 попыток дубля)`);
        advanceTurn(capturedTurn, true);
        break;
      case "jail":
        // 1.7.1: landing on Jail cell = same as gotojail
        addLog(
          `🔒 ${cur.name} попал на «Тюрьма» — задержан! До 3 попыток дубля или выкуп 500 К.`,
        );
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === capturedTurn
              ? { ...p, position: 10, jailTurns: 3, jailAttempts: 0 }
              : p,
          ),
        );
        addLog(`🔒 ${cur.name} отправлен в тюрьму (до 3 попыток дубля)`);
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
        `🎰 ${current.name} угадал! Секретное число: ${secret}. Выиграл ${prize.toLocaleString("ru-RU")} К! (ставка ${entryFee.toLocaleString("ru-RU")} К)`,
      );
    } else {
      addLog(
        `🎰 ${current.name} не угадал. Секретное число: ${secret}. Потерял ${entryFee.toLocaleString("ru-RU")} К.`,
      );
    }
    advanceTurn();
  };

  // --- confirmAction ---
  const confirmAction = () => {
    if (!pendingAction) return;
    const a = pendingAction;
    setPendingAction(null);
    switch (a.type) {
      case "rent":
        setPlayers((ps) =>
          ps.map((p) => {
            if (p.id === current.id)
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
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === turn ? { ...p, money: Math.max(0, p.money - a.amount) } : p,
          ),
        );
        setJackpot((j) => j + a.amount);
        addLog(
          `💸 ${current.name} заплатил налог ${a.amount.toLocaleString("ru-RU")} К в джекпот`,
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
              ? { ...p, position: 10, jailTurns: 3, jailAttempts: 0 }
              : p,
          ),
        );
        addLog(`🔒 ${current.name} отправлен в тюрьму (до 3 попыток дубля)`);
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
            ? `🎰 ${current.name} выиграл Джекпот: +${amt.toLocaleString("ru-RU")} К!`
            : "🎰 Джекпот пуст.",
        );
        advanceTurn();
        break;
      }
    }
  };

  const buyProperty = () => {
    if (!pendingAction || pendingAction.type !== "buy") return;
    const { cellIndex, price } = pendingAction;
    if (current.money < price) {
      addLog("❌ Недостаточно средств!");
      return;
    }
    setOwners((old) => ({ ...old, [cellIndex]: current.id }));
    setPlayers((ps) =>
      ps.map((p, i) => (i === turn ? { ...p, money: p.money - price } : p)),
    );
    addLog(
      `🏠 ${current.name} купил «${boardCells[cellIndex].name}» за ${price.toLocaleString("ru-RU")} К`,
    );
    setPendingAction(null);
    advanceTurn();
  };

  // FIX 1.1: initiator is excluded from auction
  const sendToAuction = () => {
    if (!pendingAction || pendingAction.type !== "buy") return;
    const { cellIndex, price } = pendingAction;
    setPendingAction(null);
    const startPrice = Math.max(100, Math.round((price * 0.5) / 100) * 100);

    // 1. Определяем следующего по порядку хода живого игрока (после текущего)
    const firstIdx = nextAliveIndex(turn);
    const firstToActId = players[firstIdx].id;

    // 2. Собираем всех живых игроков, кроме того, кто выставил на аукцион
    let rawParticipants = players
      .filter((p) => !p.bankrupt && p.id !== current.id)
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
      `🔨 ${current.name} выставил на аукцион «${boardCells[cellIndex].name}». Старт: ${startPrice.toLocaleString("ru-RU")} К`,
    );
    addLog(`🔨 ${current.name} отказался от участия п   аукционе`);
  };

  const auctionRaise = () => {
    if (!auction) return;
    const bidderId = auction.participants[auction.currentIdx];
    const bidder = players.find((p) => p.id === bidderId);
    const newPrice = auction.price + 100;
    if (!bidder || bidder.money < newPrice) {
      addLog("❌ Недостаточно   редств для ставки.");
      return;
    }

    // Если в аукционе остался только 1 участник, он сразу выигрывает по новой цене
    if (auction.participants.length === 1) {
      const winner = bidder;
      setOwners((old) => ({ ...old, [auction.cellIndex]: bidderId }));
      setPlayers((ps) =>
        ps.map((p) =>
          p.id === bidderId ? { ...p, money: p.money - newPrice } : p,
        ),
      );
      addLog(
        `🏆 ${winner.name} выиграл аукцион! «${boardCells[auction.cellIndex].name}»  за ${newPrice.toLocaleString("ru-RU")} К`,
      );
      setAuction(null);
      advanceTurn(); // Передаём ход с учётом дублей
      return;
    }

    const nextIdx = (auction.currentIdx + 1) % auction.participants.length;
    addLog(`🔨 ${bidder.name} ста9 ит ${newPrice.toLocaleString("ru-RU")} К`);
    setAuction({
      ...auction,
      price: newPrice,
      currentIdx: nextIdx,
      highBidder: bidderId,
    });
  };

  const auctionDecline = () => {
    if (!auction) return;
    const bidderId = auction.participants[auction.currentIdx];
    const bidder = players.find((p) => p.id === bidderId);
    addLog(`🔨 ${bidder?.name ?? "?"} отказался от участия в аукционе`);

    // Удаляем отказавшегося игрока
    const newParticipants = auction.participants.filter(
      (id) => id !== bidderId,
    );

    // Если никого не осталось — аукцион завершён без победителя
    if (newParticipants.length === 0) {
      if (auction.highBidder) {
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
            `🏆 ${winner.name} выиграл аукцион! «${boardCells[auction.cellIndex].name}» за ${auction.price.toLocaleString("ru-RU")} К`,
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

    // Если остался 1 участник, НЕ завершаем аукцион автоматически.
    // Он получит свой ход через кнопки «+100» или «Отказаться».
    const nextIdx = auction.currentIdx % newParticipants.length;
    setAuction({
      ...auction,
      participants: newParticipants,
      currentIdx: nextIdx,
    });
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
    if (current.money < cost) {
      addLog("❌ Недостаточно средств для улучшения!");
      return;
    }
    const lvl = improvements[cellIdx] ?? 0;
    if (lvl >= 5) {
      addLog("ℹ️ Каксимальное улучшение!");
      return;
    }
    const groupCells = GROUPS[gIdx].cells as readonly number[];
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
      `🏗 ${current.name} улучшил «${boardCells[cellIdx].name}» → ${IMPROVE_LABELS[lvl + 1]} (-${cost.toLocaleString("ru-RU")} К)`,
    );
  };

  const sellProperty = (cellIdx: number) => {
    const lvl = improvements[cellIdx] ?? 0;
    if (lvl === 0) {
      addLog("ℹ️ На этом поле нет строений для продажи.");
      return;
    }
    const owner = owners[cellIdx];
    if (owner !== current.id) {
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
      `🏗 ${current.name} продал улучшение на «${boardCells[cellIdx].name}» (+${cost.toLocaleString("ru-RU")} К)`,
    );
  };
  const mortgageProperty = () => {
    if (selectedCell === null) return;
    const cellIdx = selectedCell;
    const amt = getMortgage(cellIdx);
    if (owners[cellIdx] !== current.id) {
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
      `🔒 ${current.name} заложил «${boardCells[cellIdx].name}» за ${amt.toLocaleString("ru-RU")} К. Истекает через 15 ходов.`,
    );
    setSelectedCell(null);
  };

  const redeemProperty = () => {
    if (selectedCell === null) return;
    const cellIdx = selectedCell;
    const cost = getRedeemCost(cellIdx); // Новая цена выкупа

    if (owners[cellIdx] !== current.id) {
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
    if (current.money < cost) {
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
      `🔓 ${current.name} выкупил «${boardCells[cellIdx].name}» за ${cost.toLocaleString("ru-RU")} К.`,
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

  const myOwnedCards = Object.entries(owners)
    .filter(([, oid]) => oid === current.id)
    .map(([ci]) => Number(ci));
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
      id: current.id,
      fromIdx: turn,
      isDouble: isDoubleRoll,
      doubleCount: doubleCount,
    });

    // Отправляем предложение и переключаем ход на получателя
    setPendingTrade({ initiatorId: current.id, trade });
    setTurn(targetIdx); // Принудительно переключаем ход
    setRolled(false); // Сбрасываем флаг броска, если был
    setMessage(
      `Ожидаем ответа от ${tradeTarget.name} на предложение договора...`,
    );
    addLog(
      `🤝 ${current.name} предлагает договор ${tradeTarget.name}. Ожидаем ответа...`,
    );
    setTrade(null); // Закрываем окно у инициатора
  };

  // --- Roll mechanics ---
  const doRollAnimation = (d1: number, d2: number, onDone: () => void) => {
    setTargetDice([d1, d2]);
    setDiceRolling(true); // Показываем оверлей
    setIsSpinning(true); // Запускаем вращение кубиков

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

  const rollJail = () => {
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const steps = d1 + d2;
    const capturedTurn = turn;
    // Если открыто окно договора, закрываем его перед попыткой выйти из тюрьмы
    setTrade(null);
    doRollAnimation(d1, d2, () => {
      // ... остальной код
      const attempts = (current.jailAttempts ?? 0) + 1;
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
          `🎲 ${current.name} вышел из тюрьмы! Дубль! Двигается на ${steps} → «${boardCells[np].name}»`,
        );
        const path: number[] = [];
        for (let i = 1; i <= steps; i++) path.push((10 + i) % 40);
        afterAnimRef.current = () => processLanding(np, 10, capturedTurn);
        setAnimStep(0);
        setAnimPath(path);
      } else if (attempts >= 3) {
        // 3-я попытка: если есть деньги — принудительный выкуп, иначе — даем шанс продать/заложить
        if (current.money >= 500) {
          const np = (10 + steps) % 40;
          setPlayers((ps) =>
            ps.map((p, i) =>
              i === capturedTurn
                ? {
                    ...p,
                    money: Math.max(0, p.money - 500),
                    position: np,
                    jailTurns: 0,
                    jailAttempts: 0,
                  }
                : p,
            ),
          );
          addLog(
            `🔓 ${current.name} — 3-я попытка, дубль не выпал. Принудительный выкуп 500 К, двигается на ${steps} → «${boardCells[np].name}»`,
          );
          const path: number[] = [];
          for (let i = 1; i <= steps; i++) path.push((10 + i) % 40);
          afterAnimRef.current = () => processLanding(np, 10, capturedTurn);
          setAnimStep(0);
          setAnimPath(path);
        } else {
          // Недостаточно денег для выкупа (менее 500 К) -> Открываем специальное окно
          setJailPaymentPending(true);
          setPlayers((ps) =>
            ps.map((p, i) =>
              i === capturedTurn
                ? {
                    ...p,
                    jailTurns: 0,
                    jailAttempts: 0,
                  }
                : p,
            ),
          );
          addLog(
            `❗ ${current.name} — 3-я попытка, дубль не выпал. Недостаточно денег для выкупа (500 К). Продайте или заложите имущество.`,
          );
          setMessage(
            "Недостаточно денег (500 К). Продайте или заложите имущество.",
          );
          setTimeLeft(45); // Даем дополнительное время
        }
      } else {
        // No double — stay in jail
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === capturedTurn
              ? {
                  ...p,
                  jailTurns: Math.max(0, (p.jailTurns ?? 3) - 1),
                  jailAttempts: attempts,
                }
              : p,
          ),
        );
        addLog(
          `🔒 ${current.name} — дубль не выпал (попытка ${attempts}/3). Остаётся в тюрьме.`,
        );
        window.setTimeout(() => advanceTurn(capturedTurn), 900);
      }
    });
  };

  const payBail = () => {
    if (current.money < 500) {
      setMessage("Недостаточно денег (500 К)!");
      return;
    }
    setJailPaymentPending(false);
    setPlayers((ps) =>
      ps.map((p, i) =>
        i === turn
          ? { ...p, money: p.money - 500, jailTurns: 0, jailAttempts: 0 }
          : p,
      ),
    );
    addLog(`🔓 ${current.name} выкупился за 500 К`);
    setMessage("Выкупился! Теперь бросай кубики.");
  };

  const roll = () => {
    if (busy) return;
    // Если открыто окно договора, закрываем его перед броском
    setTrade(null);
    if (inJail) {
      rollJail();
      return;
    }
    // ... остальной код
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const steps = d1 + d2;
    const oldPos = current.position;
    const capturedTurn = turn;
    const isDoubles = d1 === d2;

    doRollAnimation(d1, d2, () => {
      addLog(
        `🎲 ${current.name} выбросил ${d1} и ${d2} = ${steps}, отправился на «${boardCells[(oldPos + steps) % 40].name}»`,
      );
      setRolled(true);
      setIsDoubleRoll(isDoubles);

      // Логика дублей
      if (isDoubles) {
        const newDoubleCount = doubleCount + 1;
        setDoubleCount(newDoubleCount);
        if (newDoubleCount === 3) {
          addLog(
            `🎲 Третий дубль подряд! ${current.name} отправляется в тюрьму!`,
          );
          setPlayers((ps) =>
            ps.map((p, i) =>
              i === capturedTurn
                ? { ...p, position: 10, jailTurns: 3, jailAttempts: 0 }
                : p,
            ),
          );
          setDoubleCount(0);
          setIsDoubleRoll(false);
          setMessage(`🔒 ${current.name} — третий дубль! Отправлен в тюрьму.`);
          advanceTurn(capturedTurn, true); // Принудительно передаём ход
          return;
        }
      } else {
        setDoubleCount(0);
      }

      const path: number[] = [];
      for (let i = 1; i <= steps; i++) path.push((oldPos + i) % 40);
      const finalPos = path[path.length - 1];
      afterAnimRef.current = () => {
        setPlayers((ps) =>
          ps.map((p, i) =>
            i === capturedTurn ? { ...p, position: finalPos } : p,
          ),
        );
        processLanding(finalPos, oldPos, capturedTurn);
      };
      setAnimStep(0);
      setAnimPath(path);
    });
  };

  const finishGame = () => {
    const aliveNow = players.filter((p) => !p.bankrupt);
    const won = aliveNow.length
      ? [...aliveNow].sort((a, b) => {
          const aVal =
            a.money +
            Object.entries(owners)
              .filter(([, oid]) => oid === a.id)
              .reduce((s, [ci]) => s + (boardCells[Number(ci)].price ?? 0), 0);
          const bVal =
            b.money +
            Object.entries(owners)
              .filter(([, oid]) => oid === b.id)
              .reduce((s, [ci]) => s + (boardCells[Number(ci)].price ?? 0), 0);
          return bVal - aVal;
        })[0]
      : current;
    const xp = 450;
    const coins = 300;
    const drop =
      Math.random() < 0.25
        ? shopSkins[Math.floor(Math.random() * shopSkins.length)]
        : null;
    const winnerReason =
      aliveNow.length <= 1
        ? "🏆 Победитель по выживанию!"
        : "🏆 Лидер по богатству!";
    setReward(
      `${winnerReason} ${won.name} побеждает! +${xp} XP и +${coins} Coins${drop ? ` · Предмет: ${drop.name} добавлен в инвентарь!` : ""}.`,
    );
    if (drop) {
      const ex = JSON.parse(
        localStorage.getItem("arena-inventory") || "[]",
      ) as OwnedItem[];
      localStorage.setItem(
        "arena-inventory",
        JSON.stringify([
          ...ex,
          {
            ...drop,
            id: `${drop.id}-${Date.now()}`,
            ownedAt: new Date().toISOString(),
          },
        ]),
      );
    }
    localStorage.setItem(
      "arena-coins",
      String(Number(localStorage.getItem("arena-coins") || 2400) + coins),
    );
  };

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

  return (
    <div
      className="relative flex h-full overflow-hidden bg-[#1c1828]"
      onClick={() => setPlayerHover(null)}
    >
      {/* Room info strip — absolute left */}
      <div className="absolute left-0 top-0 z-10 flex h-full w-[108px] px-3 py-3 bg-foreground text-border border-t-[#29233e] border-r-[#29233e] border-b-[#29233e] border-l-[#29233e] pl-[135px] pr-[135px] justify-center items-center flex-col text-center gap-[14px] rounded-tl-[4px] rounded-tr-[4px] rounded-br-[4px] rounded-bl-[4px]">
        <div className="font-mono text-[8px] uppercase leading-relaxed tracking-[.10em] text-primary text-left border-t-[0px] border-r-[0px] border-b-[0px] border-l-[0px] pt-[0px] pb-[0px] mt-[0px] mb-[0px]">
          <span className="block whitespace-nowrap">живая партия</span>
          <span className="block whitespace-nowrap">стол MA-7K2P</span>
        </div>
        <h1 className="font-display text-[15px] font-bold leading-tight text-border">
          Пятничный клуб
        </h1>
        <div className="mt-1 rounded-lg bg-[#f3e7c8] px-1.5 py-1 text-center">
          <div className="font-mono text-[6px] text-[#7a5c1e]">ДЖЕКПОТ</div>
          <div className="text-[11px]">🎰</div>
        </div>
      </div>
      {/* Board + Right panel — shared centered container */}
      <div className="flex flex-1 items-start justify-center gap-5 overflow-hidden py-1.5 pr-2 pl-[268px] border-t-[#5e5a6e] border-r-[#5e5a6e] border-b-[#5e5a6e] border-l-[#5e5a6e] bg-foreground">
        <div className="aspect-square h-full max-h-full shrink-0 shadow-[0_18px_60px_rgba(41,35,62,.35)]">
          <div
            className="grid h-full w-full gap-px bg-[#5e5a6e]"
            style={{
              gridTemplateColumns: "1.9fr repeat(9, 1fr) 1.9fr",
              gridTemplateRows: "1.9fr repeat(9, 1fr) 1.9fr",
            }}
          >
            {boardCells.map((cell, index) => {
              const design = cardDesigns.find((d) => d.slotIndex === index);
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
              const group = getCellGroup(index);
              const ownedBy = owners[index];
              const ownerPlayer = ownedBy
                ? players.find((p) => p.id === ownedBy)
                : null;
              const improvLevel = improvements[index] ?? 0;
              const isMortgaged =
                mortgages[index] !== undefined &&
                mortgages[index] > globalTurnCounter;
              const displayPrice = group
                ? ownedBy
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
                (p) => !p.bankrupt && getDisplayPos(p.id) === index,
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
                      fontSize: "7px",
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
                      ? ownerPlayer.color + "90"
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
                              textShadow: ownerPlayer
                                ? "0 0 5px rgba(0,0,0,0.7)"
                                : "none",
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
                              textShadow: ownerPlayer
                                ? "0 0 5px rgba(0,0,0,0.7)"
                                : "none",
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
                    <div className="absolute bottom-[3px] left-1/2 flex -translate-x-1/2 gap-1 z-10">
                      {playersHere.map((p) => (
                        <div
                          key={p.id}
                          className="flex w-[23px] h-[23px] items-center justify-center rounded-full font-bold text-white shadow-sm"
                          style={{
                            backgroundColor: p.color,
                            fontSize: "10px",
                          }}
                        >
                          {p.initials[0]}
                        </div>
                      ))}
                    </div>
                  )}
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
                    (() => {
                      const a = pendingAction as BuyA;
                      return (
                        <>
                          <div className="text-[7.5px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                            💼 Покупка поля
                          </div>
                          <div className="text-[10px] font-bold text-white mb-0.5">
                            {CELL_LOGOS[a.cellIndex] ?? ""}{" "}
                            {boardCells[a.cellIndex].name}
                          </div>
                          <div className="text-[8px] text-white/55 mb-2">
                            Если откажешься — поле уйдёт на аукцион среди других
                            игроков.
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={buyProperty}
                              disabled={current.money < a.price}
                              className="flex-1 rounded-lg bg-[#e96852] py-1.5 text-[9px] font-bold text-white disabled:opacity-40 hover:bg-[#d45a43] transition-colors"
                            >
                              Купить {a.price.toLocaleString("ru-RU")} К
                            </button>
                            <button
                              onClick={sendToAuction}
                              className="flex-1 rounded-lg bg-white/15 py-1.5 text-[9px] font-bold text-white hover:bg-white/20 transition-colors"
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
                      return (
                        <>
                          <div className="text-[7.5px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                            🏠 Аренда
                          </div>
                          <div className="text-[9px] text-white/80 mb-2">
                            Ты на поле{" "}
                            <b className="text-white">
                              {boardCells[a.cellIndex].name}
                            </b>{" "}
                            игрока <b className="text-white">{a.ownerName}</b>.
                          </div>
                          <button
                            onClick={confirmAction}
                            className="w-full rounded-lg bg-[#e96852] py-1.5 text-[9px] font-bold text-white hover:bg-[#d45a43] transition-colors"
                          >
                            Заплатить {a.amount.toLocaleString("ru-RU")} К
                          </button>
                        </>
                      );
                    })()}
                  {pendingAction?.type === "tax" &&
                    (() => {
                      const a = pendingAction as NumA;
                      return (
                        <>
                          <div className="text-[7.5px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                            💸 Налог
                          </div>
                          <div className="text-[9px] text-white/70 mb-2">
                            Штраф уйдёт в копилку джекпота.
                          </div>
                          <button
                            onClick={confirmAction}
                            className="w-full rounded-lg bg-[#e96852] py-1.5 text-[9px] font-bold text-white hover:bg-[#d45a43] transition-colors"
                          >
                            Заплатить {a.amount.toLocaleString("ru-RU")} К
                          </button>
                        </>
                      );
                    })()}
                  {pendingAction?.type === "chance" &&
                    (() => {
                      const a = pendingAction as GainA;
                      return (
                        <>
                          <div className="text-[7.5px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                            🎲 Шанс
                          </div>
                          <div className="text-[9px] text-white/80 leading-relaxed mb-2">
                            {a.desc}
                          </div>
                          <button
                            onClick={confirmAction}
                            className="w-full rounded-lg bg-[#e96852] py-1.5 text-[9px] font-bold text-white hover:bg-[#d45a43] transition-colors"
                          >
                            Заплатить {a.amount.toLocaleString("ru-RU")} К
                          </button>
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
                            {current.money < 500 ? (
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
                          <div className="text-[7.5px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                            🎰 Казино Джекпота!
                          </div>
                          {needPicks === 0 ? (
                            <>
                              <div className="text-[8px] text-white/70 mb-2">
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
                                  return (
                                    <button
                                      key={dc}
                                      onClick={() =>
                                        setPendingAction({
                                          ...a,
                                          diceCount: dc,
                                        })
                                      }
                                      className="rounded-lg bg-white/15 px-1 py-2 text-center hover:bg-[#e7ba68]/30 transition-colors"
                                    >
                                      <div className="text-[11px]">
                                        {"🎲".repeat(dc)}
                                      </div>
                                      <div className="text-[7px] font-bold text-white mt-0.5">
                                        {fee.toLocaleString("ru-RU")} К
                                      </div>
                                      <div className="text-[6px] text-white/50">
                                        приз {prize.toLocaleString("ru-RU")} К
                                      </div>
                                      <div className="text-[6px] text-[#e7ba68]">
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
                                    `🎰 ${current.name} пропустил игру в казино.`,
                                  );
                                  advanceTurn();
                                }}
                                className="mt-2 w-full rounded-lg bg-white/10 py-1.5 text-[9px] font-bold text-white hover:bg-white/20 transition-colors"
                              >
                                Пропустить
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="text-[8px] text-white/70 mb-1">
                                {"🎲 ".repeat(needPicks)} Выбери {needPicks}{" "}
                                число
                                {needPicks > 1
                                  ? needPicks === 2
                                    ? "а"
                                    : ""
                                  : ""}{" "}
                                из 1–6:
                              </div>
                              <div className="text-[7px] text-white/40 mb-2">
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
                                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-all ${sel ? "bg-[#e7ba68] text-[#29233e] scale-110" : canAdd ? "bg-white/15 text-white hover:bg-white/25" : "bg-white/5 text-white/30 cursor-not-allowed"}`}
                                    >
                                      {n}
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
                                  className="w-full rounded-lg bg-[#32786d] py-1.5 text-[9px] font-bold text-white hover:bg-[#266059] transition-colors"
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
                                className="mt-1 w-full rounded-lg py-1 text-[7px] text-white/40 hover:text-white/70"
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
                          <div className="text-[7.5px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                            🔒 В тюрьму
                          </div>
                          <div className="text-[9px] text-white/75 mb-2">
                            Отправляешься в тюрьму. До 3 попыток дубля.
                          </div>
                          <button
                            onClick={confirmAction}
                            className="w-full rounded-lg bg-[#e96852] py-1.5 text-[9px] font-bold text-white hover:bg-[#d45a43] transition-colors"
                          >
                            ОК
                          </button>
                        </>
                      );
                    })()}
                  {auction && (
                    <>
                      <div className="text-[7.5px] font-bold text-[#e7ba68] uppercase tracking-widest mb-1">
                        🔨 Аукцион — {CELL_LOGOS[auction.cellIndex] ?? ""} «
                        {boardCells[auction.cellIndex].name}»
                      </div>
                      <div className="flex items-baseline gap-1 mb-0.5">
                        <span className="text-[8px] text-white/60">
                          Текущая ставка:
                        </span>
                        <span className="text-[11px] font-bold text-white">
                          {auction.price.toLocaleString("ru-RU")} К
                        </span>
                      </div>
                      {auction.highBidder && (
                        <div className="text-[8px] text-white/50 mb-0.5">
                          Лидер:{" "}
                          <b className="text-white">
                            {
                              players.find((p) => p.id === auction.highBidder)
                                ?.name
                            }
                          </b>
                        </div>
                      )}
                      <div className="text-[8px] text-white/70 mb-2">
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
                            <div className="text-center text-[8px] text-white/40 italic">
                              Игрок банкрот
                            </div>
                          );
                        return (
                          <div className="flex gap-1.5">
                            <button
                              onClick={auctionRaise}
                              disabled={
                                currentBidder &&
                                currentBidder.money < auction.price + 100
                              }
                              className="flex-1 rounded-lg bg-[#32786d] py-1.5 text-[9px] font-bold text-white disabled:opacity-40 hover:bg-[#266059] transition-colors"
                            >
                              +100 →{" "}
                              {(auction.price + 100).toLocaleString("ru-RU")} К
                            </button>
                            <button
                              onClick={auctionDecline}
                              className="flex-1 rounded-lg bg-white/15 py-1.5 text-[9px] font-bold text-white hover:bg-white/20 transition-colors"
                            >
                              Отказаться
                            </button>
                          </div>
                        );
                      })()}
                    </>
                  )}
                  {pendingTrade &&
                    (() => {
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
                    <span className="font-mono text-[8px] font-bold text-[#e7ba68] uppercase tracking-wide">
                      🤝 l N говор
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
                      <div className="text-[7px] font-bold text-[#e96852] mb-1">
                        {current.name}{" "}
                        <span className="text-white/40 font-normal">
                          предлагает
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[7px] text-white/50">💵</span>
                        <input
                          type="number"
                          min={0}
                          max={current.money}
                          value={trade.myMoney}
                          onChange={(e) =>
                            setTrade({
                              ...trade,
                              myMoney: Math.min(
                                current.money,
                                Number(e.target.value),
                              ),
                            })
                          }
                          className="w-full rounded bg-white/10 px-1 py-0.5 text-[8px] font-mono text-white border-none outline-none"
                        />
                        <span className="text-[6px] text-white/30 shrink-0">
                          К
                        </span>
                      </div>
                      <div className="space-y-0.5 max-h-16 overflow-y-auto">
                        {myOwnedCards.map((ci) => (
                          <label
                            key={ci}
                            className="flex items-center gap-1 cursor-pointer"
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
                              className="accent-[#e96852] w-2.5 h-2.5"
                            />
                            <span className="text-[7px] truncate">
                              {CELL_LOGOS[ci] ?? ""} {boardCells[ci].name}
                            </span>
                          </label>
                        ))}
                        {myOwnedCards.length === 0 && (
                          <div className="text-[6px] text-white/30 italic">
                            Нет карточек
                          </div>
                        )}
                      </div>
                      <div className="mt-1 text-[7px] font-bold text-[#e96852]">
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
                        className="text-[7px] font-bold mb-1"
                        style={{ color: tradeTarget.color }}
                      >
                        {tradeTarget.name}{" "}
                        <span className="text-white/40 font-normal">
                          отдаёт
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[7px] text-white/50">💵</span>
                        <input
                          type="number"
                          min={0}
                          max={tradeTarget.money}
                          value={trade.theirMoney}
                          onChange={(e) =>
                            setTrade({
                              ...trade,
                              theirMoney: Math.min(
                                tradeTarget.money,
                                Number(e.target.value),
                              ),
                            })
                          }
                          className="w-full rounded bg-white/10 px-1 py-0.5 text-[8px] font-mono text-white border-none outline-none"
                        />
                        <span className="text-[6px] text-white/30 shrink-0">
                          К
                        </span>
                      </div>
                      <div className="space-y-0.5 max-h-16 overflow-y-auto">
                        {tradeTargetCards.map((ci) => (
                          <label
                            key={ci}
                            className="flex items-center gap-1 cursor-pointer"
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
                              className="accent-[#32786d] w-2.5 h-2.5"
                            />
                            <span className="text-[7px] truncate">
                              {CELL_LOGOS[ci] ?? ""} {boardCells[ci].name}
                            </span>
                          </label>
                        ))}
                        {tradeTargetCards.length === 0 && (
                          <div className="text-[6px] text-white/30 italic">
                            Нет карточек
                          </div>
                        )}
                      </div>
                      <div
                        className="mt-1 text-[7px] font-bold"
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
                  <div className="flex gap-1 p-1.5 bg-[#0f0d1a]">
                    <button
                      onClick={() => setTrade(null)}
                      className="flex-1 rounded py-1 text-[7px] font-bold text-white/50 border border-white/10 hover:border-white/20"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={proposeTrade}
                      className="flex-1 rounded py-1 text-[7px] font-bold text-white bg-[#32786d] hover:bg-[#266059]"
                    >
                      Предложить
                    </button>
                  </div>
                </div>
              )}
              <div className="min-h-0 flex-1 relative p-1.5 pt-1 text-[12px]">
                {/* Сами логи чата (объединенный и отсортированный поток) */}
                <div className="space-y-px overflow-y-auto h-full pb-2 [&::-webkit-scrollbar]:hidden">
                  {[...log, ...chatMessages]
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .map((item, i) => {
                      // Проверяем, есть ли поле 'from'. Если есть — это сообщение игрока.
                      if ("from" in item) {
                        return (
                          <div key={`c-${i}`} className="leading-tight">
                            <span className="font-bold text-[#e7ba68]">
                              {item.from}:
                            </span>{" "}
                            {item.text}
                          </div>
                        );
                      } else {
                        // Это лог игры
                        return (
                          <div
                            key={`l-${i}`}
                            className={`leading-tight ${item.type === "special" ? "text-orange-400" : "italic text-white/65"}`}
                            style={
                              item.type === "special"
                                ? { color: "#f97316" }
                                : {}
                            }
                          >
                            {item.text}
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
                className="shrink-0 flex gap-1 border-t border-white/10 p-1"
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Сообщение…"
                  className="min-w-0 flex-1 rounded bg-white/10 px-1.5 py-0.5 text-[8px] text-white placeholder:text-white/35 outline-none"
                />
                <button
                  type="submit"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#e96852] text-white"
                >
                  <Send size={9} />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right control panel */}
        <div className="flex h-full w-[255px] shrink-0 flex-col gap-2 overflow-y-auto p-1.5">
          <div className="rounded-2xl border border-card-border bg-card p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[8px] uppercase tracking-[.15em] text-primary">
                  ход сейчас
                </div>
                <h2 className="font-display text-lg font-bold leading-tight">
                  {current.name}
                </h2>
              </div>
              <Avatar
                initials={current.initials}
                color={current.color}
                size="sm"
              />
            </div>
            <div
              className={`mt-2.5 flex items-center justify-between rounded-xl px-3 py-1.5 text-xs ${timeLeft <= 10 ? "bg-[#f6dfd7] text-primary" : "bg-muted"}`}
            >
              <span className="flex items-center gap-1.5 font-bold">
                <Timer size={12} /> Время хода
              </span>
              <span className="font-mono font-bold">{timeLeft} сек</span>
            </div>
            <div className="mt-2 rounded-xl bg-muted px-3 py-2 text-[11px] leading-snug">
              {message}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-[9px] text-muted-foreground">На руках</div>
                <div className="font-mono text-sm font-bold">
                  {current.money.toLocaleString("ru-RU")}{" "}
                  <span className="text-[9px] text-muted-foreground">К</span>
                </div>
              </div>
              <div className="max-w-[115px] text-right">
                <div className="text-[9px] text-muted-foreground">Клетка</div>
                <div className="truncate text-[11px] font-bold">
                  {currentCellName}
                </div>
              </div>
            </div>
            {inJail ? (
              <>
                <button
                  onClick={roll}
                  disabled={busy}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-45"
                >
                  <Dice5 size={13} />
                  {diceRolling ? "…бросок…" : "Бросить кубики"}
                </button>
                <button
                  onClick={payBail}
                  disabled={
                    (!rolled && !jailPaymentPending) || // Разрешаем нажимать, если открыто окно jailPaymentPending
                    !!vote ||
                    !!pendingAction ||
                    !!auction ||
                    gameOver ||
                    current.money < 500
                  }
                  className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-muted py-2 text-xs font-bold disabled:opacity-45"
                >
                  <Banknote size={13} /> Заплатить (500 К)
                </button>
              </>
            ) : (
              <button
                onClick={roll}
                disabled={busy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-45"
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
                if (!reward) finishGame();
                onExit();
              }}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-input py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              <LogOut size={12} /> Покинуть игру
            </button>
          </div>

          {/* Improvements */}
          {rolled &&
            monopolyGroups.length > 0 &&
            !pendingAction &&
            !auction &&
            !animPath && (
              <div className="rounded-2xl border border-card-border bg-card p-3">
                <div className="mb-2 font-mono text-[8px] uppercase tracking-wide text-muted-foreground">
                  Улучшение Конополий
                </div>
                {monopolyGroups.map(({ gIdx, group }) => {
                  const canImprove = !improvedGroupsThisTurn.includes(gIdx);
                  const targetCell = [...group.cells].sort(
                    (a, b) => (improvements[a] ?? 0) - (improvements[b] ?? 0),
                  )[0];
                  const lvl = improvements[targetCell] ?? 0;
                  if (lvl >= 4) return null;
                  const cost = getImproveCost(targetCell);
                  return (
                    <div key={gIdx} className="mb-2 last:mb-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="text-[10px] font-bold truncate">
                          {group.name}
                        </span>
                      </div>
                      <div className="text-[8px] text-muted-foreground mb-1 truncate">
                        {boardCells[targetCell].name} →{" "}
                        {IMPROVE_LABELS[lvl + 1]}
                      </div>
                      <button
                        onClick={() => improveProperty(targetCell)}
                        disabled={
                          current.id !== players[turn].id ||
                          !canImprove ||
                          current.money < cost
                        }
                        className="w-full rounded-lg py-1.5 text-[9px] font-bold text-white disabled:opacity-40 transition-colors"
                        style={{
                          backgroundColor: canImprove ? group.color : "#aaa",
                        }}
                      >
                        {canImprove
                          ? `Улучшить за ${cost.toLocaleString("ru-RU")} К`
                          : "Уже улучшено"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

          {/* Players list with hover popup */}
          <div className="rounded-2xl border border-card-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold">Игроки</h2>
              <span className="font-mono text-[9px] text-muted-foreground">
                {alive.length} / {players.length}
              </span>
            </div>
            <div className="space-y-1">
              {players.map((p, i) => (
                <div
                  key={p.id}
                  className={`relative flex items-center gap-2 rounded-lg p-1.5 cursor-pointer ${i === turn ? "bg-[#f6dfd7]" : "hover:bg-muted"} ${p.bankrupt ? "opacity-40" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (p.id !== current.id && !p.bankrupt) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPlayerHover({
                        pid: p.id,
                        x: rect.left - 4,
                        y: rect.top,
                      });
                    }
                  }}
                >
                  <Avatar initials={p.initials} color={p.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-bold">
                      {p.name}
                      {p.bankrupt ? " · банкрот" : ""}
                      {(p.jailTurns ?? 0) > 0 ? " 🔒" : ""}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {p.money.toLocaleString("ru-RU")} К ·{" "}
                      {boardCells[p.position]?.name ?? "?"}
                    </div>
                  </div>
                  {(() => {
                    const isCurrentTurn =
                      p.id ===
                      (auction
                        ? auction.participants[auction.currentIdx]
                        : players[turn].id);
                    return isCurrentTurn && !p.bankrupt ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    ) : null;
                  })()}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={finishGame}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-card py-2 text-xs font-bold"
          >
            <Trophy size={12} /> Завершить партию
          </button>

          {/* Rating panel */}
          {showRating &&
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
                <div className="rounded-2xl border border-card-border bg-card p-3">
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
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-card py-2 text-xs font-bold"
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
                  <Avatar initials={tp.initials} color={tp.color} size="sm" />
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
                    disabled:
                      players[turn].id !== current.id ||
                      rolled ||
                      inJail ||
                      !!auction ||
                      !!pendingAction,
                  },
                  {
                    icon: "🗳",
                    label: "Выгнать",
                    action: () => {
                      setPlayerHover(null);
                      voteHandled.current = false;
                      setVote({
                        target: tp,
                        votes: {},
                        left: settings.voteDuration,
                      });
                    },
                  },
                  {
                    icon: "🚩",
                    label: "Репорт",
                    action: () => {
                      setPlayerHover(null);
                      addLog(
                        `🚩 Жалоба на ${tp.name} отправлена администратору.`,
                      );
                    },
                  },
                  {
                    icon: "👤",
                    label: "Профиль",
                    action: () => {
                      setPlayerHover(null);
                    },
                  },
                  {
                    icon: "🏳️",
                    label: "Сдаться",
                    action: () => {
                      setPlayerHover(null);
                      bankruptPlayer(
                        players.findIndex((pl) => pl.id === current.id),
                        "добровольная сдача",
                      );
                    },
                  },
                ].map(({ icon, label, action, disabled }) => (
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
        boardCells[selectedCell].type === "property" &&
        (() => {
          const cell = boardCells[selectedCell];
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
                <div className="text-[7px] font-bold uppercase tracking-wider text-white/75">
                  {group?.name ?? "Поле"}
                </div>
                <div className="font-bold text-sm text-white leading-tight">
                  {cell.name}
                </div>
                {ownedByP && (
                  <div className="mt-0.5 text-[7.5px] text-white/80">
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
                      className={`flex justify-between py-0.5 text-[9px] ${isCurrent ? "font-bold text-foreground" : "text-muted-foreground"}`}
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
                  <div className="flex justify-between text-[9px] text-primary border-b border-border pb-1 mb-1">
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
                    className="flex justify-between text-[9px]"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-bold">
                      {Number(val).toLocaleString("ru-RU")} К
                    </span>
                  </div>
                ))}
              </div>
              {/* Кнопки управления */}
              {ownedByP && ownedByP.id === current.id && (
                <div className="border-t border-border px-3 py-2 space-y-2">
                  <div className="flex gap-1">
                    {!isMortgaged && (
                      <button
                        onClick={mortgageProperty}
                        disabled={
                          isMortgaged || (improvements[selectedCell] ?? 0) > 0
                        }
                        className="flex-1 rounded-lg bg-[#e96852] py-[4px] font-bold text-white disabled:opacity-40 hover:bg-[#d45a43] transition-colors"
                        style={{ fontSize: "9px", lineHeight: "9px" }}
                      >
                        Заложить
                      </button>
                    )}
                    {isMortgaged && (
                      <button
                        onClick={redeemProperty}
                        disabled={current.money < getRedeemCost(selectedCell)}
                        className="flex-1 rounded-lg bg-[#32786d] py-[4px] font-bold text-white disabled:opacity-40 hover:bg-[#266059] transition-colors"
                        style={{ fontSize: "9px", lineHeight: "9px" }}
                      >
                        Выкупить
                      </button>
                    )}

                    <button
                      onClick={() => improveProperty(selectedCell)}
                      disabled={
                        current.id !== players[turn].id ||
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
                      style={{ fontSize: "9px", lineHeight: "9px" }}
                    >
                      Улучшить
                    </button>
                    <button
                      onClick={() => sellProperty(selectedCell)}
                      disabled={
                        current.id !== players[turn].id ||
                        (improvements[selectedCell] ?? 0) === 0
                      }
                      className="flex-1 rounded-lg bg-[#e96852] py-[4px] font-bold text-white disabled:opacity-40 hover:bg-[#d45a43] transition-colors"
                      style={{ fontSize: "9px", lineHeight: "9px" }}
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
      {vote && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#29233e]/60 p-5">
          <div className="w-full max-w-lg rounded-2xl border border-card-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">
                  голосование · {vote.left} сек
                </div>
                <h2 className="mt-2 font-display text-2xl font-bold">
                  Оставить {vote.target.name}?
                </h2>
              </div>
              <div className="rounded-xl bg-[#f6dfd7] p-3 text-primary">
                <Timer size={22} />
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {players
                .filter((p) => p.id !== vote.target.id && !p.bankrupt)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl bg-muted p-3"
                  >
                    <Avatar initials={p.initials} color={p.color} size="sm" />
                    <div className="flex-1 text-sm font-bold">{p.name}</div>
                    {vote.votes[p.id] ? (
                      <span
                        className={`text-xs font-bold ${vote.votes[p.id] === "yes" ? "text-accent" : "text-primary"}`}
                      >
                        {vote.votes[p.id] === "yes" ? "Да" : "Нет"}
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => castVote(p.id, "yes")}
                          className="rounded-lg bg-[#dceae3] px-3 py-1.5 text-xs font-bold text-accent"
                        >
                          Да
                        </button>
                        <button
                          onClick={() => castVote(p.id, "no")}
                          className="rounded-lg bg-[#f6dfd7] px-3 py-1.5 text-xs font-bold text-primary"
                        >
                          Нет
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
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
  const [settings, setSettings] = useLocalStorage<AdminSettings>(
    "arena-admin-settings",
    defaultSettings,
  );
  const [saved, setSaved] = useState(false);
  const [adminTab, setAdminTab] = useState<"settings" | "items">("settings");
  const [itemsTab, setItemsTab] = useState<"cards" | "dice" | "cases">("cards");
  const [cardDesigns, setCardDesigns] = useLocalStorage<CardDesign[]>(
    "arena-card-designs",
    [],
  );
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
  const [cases, setCases] = useLocalStorage<CaseDesign[]>("arena-admin-cases", [
    { id: "1", name: "Классика", rarity: "70", items: ["Кубики", "Фишки"] },
  ]);
  const [caseName, setCaseName] = useState("");
  const [caseRarity, setCaseRarity] = useState("");
  const [caseSelectedItems, setCaseSelectedItems] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState<string | null>(null);

  const DROPPABLE_ITEMS = [
    "Кубики",
    "Фишки",
    "Карточки поля",
    "Жетон удачи",
    "Скидка на аренду",
    "Бесплатный ход",
    "Бонусные Конополки",
  ];

  const update = (key: keyof AdminSettings, value: string) =>
    setSettings({
      ...settings,
      [key]: key === "adminPassword" ? value : Number(value),
    });
  const createCase = (e: FormEvent) => {
    e.preventDefault();
    if (!caseName.trim()) return;
    setCases([
      ...cases,
      {
        id: Date.now().toString(),
        name: caseName.trim(),
        rarity: caseRarity || "50",
        items: caseSelectedItems,
      },
    ]);
    setCaseName("");
    setCaseRarity("");
    setCaseSelectedItems([]);
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
    const existing = cardDesigns.findIndex(
      (d) => d.slotIndex === editDraft.slotIndex,
    );
    if (existing >= 0) {
      setCardDesigns((old) =>
        old.map((d, i) => (i === existing ? editDraft : d)),
      );
    } else {
      if (cardDesigns.length >= MAX_DESIGNS) return;
      setCardDesigns((old) => [
        ...old,
        { ...editDraft, id: `card-${editDraft.slotIndex}-${Date.now()}` },
      ]);
    }
    setEditingCard(null);
    setEditDraft(null);
  };

  const deleteCard = (slotIndex: number) => {
    setCardDesigns((old) => old.filter((d) => d.slotIndex !== slotIndex));
    setEditingCard(null);
    setEditDraft(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editDraft) return;

    // Функция сжатия картинки через Canvas (исправлено на PNG)
    const compressImage = (
      file: File,
      maxWidth: number,
      maxHeight: number,
    ): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;

            // Расчет пропорций
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
            // Рисуем картинку с прозрачностью
            ctx?.drawImage(img, 0, 0, width, height);

            // ВАЖНО: Используем PNG, чтобы сохранить прозрачный фон
            resolve(canvas.toDataURL("image/png"));
          };
          img.onerror = reject;
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };

    // Применяем сжатие с сохранением прозрачности
    compressImage(file, 200, 200)
      .then((compressedBase64) => {
        setEditDraft((d) => (d ? { ...d, imageDataUrl: compressedBase64 } : d));
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
        detail="Настройки клуба, карточки поля, Кодерация."
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
                  Кодерация игроков
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
          </div>

          {itemsTab === "cards" && (
            <div>
              <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                <p className="text-sm text-muted-foreground flex-1">
                  Нажми на карандаш ✏️ чтобы редактировать карточку. Загрузи
                  изображение, смени название или тип. Всего Кожно создать до{" "}
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
                      setCompressProgress("⏳ Загрузка данных...");

                      try {
                        const saved =
                          localStorage.getItem("arena-card-designs");
                        if (!saved) {
                          setCompressProgress("Нет данных для сжатия.");
                          setIsCompressing(false);
                          return;
                        }

                        const designs: CardDesign[] = JSON.parse(saved);
                        let compressedCount = 0;

                        // Функция сжатия Base64 картинки (PNG с прозрачностью)
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
                              resolve(canvas.toDataURL("image/png"));
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
                        <div className="flex flex-1 flex-col items-center justify-center p-1">
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
                        const r = new FileReader();
                        r.onload = (ev) =>
                          setDiceImageDataUrl(ev.target?.result as string);
                        r.readAsDataURL(f);
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

          {itemsTab === "cases" && (
            <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
              <div className="rounded-2xl border border-card-border bg-card p-5 space-y-4">
                <h2 className="font-display text-xl font-bold">Новый кейс</h2>
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
                    Вероятность выпадения / Редкость, %
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={caseRarity}
                      onChange={(e) => setCaseRarity(e.target.value)}
                      placeholder="Например: 70"
                      className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal"
                    />
                  </label>
                  <div>
                    <div className="mb-2 text-xs font-bold">
                      Предметы, которые Когут выпасть
                    </div>
                    <div className="grid gap-2">
                      {DROPPABLE_ITEMS.map((item) => (
                        <label
                          key={item}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={caseSelectedItems.includes(item)}
                            onChange={(e) =>
                              setCaseSelectedItems(
                                e.target.checked
                                  ? [...caseSelectedItems, item]
                                  : caseSelectedItems.filter((i) => i !== item),
                              )
                            }
                            className="h-3.5 w-3.5 accent-primary"
                          />
                          {item}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
                    Создать кейс
                  </button>
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
                  {cases.map((c) => (
                    <div
                      key={c.id}
                      className="relative rounded-xl border border-card-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm">{c.name}</div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            Вероятность:{" "}
                            <span className="font-bold text-primary">
                              {c.rarity}%
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setCases(cases.filter((x) => x.id !== c.id))
                          }
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      {(c.items ?? []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {(c.items ?? []).map((item) => (
                            <span
                              key={item}
                              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                      {(c.items ?? []).length === 0 && (
                        <div className="mt-2 text-[10px] text-muted-foreground italic">
                          Предметы не настроены
                        </div>
                      )}
                    </div>
                  ))}
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
                <div className="grid grid-cols-[1fr_200px] gap-0">
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
  const [users, setUsers] = useLocalStorage<AuthUser[]>("arena-users", []);
  const [settings] = useLocalStorage<AdminSettings>(
    "arena-admin-settings",
    defaultSettings,
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
      if (password === (settings.adminPassword || "admin123"))
        onSuccess({ kind: "admin" });
      else setError("Неверный пароль администратора.");
      return;
    }
    const existing = users.find(
      (u) => u.login?.toLowerCase() === cleanLogin.toLowerCase(),
    );
    if (!existing) {
      setError("Пользователь не найден. Зарегистрируйся.");
      return;
    }
    if (existing.password !== password) {
      setError("Неверный пароль.");
      return;
    }
    onSuccess({ kind: "player", user: existing });
  };

  const submitRegister = (event: FormEvent) => {
    event.preventDefault();
    const cleanLogin = regLogin.trim();
    if (cleanLogin.length < 3) {
      setError("Логин должен быть не Кенее 3 символов.");
      return;
    }
    if (regPassword.length < 4) {
      setError("Пароль должен быть не Кенее 4 символов.");
      return;
    }
    if (regPassword !== regConfirm) {
      setError("Пароли не совпадают.");
      return;
    }
    if (
      users.find((u) => u.login?.toLowerCase() === cleanLogin.toLowerCase())
    ) {
      setError("Этот логин уже занят.");
      return;
    }
    const user = makeAuthUser(cleanLogin, cleanLogin, regPassword);
    setUsers([...users, user]);
    onSuccess({ kind: "player", user });
  };

  const submitGuest = (event: FormEvent) => {
    event.preventDefault();
    const cleanName = nickname.trim();
    if (cleanName.length < 2) {
      setError("Никнейм должен быть длиннее двух символов.");
      return;
    }
    const existing = users.find(
      (u) => u.name.toLowerCase() === cleanName.toLowerCase(),
    );
    if (existing && !guestConfirm) {
      setGuestConfirm(true);
      setError("Никнейм занят. Подтверди или выбери другой.");
      return;
    }
    const user =
      existing || makeAuthUser(cleanName, undefined, undefined, true);
    if (!existing) setUsers([...users, user]);
    onSuccess({ kind: "player", user });
  };

  const fieldCls =
    "mt-2 w-full rounded-xl border border-[#d8ccba] bg-[#fffaf1] px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30";
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
            <form onSubmit={submitLogin} className="space-y-3">
              <label className={labelCls}>
                Логин
                <input
                  autoFocus
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Ваш логин"
                  className={fieldCls}
                />
              </label>
              <label className={labelCls}>
                Пароль
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Пароль"
                  className={fieldCls}
                />
              </label>
              <p className="text-[11px] leading-4 text-[#716b78]">
                Для входа в админ-панель используй логин <b>admin</b>.
              </p>
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
            <form onSubmit={submitRegister} className="space-y-3">
              <label className={labelCls}>
                Придумай логин
                <input
                  autoFocus
                  value={regLogin}
                  onChange={(e) => setRegLogin(e.target.value)}
                  placeholder="Минимум 3 символа"
                  className={fieldCls}
                />
              </label>
              <label className={labelCls}>
                Придумай пароль
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Минимум 4 символа"
                  className={fieldCls}
                />
              </label>
              <label className={labelCls}>
                Повтори пароль
                <input
                  type="password"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  placeholder="Повтори пароль"
                  className={fieldCls}
                />
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
                  placeholder="Например, Лада Север"
                  className={fieldCls}
                />
              </label>
              <p className="mt-3 text-[11px] leading-4 text-[#716b78]">
                Профиль сохранится на этом устройстве.
              </p>
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
}: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  children: ReactNode;
  name?: string;
  onLogin: () => void;
  onLogout: () => void;
  isAdmin?: boolean;
  gameMode?: boolean;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const items = isAdmin
    ? [
        { id: "dashboard" as Tab, label: "Главная", icon: LayoutDashboard },
        { id: "admin" as Tab, label: "Админ-панель", icon: ShieldCheck },
      ]
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
                  console.log("Клик по вкладке:", id); // <--- Добавь эту строку
                  setTab(id);
                  setMobileNav(false);
                }}
                className={`nav-pill flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium ${tab === id ? "bg-[#e96852] font-bold text-white shadow-lg shadow-[#e96852]/15" : "text-[#c1bac8] hover:bg-white/5 hover:text-white"}`}
              >
                <Icon size={14} />
                {label}
                {id === "friends" && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-[#e7ba68]" />
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
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70">
                  <UserRound size={13} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-bold">
                  {name || "Гость"}
                </div>
                <div className="font-mono text-[8px] text-[#aaa2b4]">
                  {isAdmin ? "ADMIN" : name ? "MA-4821" : "Войди"}
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
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span>
                {isAdmin ? "Защищённая сессия" : "Сервер клуба в норме"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-[20px] mr-[20px]">
            <button className="hidden rounded-lg p-1.5 text-muted-foreground hover:bg-muted sm:block">
              <CircleHelp size={16} />
            </button>
            <button className="relative rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
              <Bell size={16} />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <div className="flex items-center gap-2">
              {name ? (
                <>
                  <Avatar
                    initials={isAdmin ? "АД" : initials}
                    color={isAdmin ? "#e96852" : "#32786d"}
                    size="sm"
                  />
                  <span className="hidden text-xs font-bold sm:block">
                    {name}
                  </span>
                  <button
                    onClick={onLogout}
                    className="hidden rounded-lg border border-input px-2 py-1.5 font-bold sm:block text-[14px] border-t-[1.2px] border-r-[1.2px] border-b-[1.2px] border-l-[1.2px] pl-[15px] pr-[15px]"
                  >
                    Выйти
                  </button>
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
      {/* Изменено: w-[130px] заменено на w-[143px] (+10%) */}
      <aside className="flex w-[143px] shrink-0 flex-col bg-[#29233e] p-4 text-[#f7f0e3]">
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
  const [authOpen, setAuthOpen] = useState(false);
  const [pending, setPending] = useState<"create" | "find" | "join" | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
useEffect(() => {
    // Загружаем дизайны с сервера, если их ещё нет в localStorage
    fetch('/arena-card-designs.json')
      .then(res => res.json())
      .then(data => {
        const existing = localStorage.getItem('arena-card-designs');
        if (!existing) {
          localStorage.setItem('arena-card-designs', JSON.stringify(data));
        }
      })
      .catch(err => console.warn('Не удалось загрузить дизайны карточек:', err));
  }, []);

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
  const requestJoin = () => {
    if (isAuthed) {
      setGame(true);
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
      return;
    }
    if (result.user) {
      setPlayer(result.user);
      setAdminAuthed(false);
      localStorage.setItem("arena-nickname", result.user.name);
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
            <BoardGame onExit={() => setGame(false)} />
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
        break;
      case "friends":
        adminContent = <Friends />;
        break;
      case "shop":
        adminContent = <Shop />;
        break;
      case "profile":
        adminContent = <Profile onInventory={() => setTab("inventory")} />;
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
      >
        {adminContent}
      </AppShell>
    );
  }
  if (game)
    return (
      <>
        <GameShell name={player?.name}>
          <BoardGame onExit={() => setGame(false)} />
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

  const dashboard = (
    <Dashboard
      onTab={setTab}
      onJoinGame={requestJoin}
      onRequestCreate={requestCreate}
      onRequestFind={requestFind}
      createOpen={createOpen}
      findOpen={findOpen}
      onCloseCreate={() => setCreateOpen(false)}
      onCloseFind={() => setFindOpen(false)}
      playerName={player?.name}
    />
  );
  const content =
    tab === "dashboard" ? (
      dashboard
    ) : tab === "friends" ? (
      <Friends />
    ) : tab === "shop" ? (
      <Shop />
    ) : tab === "profile" ? (
      <Profile onInventory={() => setTab("inventory")} />
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
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Home />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
