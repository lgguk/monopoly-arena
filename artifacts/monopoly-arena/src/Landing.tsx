import {
  ArrowRight,
  Coins,
  Crown,
  Dice5,
  Palette,
  Sparkles,
  Store,
  Trophy,
  Users,
  Zap,
  MessageCircle,
} from "lucide-react";

export function Landing({
  onEnter,
  onLogin,
}: {
  onEnter: () => void;
  onLogin: () => void;
}) {
  const features = [
    {
      icon: Dice5,
      title: "Три режима игры",
      desc: "Классика на 2–5 игроков, Быстрая игра и Дуэль 1×1. Каждый найдёт свой формат.",
    },
    {
      icon: Palette,
      title: "Скины и кастомизация",
      desc: "Меняй внешний вид кубиков, фишек и карточек поля. Выделяйся за столом.",
    },
    {
      icon: Store,
      title: "Рынок предметов",
      desc: "Покупай, продавай и обменивайся скинами с другими игроками напрямую.",
    },
    {
      icon: Crown,
      title: "VIP-статус",
      desc: "+50% опыта и +20% Coins за партию, любые лобби, пароли на комнату.",
    },
    {
      icon: Users,
      title: "Друзья и чат",
      desc: "Добавляй друзей, общайся в общем и игровом чате, играйте вместе.",
    },
    {
      icon: Trophy,
      title: "Задания и уровни",
      desc: "Ежедневные и еженедельные квесты, прогрессивные уровни, награды.",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#1a1729] text-[#f7f0e3] antialiased">
      {/* ============ НАВИГАЦИЯ ============ */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#1a1729]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e96852] text-white">
              <Crown size={16} />
            </div>
            <div className="text-sm font-bold tracking-wide">
              MONO<span className="text-[#e7ba68]">ARENA</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEnter}
              className="hidden rounded-lg px-4 py-2 text-xs font-bold text-[#f7f0e3] hover:bg-white/5 sm:block"
            >
              Играть
            </button>
            <button
              onClick={onLogin}
              className="rounded-lg bg-[#e96852] px-4 py-2 text-xs font-bold text-white hover:brightness-95"
            >
              Войти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        {/* ============ HERO ============ */}
        <section className="pt-16 pb-8 text-center md:pt-24">
          <div className="mb-4 flex items-center justify-center gap-2 text-[#e7ba68]">
            <Sparkles size={14} />
            <span className="font-mono text-[10px] uppercase tracking-[.22em]">
              монополия онлайн
            </span>
          </div>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-[1.05] md:text-6xl">
            Монополия,
            <br />
            которая живёт <span className="text-[#e96852]">онлайн.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-6 text-[#a39cb1] md:text-base">
            Играй с реальными людьми, собирай монополии, прокачивай скины
            и общайся в чате. Бесплатно, без установки — прямо в браузере.
          </p>
          <div className="mt-8 flex justify-center">
            <button
              onClick={onEnter}
              className="flex items-center gap-2 rounded-xl bg-[#e96852] px-7 py-3.5 text-sm font-bold text-white transition hover:bg-[#d95c48]"
            >
              Играть бесплатно <ArrowRight size={16} />
            </button>
          </div>

          {/* Скриншот игрового стола */}
          <div className="relative mt-14">
            <div className="absolute inset-x-8 -bottom-6 h-32 rounded-full bg-[#e96852]/15 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#2a2340] to-[#1a1729] shadow-[0_20px_60px_rgba(0,0,0,.5)]">
              <img
                src="/hero-table.png"
                alt="Игровой стол Monopoly Arena"
                className="block aspect-[16/9] w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const sib = (e.currentTarget as HTMLImageElement)
                    .nextElementSibling as HTMLElement | null;
                  if (sib) sib.style.display = "flex";
                }}
              />
              <div className="hidden aspect-[16/9] w-full items-center justify-center">
                <div className="text-center">
                  <div className="text-7xl md:text-9xl">🎲</div>
                  <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[#7a7388]">
                    скриншот игрового стола появится здесь
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Мини-статистика под скрином */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-[#a39cb1]">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-[#e7ba68]" />
              <span>Без установки</span>
            </div>
            <div className="flex items-center gap-2">
              <Coins size={14} className="text-[#e7ba68]" />
              <span>Бесплатно</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={14} className="text-[#e7ba68]" />
              <span>2–5 игроков</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle size={14} className="text-[#e7ba68]" />
              <span>Живой чат</span>
            </div>
          </div>
        </section>

        {/* ============ ПРЕИМУЩЕСТВА ============ */}
        <section className="pt-20 pb-12">
          <h2 className="text-center font-display text-3xl font-bold md:text-4xl">
            Почему у нас интересно
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-[#a39cb1]">
            Классические правила Монополии — плюс онлайн-фишки, которых нет
            в настольной версии.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-2xl border border-white/5 bg-[#262038] p-5 transition-colors hover:border-[#e96852]/40"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e96852]/15 text-[#e96852]">
                    <Icon size={18} />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-5 text-[#a39cb1]">
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ============ ФИНАЛЬНЫЙ CTA ============ */}
        <section className="py-16 text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            Готов сесть за стол?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-[#a39cb1]">
            Регистрация занимает 30 секунд. Первая партия — уже через минуту.
          </p>
          <div className="mt-7 flex justify-center">
            <button
              onClick={onEnter}
              className="flex items-center gap-2 rounded-xl bg-[#e96852] px-7 py-3.5 text-sm font-bold text-white transition hover:bg-[#d95c48]"
            >
              Начать играть <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>

      {/* ============ ФУТЕР ============ */}
      <footer className="border-t border-white/5 bg-[#14121f] py-10">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e96852] text-white">
                <Crown size={14} />
              </div>
              <span className="text-xs font-bold text-[#f7f0e3]">
                MONO<span className="text-[#e7ba68]">ARENA</span>
              </span>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-[#7a7388]">
              Монополия — бесплатная онлайн-игра. Играй с друзьями прямо
              в браузере.
            </p>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#7a7388]">
              Игра
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-[#a39cb1]">
              <li>
                <button onClick={onEnter} className="hover:text-[#e96852]">
                  Начать игру
                </button>
              </li>
              <li>
                <button onClick={onEnter} className="hover:text-[#e96852]">
                  Правила
                </button>
              </li>
              <li>
                <button onClick={onEnter} className="hover:text-[#e96852]">
                  Как играть
                </button>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#7a7388]">
              Сообщество
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-[#a39cb1]">
              <li>
                <button onClick={onEnter} className="hover:text-[#e96852]">
                  FAQ
                </button>
              </li>
              <li>
                <button onClick={onEnter} className="hover:text-[#e96852]">
                  Об инвентаре
                </button>
              </li>
              <li>
                <button onClick={onEnter} className="hover:text-[#e96852]">
                  О нарушениях
                </button>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#7a7388]">
              Соцсети
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-[#a39cb1]">
              <li>
                <a href="#" className="hover:text-[#e96852]">
                  Telegram
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#e96852]">
                  VK
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t border-white/5 px-4 pt-6 text-center text-[10px] text-[#7a7388]">
          © {new Date().getFullYear()} Monopoly Arena. Все права защищены.
        </div>
      </footer>
    </div>
  );
}