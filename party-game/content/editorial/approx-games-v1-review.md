# GQ1 — игровые задания для режима «Примерно»

Режим «Примерно» использует вопросы типа number; категория `videogames` применяется как метка внутри общего словаря, без отдельного режима или темы.

**Версия:** `general@62`, 7 385 суммарных карточек и вопросов (+16 к `general@61`, 7 369). Ранее действующие 462 числовых задания сохраняются; в general@62 их будет 478.

## Редакторские условия

- 16 проверяемых числовых оценок: измеримые исторические продажи, аудитория платформ, время марафона, рекордный результат и масштабы строительства.
- Вопросы не содержат готовую формулу или компоненты для простой арифметики; нет вопросов на годы, число игроков стандартной команды или простое перечисление.
- Исторические точки отсчёта и кварталы прямо указаны в тексте; порог «более N» фиксируется как документированный округлённый рубеж, а не ложная точная величина.
- Все ответы имеют единицы, пояснения после раскрытия и первичные/авторитетные источники. Числа округлены редакционно.
- Сложность — редакторская оценка, не оценка реального опроса.
- Игровая логика, интерфейс, сохранения, 151 резервная VG6 и старые версии наборов не изменены.

## Добавленные вопросы

- `approx-23001`: **Сколько миллионов копий Minecraft было продано к октябрю 2023 года, согласно объявлению Mojang?** — 300 млн копий; easy; [источник](https://www.minecraft.net/en-us/15th-anniversary).
- `approx-23002`: **Сколько миллионов копий «Тетриса» было продано по всему миру к июню 2026 года по данным правообладателя?** — 520 млн копий; medium; [источник](https://tetris.com/news/the-tetris-company-celebrates-world-tetris-day).
- `approx-23003`: **Сколько миллионов консолей PlayStation 2 было продано по миру, по сводной статистике Sony?** — 160 млн консолей; easy; [источник](https://sonyinteractive.com/en/our-company/business-data-sales/).
- `approx-23004`: **Сколько миллионов приставок Nintendo Wii было продано за всё время, по отчёту Nintendo на июнь 2026 года?** — 101,6 млн консолей; medium; [источник](https://www.nintendo.co.jp/ir/en/finance/hard_soft/index.html).
- `approx-23005`: **Сколько миллионов копий Mario Kart 8 Deluxe было продано к июню 2026 года по данным Nintendo?** — 71,5 млн копий; medium; [источник](https://www.nintendo.co.jp/ir/en/finance/software/switch.html).
- `approx-23006`: **Сколько миллионов человек в среднем ежедневно пользовались Roblox во втором квартале 2025 года?** — 111,8 млн человек; medium; [источник](https://ir.roblox.com/news/news-details/2025/Roblox-Reports-Second-Quarter-2025-Financial-Results/default.aspx).
- `approx-23007`: **Сколько миллиардов часов пользователи провели в Roblox за второй квартал 2025 года?** — 27,4 млрд часов; hard; [источник](https://ir.roblox.com/news/news-details/2025/Roblox-Reports-Second-Quarter-2025-Financial-Results/default.aspx).
- `approx-23008`: **Сколько миллионов копий GTA V купили за первые сутки после выхода игры в сентябре 2013 года?** — 11,2 млн копий; medium; [источник](https://www.guinnessworldrecords.com/news/2013/10/confirmed-grand-theft-auto-breaks-six-sales-world-records-51900).
- `approx-23009`: **Сколько миллионов копий «Ведьмака 3» было продано к сентябрю 2026 года по отчёту CD Projekt?** — 65 млн копий; medium; [источник](https://www.cdprojekt.com/en/media/news/cd-projekt-red-wraps-up-the-first-half-of-2026/).
- `approx-23010`: **Сколько миллионов копий Elden Ring было продано к апрелю 2026 года по данным Bandai Namco?** — 30 млн копий; medium; [источник](https://www.bandainamcoent.com/news/elden-ring-live-action-adaptation-in-theaters-march-3-2028).
- `approx-23011`: **Сколько миллионов зарегистрированных аккаунтов Fortnite сообщала Epic Games в марте 2023 года?** — 500 млн аккаунтов; medium; [источник](https://www.epicgames.com/site/news/introducing-unreal-editor-for-fortnite-creator-economy-2-0-fab-and-more).
- `approx-23012`: **Какого пикового количества одновременных пользователей Steam достигла платформа, согласно обзору Valve за 2025 год?** — 42 млн пользователей; medium; [источник](https://steamcommunity.com/groups/steamworks/announcements/detail/528746884222682053).
- `approx-23013`: **Сколько часов продлился рекордный марафон в Dance Dance Revolution, зафиксированный Guinness в октябре 2024 года?** — 144 часов; easy; [источник](https://www.guinnessworldrecords.com/world-records/longest-video-games-marathon).
- `approx-23014`: **Сколько очков нужно для идеального результата в оригинальном Pac-Man, согласно Guinness?** — 3333360 очков; hard; [источник](https://www.guinnessworldrecords.com/world-records/first-highest-score-for-pac-man).
- `approx-23015`: **Сколько миллионов блоков потребовалось на гигантскую пирамиду в Minecraft, построенную Stone Titans в выживании?** — 2,63 млн блоков; hard; [источник](https://www.guinnessworldrecords.com/world-records/412520-largest-minecraft-pyramid-survival).
- `approx-23016`: **Сколько миллионов долларов заработала GTA V за первые 24 часа продаж в 2013 году, по Guinness?** — 815,7 млн долларов США; medium; [источник](https://www.guinnessworldrecords.com/world-records/88321-highest-revenue-generated-by-an-entertainment-product-in-24-hours).

## Проверки

Профильный `approx-games-v1.test.cjs` проверяет 16 новых ID, источники, недублирование, числовые ответы, сохранение всех 7369 прежних ID, отсутствие новых ID в старых наборах и общий валидатор. Runtime-артефакты генерируются штатным компилятором.
