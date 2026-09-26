# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Проєкт

**Proof of Rent** (коротко **PoR**) — паспорт довіри орендаря, проєкт на Solana-хакатоні у Варшаві (40 годин, **хакатон уже йде**).
Слоган: *"Your rent history. Your proof."* Пітч: *«Банк знає, що ти платив. Proof of Rent знає, в якому стані ти здав квартиру.»*

Паспорт = історія **завершених оренд**. Головний сигнал — результат кауції з ескроу (повернено повністю /
частково / рішення арбітра); щомісячні підтвердження оплат — другорядний сигнал. Цільовий ринок — Польща,
особливо іноземці без історії в BIK. Розробник один, код пишеться з AI.

Усі продуктові рішення (зафіксовані в grilling-сесії 2026-09-26), бізнес-модель, конкуренти і демо-сценарій —
у [ROADMAP.md](ROADMAP.md). Перед нетривіальною роботою читай відповідний розділ там.

**Стан:** скафолд із шаблону `solana-foundation/templates/kit/nextjs-anchor` (початковий коміт). Програма ще
шаблонна — `anchor/programs/vault` (SOL-vault), її замінюємо на програму Proof of Rent.

## Команди

```bash
npm install
npm run dev            # Next.js на localhost:3000
npm run setup          # anchor-build + codama:js
npm run anchor-build   # cd anchor && anchor build --ignore-keys   (запускати у WSL, див. нижче)
npm run anchor-test    # anchor build + cargo test — LiteSVM-тести в anchor/programs/*/src/tests.rs
npm run codama:js      # перегенерувати клієнт app/generated/ з IDL (codama.json)
npm run lint
npm run format         # prettier
npm run ci             # build + lint + format:check
```

Один тест: `cd anchor && cargo test <test_name>` (у WSL).

## Тулчейн: Rust/Solana/Anchor — тільки у WSL

На Windows немає Rust/Solana/Anchor. Все встановлено у **WSL Ubuntu 24.04**:
rustc 1.98, solana-cli 3.0 (Agave), anchor-cli 1.1.2 через avm (1.2.0 теж стоїть), surfpool.
Node є і на Windows (v24), і у WSL (v22). `npm run dev` / `lint` / `codama:js` працюють на Windows;
`anchor-build` / `anchor-test` / `setup` — лише у WSL. Префікс `NO_DNA=1` вимикає інтерактивні промпти Anchor:

```bash
wsl -d Ubuntu -- bash -lc "cd /mnt/c/Programming/SOL/proof-of-rent && NO_DNA=1 npm run anchor-test"
```

- У Git Bash додавай `MSYS_NO_PATHCONV=1` перед `wsl`, інакше шляхи й `$змінні` ламаються. Для складних команд
  надійніше записати `.sh` у scratchpad і запустити `wsl -d Ubuntu -- bash -l /mnt/c/.../script.sh`.
- Cargo на `/mnt/c` повільний; якщо збірка стане вузьким місцем — перенести репо у файлову систему WSL.
- Git у цій папці скаржиться на «dubious ownership» (папку створено від адміністратора): використовуй
  `git -c safe.directory='*' ...` або попроси користувача додати `safe.directory`.
- `Anchor.toml`: cluster = devnet, гаманець `~/.config/solana/id.json` (у WSL). Тільки devnet/localnet.

## Стек

- **Веб, mobile-first** (Next.js 16, React 19, Tailwind 4), не нативна апка: паспорт відкривається за посиланням
  без встановлення. Камера для фото — `<input type="file" accept="image/*" capture="environment">`.
- **`@solana/kit` 6.x** з шаблону. Скіл `solana-dev` радить Kit 8 plugin-клієнти — **не оновлювати під час хакатону**,
  пиши в стилі, який уже є в `app/lib/`.
- **Гаманець: Privy** (embedded, вхід через Google) замість wallet-standard з шаблону (`app/lib/wallet/`).
  Орендар лише **підписує**; бекенд додає підпис **fee payer** і відправляє — у користувача 0 SOL.
  Клей до Kit: `@solana/keychain-privy`. Перша задача — spike на ≤1 год (Google-вхід → підпис → бекенд
  платить і шле на devnet); якщо не злетить — Phantom Connect без fee payer.
- **Бекенд:** API-роути того ж Next.js на Vercel (fee payer, завантаження фото). Окремого сервера немає.
- **Фото протоколу:** Vercel Blob (непублічні URL); on-chain лише SHA-256 хеш (`crypto.subtle` у браузері).
- **Токен кауції:** mint зберігається в `Lease` (токен-агностично); на демо — devnet USDC.

## Архітектура

Зміна в програмі завжди проходить усі шари: **Anchor-програма → IDL (`anchor/target/idl`) → `npm run codama:js`
→ клієнт `app/generated/<program>/` (генерується, руками не редагувати) → хуки/компоненти в `app/`**.
Відправка транзакцій у шаблоні — `app/lib/hooks/use-send-transaction.ts`, клієнт — `app/lib/solana-client.ts`.

Доменна модель програми (деталі інструкцій — ROADMAP.md → MVP):
- `Lease` PDA — **орендар створює** оренду і вносить кауцію у vault; орендодавець лише приймає (`accept`).
  Поля: tenant, landlord, arbiter (дефолт — ключ платформи, сторони можуть задати свого), mint, суми, дати,
  дедлайн прийняття, `return_timeout`, вікно заперечень оплати, хеші протоколу заїзду/виїзду, статус і результат.
- Vault — токен-акаунт кауції, власник — PDA оренди.
- `RentRecord` PDA на (оренда, місяць) — **оптимістичне підтвердження**: орендар заявляє «оплатив», орендодавець
  може заперечити протягом вікна. Стан «без заперечень» **обчислюється при читанні** (вікно минуло, спору нема) —
  без крону й окремої транзакції. Явне підтвердження орендодавцем — сильніший рівень.
- Паспорт — не акаунт, а агрегація `Lease` + `RentRecord` за гаманцем орендаря (публічна сторінка + QR).
  Рейтинг орендодавця — та сама агрегація за гаманцем орендодавця.

Інваріанти:
- Кошти виходять з vault лише так: повне повернення орендодавцем, прийнятий settlement, `resolve` арбітра,
  claim орендаря після `return_timeout`, повернення орендарю, якщо орендодавець не прийняв умови вчасно.
  Будь-який новий шлях — зміна безпеки, спершу planner.
- **Жодних персональних даних on-chain** (імена, адреси, IBAN, фото) — тільки хеші та pubkey (GDPR).
- Кожне часове вікно — параметр конкретної оренди, не константа: демо тримається на 30–60-секундних вікнах.
- Оренда рахується в паспорті лише від 3 місяців; тривалість і профіль орендодавця показуються (анти-фейк).
- Оплата самої оренди — звичайним банківським переказом, **не** через контракт (USDC-оренда вирізана з MVP).

## Агенти та скіли проєкту

- `.claude/agents/planner.md` (opus, лише читає) → план; `.claude/agents/implementer.md` (sonnet) → виконує план.
  Нетривіальні зміни програми чи грошових потоків: спершу planner.
- `solana-dev` — офіційний скіл Solana Foundation (MIT, v2.5.0). Є у двох місцях: `.claude/skills/` (Claude Code)
  і `.agents/skills/` + `skills-lock.json` (встановлено `npx skills add`, для інших агентів). Джерело правди для
  Anchor/Codama/LiteSVM і безпеки. Скіл пропонує підключити Solana MCP
  (`claude mcp add --transport http solana-mcp-server https://mcp.solana.com/mcp`) — лише за згодою користувача.
- `grilling` / `grill-me` (з Barvex) — стрес-тест рішень питаннями по одному.
- `impeccable` (з Barvex) — дизайн і полірування UI; потребує Node. Спершу `/impeccable init` (PRODUCT.md).

## Мова

Документація та спілкування — українською. Код, ідентифікатори, коміти — англійською.
