# TASK029 — Android wizard responsiveness

> Исторический отчёт: описанное ниже переключение интерфейсов относится к указанным в отчёте прежним SHA. В кандидате [TASK030](../../party-game/TASK030-WIZARD-ONLY.md) переключатели и маршрут `setup=legacy` удалены. Публикация TASK030 требует отдельного разрешения.

Issue [#153](https://github.com/Demian-rus/quantum-portal/issues/153). Baseline: published main `8dd989f4017fa48d4279f243d13012ade1710a63`. TASK027 is already accepted. TASK028 PR #152 is a separate Draft and is not modified by this task. This branch is a candidate: no merge or PWA publication is authorized.

## Measurement protocol

`mobile-perf.cjs` serves an immutable `git archive` of the baseline and the candidate from separate local HTTP origins on the same Actions runner. Both variants use the same Chrome process/version, hardware, Pixel7 Android13 UA, mobile/touch flags, DPR2.625, input protocol, counters, and sample count. Source data, profiles and game controllers are real. Test profiles are explicitly provisioned through the existing controller; no production user data is accessed.

- CSS viewports: **320×568, 390×844, 412×915, 844×390**. `isMobile:true`, `hasTouch:true`, Android UA; every measured input must be a trusted `pointerType=touch`. Assert exact inner dimensions/DPR, coarse pointer, no hover and touch capability. Environment JSON and mobile screenshots are saved before timing.
- CPU **1× and 4×**, separate network loading (CDP bypasses SW and HTTP cache) and native Service Worker precache **offline** loading. Service Workers remain enabled. Assert actual SW responses in offline cases.
- **20** samples for each transition/configuration. Warm = untimed complete route then repeated navigation. Cold = new document/JS realm after reload, with installed PWA data retained. This is not an OS/device cold restart. Navigation Timing/FCP and DOM readiness are separate from transition timings; warmed navigation is not called startup time.
- From the browser's trusted pointerdown timestamp to the correct DOM, completed finite root entrance animation, next animation frame and after-paint task. Playwright scroll/actionability before the actual tap is excluded. This is a conservative rendered-frame proxy, not physical screen presentation telemetry. Event Timing is recorded where Chrome exposes it.
- Report nearest-rank median/p95/max, ScriptDuration, RecalcStyleDuration, LayoutDuration, TaskDuration, Long Tasks and blocking time. One separately traced representative route per case includes Paint/Raster/Layout/Layerize and user-timing interval marks. CPU profiler and function-call instrumentation run in a separate attribution pass, outside the statistical timing loops. Inclusive function times must not be added together.
- Both interfaces are measured under matching conditions. Legacy has no four-step Start summary: do not invent a legacy equivalent for that transition. Its existing finite scene animations are included and reported separately from JS work.

Main transitions: menu→catalog, standard→players, players→rules, rules→Start, each reverse step, mode settings open/close, themes open/select/back and return to standard. The route ends in standard configuration for both interfaces. All samples, startup records, network/SW evidence, environment, PNGs, trace JSON and `.cpuprofile` are Actions artifacts. Paired before/after numbers for the tested runtime Head are recorded below and in the Draft PR, not extrapolated from different runners.

## Measured cause before changing runtime

The first diagnostic commits change only diagnostics/workflows. The n20 profile [run40462028440](https://github.com/Demian-rus/quantum-portal/actions/runs/40462028440), [artifact12715357399](https://github.com/Demian-rus/quantum-portal/actions/runs/40462028440/artifacts/12715357399), serves the exact baseline. Chrome155, AMD EPYC7763, four logical cores; Android touch 390×844/DPR2.625, CPU4, warmed network:

| Transition | Median / p95 / max, ms | Median JS, ms |
| --- | --- | --- |
| Catalog → players | 1004.9 / 1022.7 / 1038.7 | 977.98 |
| Players → rules | 529.2 / 545.4 / 550.5 | 494.44 |
| Rules → Start | 520.7 / 537.1 / 538.3 | 490.53 |
| Start → rules | 523.4 / 541.6 / 560.7 | 490.33 |
| Rules → players | 514.8 / 539.5 / 555.6 | 493.84 |
| Mode settings open | 1055.3 / 1085.0 / 1128.2 | 1003.88 |

For one full attribution route: `checkContentPack`86 calls/8251.7ms inclusive; `getPackCardPool`507/7873.2ms inclusive. V8 stacks place the time under `show → legacy.renderOptions → checkContentPack/getPackCardPool`. Standard selection renders through `openSetup`, then `show` repeats the whole renderer. Opening mode rules calls `modeRules` from both `renderMeta` and `show`. 1187 of1518 observed mutations target hidden elements. By comparison, selected-player checks total1.8ms and profile rendering13ms. Representative style/layout/paint each take single-digit milliseconds on ordinary transitions; no material codec decode appears on the main forward steps in their warm trace. Small worker image-cache tasks do occur (up to 0.16 ms per transition in the inspected trace); they are not the source of the main-thread stall.

Blur ablation is n20 on the same pilot: catalog→players1000.3/1021.2ms; players→rules519.5/530.2ms. This does not account for the main delay. **SwiftShader is the runner GPU**: this comparison cannot rule out a different blur cost on a physical Android GPU. The owner's physical2–4s observation is not claimed to be reproduced exactly: the measured emulator delay is about0.5–1s on these ordinary actions. A separate n1 exploratory trace is explicitly not acceptance statistics.

## Local fix and correctness boundaries

Only `setup-wizard.js` changes production behavior. Existing48 controllers, all catalogs/historical versions, game CSS, RNG, scoring, profiles, storage and START handler remain byte-exact.

The adapter retains the last real settings render stamp: all current settings except unused pack-preference history, selected profile IDs/problem, profile-store reference, catalog references and config/validator function identities. Pure presentation navigation does not discard real validated state. Initial mode tiles copy the live checked/disabled/reason/art/points state from the controls that `app.boot` has already rendered. Missing future controls invalidate the stamp and run the real renderer. Changed settings/profile/config/catalog references refresh normally; legacy mode always invokes its unchanged renderer.

During a needed synchronous settings render only, identical default card-pool requests share one read-only result. Custom card/registry arguments delegate unchanged. The function is restored in `finally` before metadata or extension events; no cache reaches START, task selection or gameplay. This memo has no lifetime beyond one UI render. Mode rule descriptions use the real mode-toggle availability already computed by that renderer; song-source validation still runs. The duplicate center render is removed. No validation is disabled and no new storage is introduced.

TASK028's `renderMeta` extension event remains after metadata rendering and outside the temporary pool memo. Existing IDs, functions, mode registry and START button are retained. Integrating PR #152 later still requires its own rebase, resource-version reconciliation and full CI; this task does not alter its branch.

## Regression and delivery

`task029-browser.cjs`: true Android/touch/DPR profile at CPU4; n20 forward/reverse real taps; require **zero** repeated content validation/pool requests on pure steps, independently of CPU speed. Median≤200ms and p95≤350ms are conservative CI guards for this fixed profile, not an Android device guarantee. Report max/Long Tasks and all raw samples; one scheduling outlier is not hidden by asserting only a maximum. Real setting/profile/language changes and invalid input still validate; START validates afresh with the original pool function; legacy/data/offline behavior is checked. Existing TASK027 functional tests remain strict.

`task029-upgrade-browser.cjs`: actual published v90 SW → candidate → exact v90 rollback → candidate, native cache activation and cold offline each time, exact duel/profiles/earned history/paused timer. Candidate cache `kvip-pwa-v90-20261027-wizard-performance-candidate`, JS queryv2; 49 JS resources. The cache name indicates an unpublished candidate.

All original Logic/Browser/Mobile/PWA/Gameplay/Smoke remain mandatory. Final measured before/after, CI links, measured runtime Head and artifacts are recorded below and in the Draft PR report. Do not declare success from functional tests alone. Physical Android owner acceptance remains necessary after separately authorized deployment.

Rollback: `?setup=legacy` or “ПРЕЖНИЙ ВИД” preserves data. Full release rollback uses a separately reviewed revert of TASK029 plus a unique SW cache for the restored bundle; never clear site data. The current-v90 rollback test verifies this source/schema boundary without publishing anything.

<!-- TASK029_FINAL_RESULTS -->

## Статус завершения

**Измеренный и полностью проверенный runtime: `1b0093aa6edb391b6b8fd6f2f2f124bb3bb96cf7`.** Последующий коммит изменяет только этот Markdown-документ. В соответствии с указанием владельца тесты и матрица для документации повторно не запускаются; все шесть успешных CI ниже относятся к неизменённому runtime. Актуальный Head документации указан в PR #154.

TASK 029 готова к независимой проверке архитектором. Исправление производительности подтверждено мобильными измерениями. Публикация не выполнялась. PR остаётся Draft.

## Подтверждённый network-профиль, 390×844, CPU 4×, warm

20 повторений на переход; каждая пара на одном runner. Медиана/p95, мс. [Исходные данные и трассы профильного job](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717235488). Это отдельный парный job, его числа не смешиваются с другими runner или с PWA-профилем ниже.

| Переход | До | После |
| --- | ---: | ---: |
| Игра → Кто играет? | 798.3/807.7 | 47.0/47.7 |
| Кто играет? → Правила | 422.7/434.1 | 47.2/47.9 |
| Правила → Старт | 416.4/423.6 | 46.1/47.2 |
| Центр настроек режимов | 839.6/855.5 | 56.1/58.5 |

## Окончательный технический отчёт TASK029

Draft PR [#154](https://github.com/Demian-rus/quantum-portal/pull/154). База `8dd989f4017fa48d4279f243d13012ade1710a63`; **измеренный runtime Head** `1b0093aa6edb391b6b8fd6f2f2f124bb3bb96cf7`. Последующее дополнение Markdown не меняет этот runtime; CI и все числа ниже относятся к этому SHA. Код остановлен после проверки. Merge/Ready/публикация PWA не выполнялись. Main и PR #152 не изменены.

**Основная блокировка JS между шагами устранена.** В 32 конфигурациях Мастера медианы трёх основных шагов после исправления 45.8–57.5мс; худший p95 71.8мс. Ниже — не сравнение разных runner: каждую пару до/после выполняет один Chrome на одном runner. Полная матрица:16jobs,128cases,40 960 trusted touch measurements. В каждой строке20 повторений; один n1 exploratory trace не включён в статистику.

### Основной профиль: 390×844, CPU4×, PWA offline, прогретая навигация

В ячейке **медиана / p95 / максимум**, миллисекунды. Δ<0 означает сокращение времени.

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| Игра → Игроки | 976.5/1012.5/1016.2 | 47.1/50.2/50.3 | -95.2% |
| Игроки → Правила | 507.3/521.2/537.4 | 52.7/65.8/69.4 | -89.6% |
| Правила → Старт | 509.6/525.8/529.1 | 46.1/49.6/50.7 | -91.0% |
| Старт → Правила | 508.3/529.5/536.2 | 55.2/59.7/63.7 | -89.1% |
| Правила → Игроки | 510.1/523.5/532.3 | 46.1/49.7/51.3 | -91.0% |
| Настройки режимов: открыть | 1025.5/1046.0/1050.7 | 61.8/67.8/73.4 | -94.0% |
| Меню → Игра | 641.1/677.3/688.4 | 170.6/177.3/177.9 | -73.4% |
| Игра → Темы | 634.8/652.0/668.9 | 181.1/198.2/203.7 | -71.5% |
| Вернуть стандартный набор | 979.7/1013.5/1016.2 | 127.1/140.8/140.8 | -87.0% |

### Мобильная среда и метод

Pixel7/Android13 UA, Chrome155.0.8059.39, isMobile=true, hasTouch=true, DPR2.625. CSS viewports320×568 /390×844 /412×915 /844×390, соответствующие innerWidth/innerHeight/visualViewport, scale1. Touch/coarse/no-hover проверены, каждый измеренный input isTrusted=true и pointerType=touch. Landscape сообщает landscape-primary и short-height media query. PNG и environment JSON сняты до таймингов. В разных jobs используются AMD EPYC7763 или9V74, четыре logicalcores; GPU SwiftShader. Пары до/после внутри каждого job имеют один и тот же аппаратный/браузерный контекст.

CPU1×/4×; отдельные network (SW bypass и отключён HTTPcache) и native SW-cache при полностью отключённой сети. SW не отключён. Cold=перезагруженный документ/JSrealm, warm=навигация после полного прохода прогрева. Это не физический запуск Android/WebAPK и не очистка ОС-кешей. Загрузка документа/FCP записаны отдельно от нажатий; startup DOM-ready не называется завершённым физическим показом экрана. У прогретой серии один исходный document load, а переходов20.

Интервал: browser timestamp реального pointerdown → правильное DOM-состояние → конечная анимация корневого экрана → следующий frame и задача после paint. Это консервативный proxy отрисованного кадра, не телеметрия физического дисплея. Автоматический scroll/actionability Playwright до самого input не входят в интервал. JS/style/layout/task измерены CDP во всех20samples, Long Tasks/TBT и доступный EventTiming сохранены. Paint/Raster — отдельный трассируемый навигационный проход; это не20 paint-профилей и не трасса загрузки ОС. CPU/call instrumentation отделена от статистических циклов. Переход1→2 измерен нажатием плитки «Стандартная игра»;2→3 и3→4 — кнопкой «ДАЛЕЕ». Обратные переходы измерены кнопками интерфейса, а не аппаратным жестом Android.

### Доказанная причина и исправление

До изменения runtime выполнен n20 профиль точного main. Стек: show → legacy.renderOptions → checkContentPack/getPackCardPool. Стандартный выбор дублировал renderer через openSetup и show; modeRules вызывался и из renderMeta, и из show. В отдельном полном attribution route на одном runner:86 checkContentPack /507 построений пулов,19 profile-render вызовов,1187/1518 мутаций в скрытых элементах. После:31 /154 /3 и526/731 соответственно. Это inclusive времена; вложенные суммы не складываются.

На основном PWA-профиле JS catalog→players950.46→4.13мс, TBT906→0мс; next step471.90→3.57мс, TBT435→0. Профиль выбранных игроков в первоначальном route занимает1.8мс всего. Blur ablation n20 на том же пилоте не удаляет задержку:1004.9/1022.7→1000.3/1021.2мс для catalog→players. На физический Android GPU это заключение не переносится. В rawtrace встречаются worker-задачи обслуживания image-decode-cache (до0.16мс на переход), не main-thread задержка сотен мс; на трёх прямых шагах таких задач нет. Декод-кеш bookkeeping не следует принимать за повторную тяжёлую декодировку.

Production-поведение изменяет только setup-wizard.js: штамп последней настоящей отрисовки/валидации, перенос live checked/disabled/reason/art/points в плитки, отсутствие полного renderer на чистой навигации, обновление при изменённых настройках/профилях/config/validator/catalog references. Неиспользуемая история packPreferences не инвалидирует текущую форму. Одинаковые readonly default card-pool запросы разделяются только внутри одной синхронной нужной UIотрисовки; в finally восстановлен исходный selector до metadata/hooks/START. Custom cards/registry не кешируются. Центр правил рисуется один раз и использует настоящую доступность переключателей; RU/EN продолжает проверяться.

START,48 старых контроллеров, каталоги/исторические версии, правила/RNG/очки, профили/статистика/backup/RAW, accepted style.css и игровая сцена не изменены. Legacy всегда вызывает свой исходный renderer. JS queryv2 и уникальный кандидатный SWcache обеспечивают обновление; новой схемы/ключей данных нет.

### Проверки и ограничения

Все шесть workflow на Head `1b0093aa6edb391b6b8fd6f2f2f124bb3bb96cf7` — SUCCESS. Logic405/405, Gameplay/Smoke13/13 для обоих событий. Browser включает новые AndroidCPU4n20 guard-тесты: ноль повторной валидации/пулов на чистых шагах независимо от CPU, median≤200/p95≤350мс как консервативный CIguard (фактически≤66мсp95 в двух функциональных runs), реальные изменения settings/profile/languages/invalid input и fresh START. Старые functional/geometry/back/offline/profile/history/backup проверки сохранены без ослабления.

Native SW: published v90→fix→exact v90 rollback→fix, cold offline,49 JS, точные RAW/профили/заработанная история/pausedtimer. UI opt-out через ?setup=legacy не записывает данные. Полный откат — отдельный проверенный revert+уникальный cache, не очищать site data.

**Бюджет достигнут для основной шаговой навигации.** Первый вход в каталог в самом медленном холодном CPU4-профиле остаётся229.5мсmedian /241.2мсp95: preview-валидация каталогов и первая сборка UI не удалены. Открытие тем достигает208.6мсp95; эти места отражены в таблицах, не объявлены повсеместно быстрее200мс. Возврат на главный экран сохраняет старую конечную анимацию около400мс (около430мс с кадровым proxy), JS там≈2мс. Реальная валидация START сохранена, запуск партии не подменён имитацией.

Физического Android/remote-debugging нет. Linux/SwiftShader, эмулированный touch, localhost и CPU-rate относительно runner не воспроизводят ARM, realGPU, thermal/power/input pipeline, реальную сеть и standalone/WebAPK launcher. 2–4с владельца не заявляются воспроизведёнными ровно: до фикса измерено примерно0.5–1с на обычных шагах в CPU4 профилях. Нужна отдельная физическая Android-приёмка после разрешённого развёртывания. Дополнительную разработку не начинаем.

Read-only merge-tree с PR152 подтверждает чистое объединение setup-wizard.js, синтаксис, format IDs/event/fastrefresh; branch/index/PR152 не менялись. Ресурсы/cache и их текущие test expectations потребуют согласования при будущем rebase152 и собственного CI. Полная командная интеграция в TASK029 не заявляется.

### CI

| Событие | Logic/Browser/Mobile/PWA | Gameplay/Smoke | Android performance |
| --- | --- | --- | --- |
| push | [SUCCESS40465704951](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704951) | [SUCCESS40465704790](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704790) | [SUCCESS40465704794](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794) |
| pull_request | [SUCCESS40465809211](https://github.com/Demian-rus/quantum-portal/actions/runs/40465809211) | [SUCCESS40465809142](https://github.com/Demian-rus/quantum-portal/actions/runs/40465809142) | [SUCCESS40465809145](https://github.com/Demian-rus/quantum-portal/actions/runs/40465809145) |

### Скриншоты и трассы

Каждый artifact содержит before/after PNG, environment JSON, полный report.json со startup и20rawsamples на переход, отдельные representative trace.json. Профильный artifact дополнительно содержит .cpuprofile. Снимки четырёх after-размеров просмотрены. Все artifacts из exact pushHead, ZIP SHA256 проверены при скачивании.

| Экран | PWA CPU4: PNG/данные/трассы | CPU1 network | CPU4 network | CPU1 PWA |
| --- | --- | --- | --- | --- |
| 320×568 | [artifact12717580819](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717580819) | [artifact12717002010](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717002010) | [artifact12717486032](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717486032) | [artifact12717191199](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717191199) |
| 390×844 | [artifact12717706792](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717706792) | [artifact12717072006](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717072006) | [artifact12717266819](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717266819) | [artifact12717315248](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717315248) |
| 412×915 | [artifact12717733818](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717733818) | [artifact12718200033](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12718200033) | [artifact12717694800](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717694800) | [artifact12718120320](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12718120320) |
| 844×390 | [artifact12718068964](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12718068964) | [artifact12717457685](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717457685) | [artifact12718382288](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12718382288) | [artifact12717517928](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717517928) |

[CPU-профили/счётчики/blur A-B](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704794/artifacts/12717235488) · [полный функциональный Browser artifact](https://github.com/Demian-rus/quantum-portal/actions/runs/40465704951/artifacts/12717224030).

### Холодная загрузка документа отдельно от нажатий

NavigationTiming loadEventEnd, медиана/p95,мс; n20 для каждой пары. Это загрузка JS/документа и исходный boot, не время OSlauncher и не время следующей кнопки.

| Viewport | CPU | Источник | До | После |
| --- | --- | --- | ---: | ---: |
| 320×568 | 1× | network | 290.6/355.2 (n=20) | 289.4/312.8 (n=20) |
| 320×568 | 1× | pwa-offline | 156.8/171.8 (n=20) | 155.8/171.3 (n=20) |
| 320×568 | 4× | network | 550.5/598.0 (n=20) | 552.6/599.8 (n=20) |
| 320×568 | 4× | pwa-offline | 643.9/666.9 (n=20) | 638.2/665.2 (n=20) |
| 390×844 | 1× | network | 295.6/350.4 (n=20) | 309.9/325.6 (n=20) |
| 390×844 | 1× | pwa-offline | 208.1/239.9 (n=20) | 209.4/227.6 (n=20) |
| 390×844 | 4× | network | 867.0/1007.7 (n=20) | 867.5/893.0 (n=20) |
| 390×844 | 4× | pwa-offline | 853.8/913.4 (n=20) | 869.4/903.1 (n=20) |
| 412×915 | 1× | network | 302.3/338.1 (n=20) | 298.1/326.2 (n=20) |
| 412×915 | 1× | pwa-offline | 273.1/361.9 (n=20) | 270.5/293.4 (n=20) |
| 412×915 | 4× | network | 910.5/994.3 (n=20) | 904.1/928.6 (n=20) |
| 412×915 | 4× | pwa-offline | 574.3/642.7 (n=20) | 580.4/612.8 (n=20) |
| 844×390 | 1× | network | 235.3/273.9 (n=20) | 225.1/245.6 (n=20) |
| 844×390 | 1× | pwa-offline | 169.8/193.5 (n=20) | 169.7/189.0 (n=20) |
| 844×390 | 4× | network | 537.1/585.2 (n=20) | 548.2/610.4 (n=20) |
| 844×390 | 4× | pwa-offline | 867.1/911.9 (n=20) | 842.7/874.1 (n=20) |

<details>
<summary>Все 32 конфигурации Мастера: каждый переход, до/после, median/p95/max</summary>

Коды переходов для компактных таблиц; в каждой ячейке median/p95/max, мс.

| Код | Переход | JSON label |
| --- | --- | --- |
| T01 | Меню → Игра | home_catalog |
| T02 | Игра → Игроки | catalog_players |
| T03 | Игроки → Правила | players_rules |
| T04 | Настройки режимов: открыть | rules_modes |
| T05 | Настройки режимов: закрыть | modes_rules |
| T06 | Правила → Старт | rules_start |
| T07 | Старт → Правила | start_rules_back |
| T08 | Правила → Игроки | rules_players_back |
| T09 | Игроки → Игра | players_catalog_back |
| T10 | Игра → Темы | catalog_themes |
| T11 | Тема → Игроки | themes_players |
| T12 | Тема: Игроки → Игра | theme_players_catalog_back |
| T13 | Темы повторно | catalog_themes_again |
| T14 | Темы → Игра | themes_catalog_back |
| T15 | Вернуть стандартный набор | catalog_standard_switch |
| T16 | Стандарт: Игроки → Игра | standard_players_catalog_back |
| T17 | Игра → Меню | catalog_home_back |

#### 320×568, CPU1×, network, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 175.8/188.2/190.0 | 64.3/71.4/71.6 | -63.4% |
| T02 | 245.2/260.4/260.8 | 48.0/48.1/48.3 | -80.4% |
| T03 | 135.4/138.8/156.3 | 48.2/48.3/48.4 | -64.4% |
| T04 | 252.7/272.5/291.9 | 42.2/44.6/46.0 | -83.3% |
| T05 | 132.9/134.5/135.4 | 47.8/48.1/48.2 | -64.0% |
| T06 | 132.0/138.2/140.7 | 48.0/48.1/48.2 | -63.6% |
| T07 | 132.2/134.5/136.4 | 48.0/48.1/48.3 | -63.7% |
| T08 | 132.1/138.3/145.2 | 47.9/48.0/48.1 | -63.7% |
| T09 | 131.3/136.9/144.5 | 47.9/48.1/48.1 | -63.5% |
| T10 | 165.6/168.4/169.3 | 52.6/54.2/59.9 | -68.2% |
| T11 | 47.9/49.2/50.4 | 47.8/48.2/48.2 | -0.2% |
| T12 | 48.0/48.2/48.2 | 48.0/48.2/48.3 | +0.0% |
| T13 | 68.0/70.9/71.1 | 51.1/52.3/53.0 | -24.9% |
| T14 | 48.0/48.1/48.1 | 48.1/48.2/48.2 | +0.2% |
| T15 | 246.3/258.9/261.0 | 48.0/48.2/48.2 | -80.5% |
| T16 | 130.1/130.7/140.0 | 48.0/48.2/48.4 | -63.1% |
| T17 | 430.8/431.1/431.2 | 431.3/431.5/431.6 | +0.1% |

#### 320×568, CPU1×, network, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 160.5/163.6/165.2 | 50.8/52.3/53.0 | -68.3% |
| T02 | 238.5/241.3/245.8 | 47.9/48.2/48.3 | -79.9% |
| T03 | 129.8/131.7/131.8 | 48.0/48.2/48.3 | -63.0% |
| T04 | 249.7/254.2/254.9 | 47.0/47.3/47.4 | -81.2% |
| T05 | 130.1/132.9/134.5 | 47.7/47.9/48.0 | -63.3% |
| T06 | 128.9/130.9/131.3 | 47.8/48.1/48.4 | -62.9% |
| T07 | 129.6/131.8/147.0 | 48.0/48.2/48.3 | -63.0% |
| T08 | 129.3/132.0/132.0 | 47.7/48.0/48.3 | -63.1% |
| T09 | 128.0/130.0/132.0 | 47.9/48.1/48.1 | -62.6% |
| T10 | 160.7/164.2/164.7 | 52.5/55.9/58.9 | -67.3% |
| T11 | 47.8/48.8/48.8 | 47.7/48.3/48.4 | -0.2% |
| T12 | 47.9/48.3/48.3 | 47.9/48.1/48.1 | +0.0% |
| T13 | 60.8/68.8/72.3 | 51.5/53.6/55.7 | -15.3% |
| T14 | 47.9/48.2/48.2 | 48.0/48.2/48.5 | +0.2% |
| T15 | 242.4/247.2/253.1 | 47.7/48.1/48.2 | -80.3% |
| T16 | 127.7/128.7/128.9 | 47.9/48.2/48.2 | -62.5% |
| T17 | 430.8/431.1/431.2 | 431.2/431.5/431.6 | +0.1% |

#### 320×568, CPU1×, pwa-offline, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 114.7/120.3/147.8 | 49.4/53.0/72.1 | -56.9% |
| T02 | 136.4/152.2/157.1 | 48.7/48.9/48.9 | -64.3% |
| T03 | 80.9/96.7/99.2 | 48.9/49.0/49.0 | -39.6% |
| T04 | 151.1/164.7/171.1 | 45.7/47.7/48.1 | -69.8% |
| T05 | 78.4/92.0/92.5 | 48.6/48.9/49.0 | -38.0% |
| T06 | 77.7/90.2/90.4 | 48.8/48.9/48.9 | -37.2% |
| T07 | 78.3/90.0/101.1 | 48.8/49.0/49.5 | -37.7% |
| T08 | 77.7/93.3/117.5 | 48.7/48.8/48.8 | -37.3% |
| T09 | 78.2/90.0/91.0 | 48.8/48.9/49.0 | -37.6% |
| T10 | 110.1/115.1/127.1 | 48.8/48.9/50.5 | -55.7% |
| T11 | 48.7/48.9/49.0 | 48.5/48.9/48.9 | -0.4% |
| T12 | 48.8/49.5/49.7 | 48.8/49.0/49.2 | +0.0% |
| T13 | 48.8/54.2/84.6 | 48.8/49.0/49.0 | +0.0% |
| T14 | 48.8/49.0/49.1 | 48.8/49.0/49.0 | +0.0% |
| T15 | 151.7/167.1/170.6 | 48.8/49.0/49.0 | -67.8% |
| T16 | 77.1/89.6/89.8 | 48.8/49.0/49.3 | -36.7% |
| T17 | 432.0/432.1/432.3 | 432.1/432.3/432.6 | +0.0% |

#### 320×568, CPU1×, pwa-offline, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 103.6/116.9/156.6 | 48.4/48.9/50.0 | -53.3% |
| T02 | 146.1/159.4/163.3 | 48.6/48.9/48.9 | -66.7% |
| T03 | 78.7/91.9/92.1 | 48.7/49.0/49.1 | -38.1% |
| T04 | 147.4/163.7/167.2 | 47.7/48.3/48.6 | -67.6% |
| T05 | 78.7/111.7/115.3 | 48.3/48.7/48.8 | -38.6% |
| T06 | 77.7/91.2/105.2 | 48.5/48.8/48.9 | -37.6% |
| T07 | 78.2/88.8/92.2 | 48.6/48.9/48.9 | -37.9% |
| T08 | 79.5/92.6/93.4 | 48.4/48.7/48.8 | -39.1% |
| T09 | 78.3/93.8/95.9 | 48.7/48.8/48.9 | -37.8% |
| T10 | 110.7/117.6/127.3 | 48.5/48.9/49.0 | -56.2% |
| T11 | 48.8/48.9/49.1 | 48.7/48.9/48.9 | -0.2% |
| T12 | 48.8/48.9/49.1 | 48.6/49.0/49.3 | -0.4% |
| T13 | 48.7/48.9/48.9 | 48.6/48.9/48.9 | -0.2% |
| T14 | 48.8/48.9/48.9 | 48.6/48.9/48.9 | -0.4% |
| T15 | 147.1/166.1/176.5 | 48.6/49.0/49.0 | -67.0% |
| T16 | 76.2/86.0/87.6 | 48.7/48.9/48.9 | -36.1% |
| T17 | 431.8/432.2/432.3 | 432.0/432.2/432.3 | +0.0% |

#### 320×568, CPU4×, network, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 410.3/468.3/489.0 | 144.8/194.7/213.6 | -64.7% |
| T02 | 586.2/630.9/637.0 | 46.2/58.9/63.3 | -92.1% |
| T03 | 287.4/344.3/349.2 | 48.0/55.0/64.5 | -83.3% |
| T04 | 611.3/665.0/666.1 | 48.2/55.4/58.1 | -92.1% |
| T05 | 286.7/340.5/346.5 | 45.7/46.9/47.1 | -84.1% |
| T06 | 286.6/329.5/334.5 | 46.3/47.6/48.0 | -83.8% |
| T07 | 296.1/337.0/353.8 | 46.4/47.3/48.0 | -84.3% |
| T08 | 274.0/332.2/372.7 | 45.5/47.5/51.2 | -83.4% |
| T09 | 276.0/338.6/366.9 | 46.1/47.3/47.8 | -83.3% |
| T10 | 394.2/411.9/438.7 | 114.0/121.7/121.8 | -71.1% |
| T11 | 90.5/97.6/129.7 | 47.2/50.4/50.7 | -47.8% |
| T12 | 52.3/60.7/68.2 | 46.6/47.4/47.7 | -10.9% |
| T13 | 125.7/141.7/162.2 | 104.4/123.8/125.0 | -16.9% |
| T14 | 51.8/56.9/62.1 | 46.5/47.6/48.0 | -10.2% |
| T15 | 538.6/626.0/631.5 | 79.1/92.0/106.9 | -85.3% |
| T16 | 267.6/324.3/330.2 | 46.5/47.7/48.3 | -82.6% |
| T17 | 429.0/430.5/431.5 | 429.9/431.0/431.0 | +0.2% |

#### 320×568, CPU4×, network, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 391.8/411.7/411.9 | 109.7/117.1/118.7 | -72.0% |
| T02 | 565.1/632.3/633.0 | 46.6/47.5/48.3 | -91.8% |
| T03 | 277.2/328.5/333.0 | 47.4/50.9/51.2 | -82.9% |
| T04 | 577.6/632.3/642.6 | 44.8/47.4/48.0 | -92.2% |
| T05 | 278.1/337.9/345.9 | 45.6/46.9/47.5 | -83.6% |
| T06 | 275.7/317.2/351.2 | 45.9/47.2/47.3 | -83.4% |
| T07 | 275.5/312.8/341.3 | 46.6/47.7/47.9 | -83.1% |
| T08 | 269.5/317.8/320.8 | 46.2/62.6/64.1 | -82.9% |
| T09 | 268.6/317.7/329.7 | 46.6/47.5/47.6 | -82.7% |
| T10 | 390.9/412.0/412.1 | 109.7/116.9/118.9 | -71.9% |
| T11 | 89.4/92.8/94.7 | 46.9/48.5/48.6 | -47.5% |
| T12 | 52.8/54.5/54.6 | 46.6/48.0/48.0 | -11.7% |
| T13 | 128.0/132.5/132.9 | 101.6/108.7/109.9 | -20.6% |
| T14 | 50.7/53.8/54.0 | 46.5/48.0/48.3 | -8.3% |
| T15 | 532.1/611.1/615.8 | 79.2/83.8/85.6 | -85.1% |
| T16 | 271.5/317.0/349.8 | 46.6/47.9/48.4 | -82.8% |
| T17 | 429.2/430.6/430.9 | 430.0/431.4/431.5 | +0.2% |

#### 320×568, CPU4×, pwa-offline, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 566.8/582.9/585.8 | 174.5/186.6/200.7 | -69.2% |
| T02 | 818.4/841.2/848.7 | 46.9/51.2/63.2 | -94.3% |
| T03 | 435.3/458.2/465.5 | 52.0/65.3/69.4 | -88.1% |
| T04 | 842.9/881.2/906.2 | 47.8/51.4/62.5 | -94.3% |
| T05 | 426.8/441.1/444.2 | 46.5/47.8/48.0 | -89.1% |
| T06 | 426.9/447.7/449.4 | 46.5/47.9/48.1 | -89.1% |
| T07 | 420.7/431.9/436.7 | 46.8/47.8/47.9 | -88.9% |
| T08 | 416.2/436.8/457.5 | 46.3/47.2/47.7 | -88.9% |
| T09 | 415.7/427.3/432.6 | 46.4/47.5/47.5 | -88.8% |
| T10 | 530.9/541.0/579.3 | 142.0/148.7/151.0 | -73.3% |
| T11 | 112.0/123.1/130.7 | 48.5/50.2/51.4 | -56.7% |
| T12 | 60.0/62.8/65.5 | 46.4/47.4/47.7 | -22.7% |
| T13 | 163.4/172.3/178.1 | 127.4/133.8/143.7 | -22.0% |
| T14 | 59.6/61.2/61.2 | 46.6/47.4/47.6 | -21.8% |
| T15 | 815.9/833.2/854.0 | 96.6/100.9/103.2 | -88.2% |
| T16 | 416.0/424.7/424.7 | 46.4/47.2/47.6 | -88.8% |
| T17 | 429.6/430.7/431.1 | 429.8/431.0/431.1 | +0.0% |

#### 320×568, CPU4×, pwa-offline, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 520.6/531.5/531.7 | 140.3/145.8/146.0 | -73.1% |
| T02 | 794.4/809.9/812.6 | 46.1/47.3/47.5 | -94.2% |
| T03 | 416.4/426.5/429.5 | 47.0/48.5/48.6 | -88.7% |
| T04 | 829.9/844.5/856.1 | 47.4/51.2/54.0 | -94.3% |
| T05 | 416.6/427.6/428.2 | 45.9/47.1/47.5 | -89.0% |
| T06 | 415.0/420.2/422.6 | 45.8/48.2/64.5 | -89.0% |
| T07 | 415.6/424.2/425.5 | 46.6/52.4/63.7 | -88.8% |
| T08 | 411.8/443.0/447.1 | 45.5/47.4/47.8 | -89.0% |
| T09 | 409.2/418.7/422.2 | 46.2/47.3/47.5 | -88.7% |
| T10 | 517.0/528.9/547.2 | 140.7/145.6/146.6 | -72.8% |
| T11 | 112.9/116.3/116.9 | 49.1/50.6/50.8 | -56.5% |
| T12 | 60.2/62.2/63.4 | 46.2/47.5/47.8 | -23.3% |
| T13 | 162.3/170.4/189.1 | 130.7/134.0/135.7 | -19.5% |
| T14 | 60.3/62.7/64.4 | 46.0/47.6/48.1 | -23.7% |
| T15 | 800.3/809.4/814.3 | 98.6/104.8/110.9 | -87.7% |
| T16 | 410.8/425.4/426.1 | 45.9/47.3/47.4 | -88.8% |
| T17 | 429.2/430.5/431.1 | 429.3/431.6/446.1 | +0.0% |

#### 390×844, CPU1×, network, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 175.7/185.1/212.5 | 67.3/73.1/74.3 | -61.7% |
| T02 | 244.8/252.9/253.6 | 47.5/47.7/47.8 | -80.6% |
| T03 | 135.0/141.6/149.2 | 48.9/50.7/50.9 | -63.8% |
| T04 | 266.8/290.8/314.4 | 49.9/56.9/58.1 | -81.3% |
| T05 | 132.3/134.2/136.0 | 49.8/51.3/52.0 | -62.4% |
| T06 | 131.8/138.0/138.1 | 47.4/47.7/47.7 | -64.0% |
| T07 | 131.3/135.6/139.0 | 49.5/50.2/59.0 | -62.3% |
| T08 | 136.4/150.5/153.6 | 47.4/47.6/47.8 | -65.2% |
| T09 | 133.9/154.4/154.6 | 47.5/47.7/47.9 | -64.5% |
| T10 | 171.1/187.6/191.8 | 60.5/66.5/68.3 | -64.6% |
| T11 | 56.1/59.3/62.8 | 47.4/47.6/47.6 | -15.5% |
| T12 | 47.7/48.1/50.6 | 47.5/47.6/47.6 | -0.4% |
| T13 | 77.0/86.6/94.8 | 60.7/65.5/73.6 | -21.2% |
| T14 | 47.6/48.1/48.1 | 47.6/47.8/47.8 | +0.0% |
| T15 | 259.2/286.7/288.5 | 53.8/59.4/65.2 | -79.2% |
| T16 | 129.5/131.3/135.6 | 47.5/47.8/51.5 | -63.3% |
| T17 | 430.5/431.0/431.1 | 430.8/431.1/431.1 | +0.1% |

#### 390×844, CPU1×, network, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 160.1/161.6/162.8 | 51.3/52.1/54.0 | -68.0% |
| T02 | 237.6/238.6/241.2 | 47.4/47.6/47.7 | -80.1% |
| T03 | 130.0/132.0/132.1 | 47.6/47.8/49.4 | -63.4% |
| T04 | 255.8/276.0/282.2 | 47.0/47.3/49.3 | -81.6% |
| T05 | 130.5/133.4/134.2 | 49.3/50.0/53.2 | -62.2% |
| T06 | 129.0/130.5/131.1 | 47.5/47.7/47.7 | -63.2% |
| T07 | 129.7/132.3/139.8 | 49.4/50.1/50.4 | -61.9% |
| T08 | 132.2/147.6/151.5 | 47.2/47.6/47.7 | -64.3% |
| T09 | 131.0/138.6/146.4 | 47.5/47.8/47.8 | -63.7% |
| T10 | 167.9/181.5/184.0 | 61.7/68.8/69.2 | -63.3% |
| T11 | 56.6/58.1/58.3 | 47.5/47.7/47.8 | -16.1% |
| T12 | 47.5/47.7/47.7 | 47.4/47.7/47.7 | -0.2% |
| T13 | 74.6/79.5/93.0 | 60.4/65.8/66.0 | -19.0% |
| T14 | 47.5/47.7/47.7 | 47.6/47.7/47.7 | +0.2% |
| T15 | 248.1/271.1/275.8 | 53.7/58.4/59.1 | -78.4% |
| T16 | 127.4/128.0/131.0 | 47.5/47.7/47.8 | -62.7% |
| T17 | 428.9/430.8/430.8 | 430.9/431.0/431.0 | +0.5% |

#### 390×844, CPU1×, pwa-offline, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 145.7/151.8/162.8 | 56.2/60.9/61.2 | -61.4% |
| T02 | 202.8/206.9/209.5 | 48.4/48.5/49.4 | -76.1% |
| T03 | 116.1/126.6/129.2 | 48.5/48.6/48.6 | -58.2% |
| T04 | 217.3/240.8/241.1 | 37.4/46.5/46.7 | -82.8% |
| T05 | 112.1/113.2/113.8 | 48.4/48.4/48.5 | -56.8% |
| T06 | 111.4/113.9/115.7 | 48.4/48.6/48.6 | -56.6% |
| T07 | 111.3/112.1/112.7 | 48.4/48.5/48.6 | -56.5% |
| T08 | 116.5/128.4/141.7 | 48.3/48.4/48.6 | -58.5% |
| T09 | 116.1/124.9/131.0 | 48.4/48.6/48.6 | -58.3% |
| T10 | 143.4/154.6/154.8 | 58.0/59.4/59.5 | -59.6% |
| T11 | 48.6/49.8/54.3 | 48.3/48.5/48.6 | -0.6% |
| T12 | 48.3/48.5/48.5 | 48.3/48.5/48.6 | +0.0% |
| T13 | 59.2/75.4/82.7 | 53.7/58.1/58.2 | -9.3% |
| T14 | 48.4/48.5/48.5 | 48.4/48.5/48.7 | +0.0% |
| T15 | 210.1/236.5/241.3 | 48.4/50.3/50.5 | -77.0% |
| T16 | 109.6/111.1/111.4 | 48.4/48.6/48.6 | -55.8% |
| T17 | 431.5/431.8/431.8 | 431.8/432.0/432.0 | +0.1% |

#### 390×844, CPU1×, pwa-offline, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 134.3/136.0/137.6 | 57.2/58.3/58.9 | -57.4% |
| T02 | 199.6/201.2/201.2 | 48.4/48.6/48.6 | -75.8% |
| T03 | 110.7/112.8/116.7 | 48.5/48.6/48.7 | -56.2% |
| T04 | 215.1/238.8/240.1 | 48.0/48.2/53.8 | -77.7% |
| T05 | 110.9/112.0/113.3 | 48.4/48.6/48.6 | -56.4% |
| T06 | 109.8/110.1/110.2 | 48.3/48.5/48.5 | -56.0% |
| T07 | 110.2/110.8/113.6 | 48.4/48.6/48.6 | -56.1% |
| T08 | 111.4/125.2/130.8 | 48.3/48.4/48.5 | -56.6% |
| T09 | 113.7/120.6/125.6 | 48.4/48.5/48.5 | -57.4% |
| T10 | 140.5/148.9/150.8 | 58.3/59.1/59.2 | -58.5% |
| T11 | 48.6/49.3/64.0 | 48.3/48.5/48.6 | -0.6% |
| T12 | 48.4/48.5/48.6 | 48.4/48.5/48.5 | +0.0% |
| T13 | 59.0/62.1/64.3 | 53.8/58.1/58.7 | -8.8% |
| T14 | 48.4/48.5/48.6 | 48.4/48.6/48.6 | +0.0% |
| T15 | 207.6/231.6/235.8 | 48.5/50.3/50.5 | -76.6% |
| T16 | 108.6/109.0/109.1 | 48.4/48.5/48.5 | -55.4% |
| T17 | 431.5/431.7/431.7 | 431.8/431.9/431.9 | +0.1% |

#### 390×844, CPU4×, network, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 706.2/731.8/752.2 | 223.0/229.2/234.1 | -68.4% |
| T02 | 1009.3/1045.6/1046.2 | 49.6/70.5/71.3 | -95.1% |
| T03 | 533.6/558.6/582.4 | 48.4/55.7/60.6 | -90.9% |
| T04 | 1062.7/1139.4/1170.1 | 76.5/110.5/110.6 | -92.8% |
| T05 | 512.1/537.8/551.6 | 53.2/58.2/60.3 | -89.6% |
| T06 | 517.8/538.3/567.7 | 48.1/51.7/52.6 | -90.7% |
| T07 | 521.3/552.9/690.8 | 54.5/62.8/65.6 | -89.5% |
| T08 | 517.5/541.6/544.0 | 45.8/49.1/51.0 | -91.1% |
| T09 | 508.7/528.3/529.0 | 46.2/49.0/49.2 | -90.9% |
| T10 | 657.5/696.0/698.2 | 184.2/197.4/199.6 | -72.0% |
| T11 | 136.5/152.2/162.5 | 54.4/58.5/59.8 | -60.1% |
| T12 | 71.1/79.2/83.7 | 46.6/48.8/49.2 | -34.5% |
| T13 | 205.0/222.5/241.0 | 172.3/198.6/199.6 | -16.0% |
| T14 | 69.1/73.4/76.4 | 46.5/49.4/49.5 | -32.7% |
| T15 | 1002.6/1037.6/1038.0 | 131.0/144.4/145.9 | -86.9% |
| T16 | 503.8/525.2/526.0 | 46.8/48.3/49.9 | -90.7% |
| T17 | 427.6/442.0/442.8 | 429.1/430.4/444.8 | +0.4% |

#### 390×844, CPU4×, network, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 648.6/667.8/679.5 | 168.2/183.2/186.3 | -74.1% |
| T02 | 990.6/1015.5/1019.3 | 47.6/50.0/53.2 | -95.2% |
| T03 | 507.7/537.0/540.9 | 52.1/62.0/70.8 | -89.7% |
| T04 | 1044.0/1094.9/1112.1 | 59.6/71.1/71.7 | -94.3% |
| T05 | 520.1/544.5/557.7 | 52.2/58.2/59.0 | -90.0% |
| T06 | 512.2/533.5/534.5 | 47.1/49.3/50.7 | -90.8% |
| T07 | 518.0/540.4/547.1 | 53.6/58.9/59.3 | -89.7% |
| T08 | 514.4/538.1/546.3 | 46.7/51.5/58.9 | -90.9% |
| T09 | 514.6/543.8/552.9 | 46.9/49.6/56.4 | -90.9% |
| T10 | 658.2/674.2/678.5 | 186.7/201.2/206.7 | -71.6% |
| T11 | 134.1/141.9/143.8 | 53.9/58.6/60.1 | -59.8% |
| T12 | 72.6/78.0/81.5 | 46.2/49.6/50.5 | -36.4% |
| T13 | 209.1/216.4/231.4 | 173.9/183.2/202.6 | -16.8% |
| T14 | 70.5/73.3/90.7 | 46.8/49.7/49.7 | -33.6% |
| T15 | 998.7/1023.0/1025.1 | 126.2/136.9/142.8 | -87.4% |
| T16 | 510.6/521.8/530.3 | 46.9/49.1/49.2 | -90.8% |
| T17 | 427.6/434.2/435.1 | 428.8/430.3/430.5 | +0.3% |

#### 390×844, CPU4×, pwa-offline, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 709.6/721.5/722.1 | 229.1/240.5/242.0 | -67.7% |
| T02 | 1018.4/1057.9/1115.5 | 53.4/71.8/73.3 | -94.8% |
| T03 | 540.4/557.0/596.4 | 52.0/57.5/65.8 | -90.4% |
| T04 | 1062.8/1107.6/1167.2 | 86.6/104.8/121.3 | -91.9% |
| T05 | 518.2/543.6/561.5 | 52.6/57.7/58.5 | -89.8% |
| T06 | 522.1/542.6/547.2 | 52.1/57.3/58.5 | -90.0% |
| T07 | 522.9/544.9/547.6 | 56.6/60.3/60.6 | -89.2% |
| T08 | 520.3/533.4/548.8 | 45.5/53.6/53.9 | -91.3% |
| T09 | 517.8/556.6/566.6 | 46.9/52.6/56.2 | -90.9% |
| T10 | 655.2/676.6/677.1 | 195.5/203.6/206.3 | -70.2% |
| T11 | 136.4/143.3/149.8 | 57.7/59.5/59.5 | -57.7% |
| T12 | 71.5/78.2/80.3 | 46.9/48.5/49.2 | -34.4% |
| T13 | 207.5/228.7/229.5 | 172.0/184.9/185.3 | -17.1% |
| T14 | 72.7/75.9/77.3 | 46.5/48.3/48.4 | -36.0% |
| T15 | 1014.1/1037.5/1046.2 | 129.8/142.2/143.7 | -87.2% |
| T16 | 520.4/534.3/545.2 | 46.1/49.2/49.4 | -91.1% |
| T17 | 426.1/449.1/457.0 | 427.2/429.6/443.5 | +0.3% |

#### 390×844, CPU4×, pwa-offline, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 641.1/677.3/688.4 | 170.6/177.3/177.9 | -73.4% |
| T02 | 976.5/1012.5/1016.2 | 47.1/50.2/50.3 | -95.2% |
| T03 | 507.3/521.2/537.4 | 52.7/65.8/69.4 | -89.6% |
| T04 | 1025.5/1046.0/1050.7 | 61.8/67.8/73.4 | -94.0% |
| T05 | 506.2/526.0/528.9 | 52.9/56.1/58.1 | -89.5% |
| T06 | 509.6/525.8/529.1 | 46.1/49.6/50.7 | -91.0% |
| T07 | 508.3/529.5/536.2 | 55.2/59.7/63.7 | -89.1% |
| T08 | 510.1/523.5/532.3 | 46.1/49.7/51.3 | -91.0% |
| T09 | 499.3/516.8/522.1 | 45.4/51.7/51.9 | -90.9% |
| T10 | 634.8/652.0/668.9 | 181.1/198.2/203.7 | -71.5% |
| T11 | 134.9/141.1/156.9 | 53.2/56.5/59.1 | -60.6% |
| T12 | 70.2/76.4/77.5 | 46.2/47.9/48.8 | -34.2% |
| T13 | 206.8/221.9/224.8 | 166.2/183.5/187.8 | -19.6% |
| T14 | 70.6/73.6/88.7 | 46.4/48.7/49.4 | -34.3% |
| T15 | 979.7/1013.5/1016.2 | 127.1/140.8/140.8 | -87.0% |
| T16 | 493.5/509.2/522.9 | 46.7/48.9/50.0 | -90.5% |
| T17 | 426.0/435.8/438.6 | 428.5/429.6/430.3 | +0.6% |

#### 412×915, CPU1×, network, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 176.6/189.7/195.5 | 65.5/71.7/73.6 | -62.9% |
| T02 | 245.9/248.8/248.9 | 48.1/48.9/48.9 | -80.4% |
| T03 | 136.2/142.0/143.0 | 55.2/57.6/58.3 | -59.5% |
| T04 | 264.4/274.4/295.2 | 49.9/53.6/56.9 | -81.1% |
| T05 | 133.0/135.7/139.6 | 50.3/51.1/51.7 | -62.2% |
| T06 | 132.3/133.5/143.0 | 48.3/48.8/48.8 | -63.5% |
| T07 | 133.1/134.0/138.5 | 51.1/51.7/51.8 | -61.6% |
| T08 | 138.9/157.1/158.9 | 47.8/48.0/48.2 | -65.6% |
| T09 | 136.3/154.5/160.8 | 47.9/48.0/48.1 | -64.9% |
| T10 | 170.3/188.6/190.3 | 62.6/78.2/84.4 | -63.2% |
| T11 | 57.5/58.8/59.2 | 47.9/48.2/54.8 | -16.7% |
| T12 | 47.9/48.1/52.4 | 47.9/48.2/49.2 | +0.0% |
| T13 | 79.3/97.2/97.4 | 61.8/68.2/87.9 | -22.1% |
| T14 | 47.9/48.1/50.9 | 47.9/48.1/48.1 | +0.0% |
| T15 | 258.6/282.7/302.4 | 54.4/60.7/62.2 | -79.0% |
| T16 | 130.5/132.7/136.6 | 47.9/48.0/48.0 | -63.3% |
| T17 | 430.8/431.0/431.1 | 431.3/431.5/431.6 | +0.1% |

#### 412×915, CPU1×, network, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 159.3/160.2/160.3 | 50.9/51.4/53.0 | -68.0% |
| T02 | 237.0/238.1/243.8 | 47.9/49.8/51.2 | -79.8% |
| T03 | 129.2/132.0/135.3 | 48.5/50.0/50.6 | -62.5% |
| T04 | 254.6/278.4/282.9 | 47.5/50.9/57.9 | -81.3% |
| T05 | 129.5/130.7/140.8 | 50.9/51.9/54.0 | -60.7% |
| T06 | 128.4/130.4/130.7 | 47.9/48.1/48.2 | -62.7% |
| T07 | 129.1/130.0/130.5 | 51.1/51.9/56.1 | -60.4% |
| T08 | 131.4/142.1/145.6 | 47.8/48.0/48.1 | -63.6% |
| T09 | 134.9/145.1/148.3 | 47.9/48.2/48.2 | -64.5% |
| T10 | 162.2/177.8/183.1 | 62.3/69.9/70.9 | -61.6% |
| T11 | 57.6/58.7/60.1 | 47.9/48.1/48.3 | -16.8% |
| T12 | 48.0/48.1/48.1 | 48.0/48.1/49.2 | +0.0% |
| T13 | 73.6/79.5/81.1 | 62.2/66.4/67.0 | -15.5% |
| T14 | 47.9/48.1/50.3 | 47.9/48.1/48.1 | +0.0% |
| T15 | 250.0/269.2/272.4 | 54.4/60.1/60.9 | -78.2% |
| T16 | 126.9/127.7/127.9 | 47.9/48.1/48.1 | -62.3% |
| T17 | 426.7/428.7/428.9 | 431.3/431.4/431.6 | +1.1% |

#### 412×915, CPU1×, pwa-offline, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 176.4/190.7/195.7 | 65.5/71.8/72.1 | -62.9% |
| T02 | 245.2/260.2/268.9 | 47.9/49.3/61.9 | -80.5% |
| T03 | 135.6/140.8/159.3 | 52.6/57.6/57.7 | -61.2% |
| T04 | 264.9/299.2/306.0 | 50.7/54.3/54.4 | -80.9% |
| T05 | 132.4/136.1/136.8 | 49.9/51.5/51.7 | -62.3% |
| T06 | 131.9/133.7/133.9 | 47.9/48.8/56.0 | -63.7% |
| T07 | 132.1/133.1/133.1 | 50.9/51.9/52.9 | -61.5% |
| T08 | 135.3/149.7/152.9 | 47.5/48.1/54.8 | -64.9% |
| T09 | 135.6/149.5/149.9 | 47.4/48.0/66.1 | -65.0% |
| T10 | 174.2/189.8/190.1 | 62.2/74.5/93.5 | -64.3% |
| T11 | 57.3/59.6/66.0 | 47.7/48.0/48.0 | -16.8% |
| T12 | 47.9/50.9/51.1 | 47.7/48.1/49.2 | -0.4% |
| T13 | 78.4/86.7/105.8 | 62.0/67.6/68.5 | -20.9% |
| T14 | 47.7/49.2/50.3 | 47.6/48.1/48.1 | -0.2% |
| T15 | 259.7/285.1/286.3 | 55.1/60.9/61.0 | -78.8% |
| T16 | 130.1/135.9/136.1 | 47.6/48.0/48.1 | -63.4% |
| T17 | 426.9/430.9/431.0 | 430.9/431.4/431.5 | +0.9% |

#### 412×915, CPU1×, pwa-offline, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 162.8/165.8/168.4 | 50.7/53.3/71.6 | -68.9% |
| T02 | 242.9/248.9/259.9 | 48.0/48.3/48.3 | -80.2% |
| T03 | 133.0/134.9/150.6 | 48.2/49.5/51.2 | -63.8% |
| T04 | 261.2/279.5/285.0 | 47.3/47.7/48.5 | -81.9% |
| T05 | 132.8/134.6/159.5 | 50.2/51.4/53.6 | -62.2% |
| T06 | 131.3/132.0/132.1 | 47.8/48.1/48.1 | -63.6% |
| T07 | 132.4/133.9/151.8 | 50.4/51.2/51.8 | -61.9% |
| T08 | 138.2/153.2/153.6 | 47.8/48.1/48.1 | -65.4% |
| T09 | 137.9/149.3/149.5 | 47.8/48.3/48.5 | -65.3% |
| T10 | 168.6/179.3/182.5 | 62.7/69.0/69.1 | -62.8% |
| T11 | 56.7/58.8/59.0 | 47.9/48.2/48.3 | -15.5% |
| T12 | 48.0/48.2/48.2 | 47.9/48.1/48.1 | -0.2% |
| T13 | 77.5/80.2/81.6 | 61.8/63.8/65.8 | -20.3% |
| T14 | 48.0/48.2/48.2 | 47.9/48.1/48.1 | -0.2% |
| T15 | 253.8/273.5/273.8 | 54.3/59.5/59.7 | -78.6% |
| T16 | 130.0/130.7/131.2 | 47.9/48.2/48.2 | -63.2% |
| T17 | 426.5/430.8/430.8 | 431.3/431.5/431.5 | +1.1% |

#### 412×915, CPU4×, network, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 731.2/765.5/798.0 | 229.5/241.2/245.6 | -68.6% |
| T02 | 1045.8/1105.8/1109.2 | 53.6/66.9/74.5 | -94.9% |
| T03 | 553.6/583.6/603.9 | 50.9/65.2/65.6 | -90.8% |
| T04 | 1098.4/1149.3/1168.4 | 86.4/113.2/116.6 | -92.1% |
| T05 | 531.9/551.8/574.0 | 52.3/58.8/64.0 | -90.2% |
| T06 | 533.5/564.3/567.4 | 52.7/58.7/59.8 | -90.1% |
| T07 | 537.2/551.4/566.1 | 57.4/61.1/64.0 | -89.3% |
| T08 | 533.1/563.7/567.3 | 51.8/56.6/57.4 | -90.3% |
| T09 | 521.6/558.6/569.0 | 49.2/54.3/58.8 | -90.6% |
| T10 | 680.5/727.3/757.5 | 186.4/204.1/208.5 | -72.6% |
| T11 | 145.4/159.5/161.5 | 56.7/58.1/60.2 | -61.0% |
| T12 | 75.1/78.1/78.5 | 47.8/51.2/51.8 | -36.4% |
| T13 | 222.5/234.6/246.6 | 171.6/184.6/194.7 | -22.9% |
| T14 | 74.7/80.0/83.0 | 48.2/51.2/56.8 | -35.5% |
| T15 | 1038.8/1089.4/1096.7 | 133.0/146.3/146.9 | -87.2% |
| T16 | 528.3/551.6/609.4 | 47.2/50.4/51.4 | -91.1% |
| T17 | 432.2/442.4/465.3 | 428.7/459.5/462.2 | -0.8% |

#### 412×915, CPU4×, network, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 640.7/658.5/658.6 | 178.9/188.1/190.0 | -72.1% |
| T02 | 973.4/998.8/999.2 | 48.0/51.4/52.1 | -95.1% |
| T03 | 508.8/534.7/536.7 | 57.5/64.8/71.1 | -88.7% |
| T04 | 1035.8/1059.9/1062.6 | 62.7/71.2/71.3 | -93.9% |
| T05 | 513.7/536.5/542.5 | 53.7/57.8/58.0 | -89.5% |
| T06 | 505.8/523.1/524.7 | 49.6/51.8/56.0 | -90.2% |
| T07 | 509.4/524.7/531.1 | 55.5/59.1/61.1 | -89.1% |
| T08 | 508.2/525.3/526.7 | 50.9/55.6/58.2 | -90.0% |
| T09 | 507.9/523.6/525.7 | 50.5/59.0/59.5 | -90.1% |
| T10 | 650.1/673.2/673.4 | 189.6/208.6/210.1 | -70.8% |
| T11 | 139.1/144.4/145.0 | 55.4/57.5/58.2 | -60.2% |
| T12 | 72.6/76.1/78.0 | 48.2/52.3/53.5 | -33.6% |
| T13 | 211.6/229.6/239.0 | 175.1/185.1/190.0 | -17.2% |
| T14 | 72.4/77.0/86.2 | 47.3/51.0/51.4 | -34.7% |
| T15 | 978.9/1014.5/1025.0 | 133.0/146.3/146.3 | -86.4% |
| T16 | 496.2/512.3/532.4 | 47.4/50.2/51.6 | -90.4% |
| T17 | 430.4/440.7/455.8 | 428.7/429.4/429.9 | -0.4% |

#### 412×915, CPU4×, pwa-offline, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 466.2/484.2/503.8 | 154.2/185.8/187.0 | -66.9% |
| T02 | 606.3/655.7/675.0 | 55.1/65.1/68.2 | -90.9% |
| T03 | 317.0/408.8/437.4 | 48.3/56.8/66.8 | -84.8% |
| T04 | 658.9/700.7/727.7 | 71.6/89.3/127.0 | -89.1% |
| T05 | 315.0/351.7/352.1 | 49.9/55.4/66.1 | -84.2% |
| T06 | 296.9/348.1/353.3 | 48.5/55.5/55.7 | -83.7% |
| T07 | 298.1/354.9/382.8 | 50.3/54.1/58.9 | -83.1% |
| T08 | 294.7/353.9/359.6 | 44.5/46.4/46.7 | -84.9% |
| T09 | 301.9/344.1/347.0 | 45.8/47.2/47.7 | -84.8% |
| T10 | 418.6/455.9/472.1 | 133.2/156.2/183.2 | -68.2% |
| T11 | 96.6/104.0/104.4 | 49.5/58.5/60.0 | -48.8% |
| T12 | 55.8/62.5/69.2 | 46.3/62.4/66.5 | -17.0% |
| T13 | 140.5/173.2/174.7 | 121.4/140.8/175.9 | -13.6% |
| T14 | 55.4/61.8/73.7 | 46.1/47.4/47.5 | -16.8% |
| T15 | 623.9/684.1/693.4 | 91.9/109.3/125.2 | -85.3% |
| T16 | 320.0/383.8/387.6 | 46.2/47.4/49.1 | -85.6% |
| T17 | 427.9/429.4/443.0 | 429.3/430.2/431.4 | +0.3% |

#### 412×915, CPU4×, pwa-offline, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 387.4/432.9/438.5 | 110.2/131.6/155.7 | -71.6% |
| T02 | 545.5/627.3/627.4 | 46.7/47.9/48.8 | -91.4% |
| T03 | 293.4/340.7/343.3 | 48.4/52.6/54.3 | -83.5% |
| T04 | 643.5/691.8/696.5 | 53.9/56.4/57.7 | -91.6% |
| T05 | 301.3/343.8/359.3 | 48.3/50.8/50.9 | -84.0% |
| T06 | 297.3/335.0/342.3 | 46.7/47.4/48.3 | -84.3% |
| T07 | 292.4/332.5/338.5 | 48.5/53.4/53.9 | -83.4% |
| T08 | 296.8/337.7/373.0 | 45.6/46.8/47.0 | -84.6% |
| T09 | 323.8/337.4/338.9 | 46.9/47.5/48.7 | -85.5% |
| T10 | 391.7/435.6/459.4 | 123.3/140.7/164.8 | -68.5% |
| T11 | 90.1/101.0/129.6 | 53.9/55.0/55.8 | -40.2% |
| T12 | 51.8/56.4/57.1 | 46.7/47.6/50.8 | -9.8% |
| T13 | 137.9/162.5/175.2 | 107.6/130.6/132.7 | -22.0% |
| T14 | 52.1/55.6/56.1 | 46.6/47.8/47.9 | -10.6% |
| T15 | 619.0/661.6/671.9 | 89.6/93.7/97.9 | -85.5% |
| T16 | 290.6/337.1/339.8 | 46.9/48.3/48.3 | -83.9% |
| T17 | 428.5/430.2/431.0 | 430.1/441.3/456.7 | +0.4% |

#### 844×390, CPU1×, network, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 145.6/150.7/152.9 | 55.6/60.6/60.7 | -61.8% |
| T02 | 202.6/211.0/222.5 | 48.2/48.4/48.5 | -76.2% |
| T03 | 113.8/118.9/132.8 | 48.4/48.6/48.6 | -57.5% |
| T04 | 217.6/232.8/237.9 | 36.2/43.9/46.8 | -83.4% |
| T05 | 111.8/113.9/114.0 | 48.3/48.4/48.6 | -56.8% |
| T06 | 110.9/116.3/117.1 | 48.3/48.5/50.7 | -56.4% |
| T07 | 111.0/112.8/115.7 | 48.4/48.5/48.5 | -56.4% |
| T08 | 112.9/128.3/137.3 | 48.2/48.4/48.4 | -57.3% |
| T09 | 116.0/126.2/131.8 | 48.3/48.5/48.6 | -58.4% |
| T10 | 142.5/154.5/162.4 | 57.0/58.3/58.6 | -60.0% |
| T11 | 48.4/51.3/52.1 | 48.3/48.4/48.4 | -0.2% |
| T12 | 48.4/48.5/48.5 | 48.3/48.5/48.5 | -0.2% |
| T13 | 59.0/74.3/77.3 | 56.5/57.4/58.4 | -4.2% |
| T14 | 48.2/48.5/48.5 | 48.3/48.5/48.5 | +0.2% |
| T15 | 209.1/236.3/236.7 | 48.4/49.3/49.3 | -76.9% |
| T16 | 109.4/110.9/111.1 | 48.4/48.5/48.6 | -55.8% |
| T17 | 431.4/431.5/431.7 | 431.7/431.8/431.8 | +0.1% |

#### 844×390, CPU1×, network, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 135.7/138.6/144.3 | 57.2/58.0/61.4 | -57.8% |
| T02 | 200.8/201.7/204.2 | 48.4/48.5/48.5 | -75.9% |
| T03 | 111.2/111.9/112.0 | 48.4/48.6/48.6 | -56.5% |
| T04 | 216.5/236.6/243.1 | 47.6/47.8/48.0 | -78.0% |
| T05 | 111.4/112.8/113.4 | 48.3/48.4/48.5 | -56.6% |
| T06 | 110.3/110.8/111.1 | 48.3/48.5/48.6 | -56.2% |
| T07 | 110.8/112.6/113.6 | 48.4/48.5/48.5 | -56.3% |
| T08 | 111.5/120.5/124.2 | 48.3/48.4/48.4 | -56.7% |
| T09 | 111.6/119.8/122.7 | 48.3/48.4/48.4 | -56.7% |
| T10 | 141.0/146.1/149.4 | 55.7/58.1/58.8 | -60.5% |
| T11 | 48.3/49.1/49.3 | 48.2/48.5/48.5 | -0.2% |
| T12 | 48.3/48.4/48.4 | 48.3/48.5/48.5 | +0.0% |
| T13 | 58.4/63.4/78.1 | 54.4/57.2/58.3 | -6.8% |
| T14 | 48.3/48.5/48.6 | 48.4/48.5/48.6 | +0.2% |
| T15 | 210.3/232.1/236.3 | 48.4/49.5/49.8 | -77.0% |
| T16 | 109.3/110.0/110.8 | 48.3/48.5/48.5 | -55.8% |
| T17 | 431.3/431.4/431.7 | 431.7/431.8/431.8 | +0.1% |

#### 844×390, CPU1×, pwa-offline, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 115.1/123.6/123.6 | 48.8/51.5/56.6 | -57.6% |
| T02 | 147.9/166.4/168.0 | 48.2/48.7/48.8 | -67.4% |
| T03 | 82.8/96.6/98.9 | 48.6/49.0/49.1 | -41.3% |
| T04 | 174.4/188.8/212.0 | 39.2/46.9/46.9 | -77.5% |
| T05 | 80.3/88.3/93.3 | 48.1/48.4/48.5 | -40.1% |
| T06 | 79.2/95.5/97.3 | 48.4/48.8/48.9 | -38.9% |
| T07 | 79.5/92.0/95.0 | 48.5/48.8/49.6 | -39.0% |
| T08 | 90.9/107.1/107.7 | 48.2/48.7/48.7 | -47.0% |
| T09 | 91.1/98.1/99.8 | 48.3/49.8/54.8 | -47.0% |
| T10 | 112.8/126.5/136.7 | 50.0/51.8/60.7 | -55.7% |
| T11 | 48.1/48.8/48.9 | 48.1/48.4/48.5 | +0.0% |
| T12 | 48.3/48.9/48.9 | 48.2/48.7/48.7 | -0.2% |
| T13 | 55.5/57.0/57.7 | 48.4/50.5/65.1 | -12.8% |
| T14 | 48.3/48.7/48.8 | 48.4/48.9/48.9 | +0.2% |
| T15 | 170.6/187.3/197.8 | 48.1/48.4/49.0 | -71.8% |
| T16 | 78.0/90.3/102.8 | 48.4/48.8/48.9 | -37.9% |
| T17 | 431.1/431.5/431.8 | 431.7/432.2/432.2 | +0.1% |

#### 844×390, CPU1×, pwa-offline, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 97.8/118.1/244.1 | 49.3/50.9/51.1 | -49.6% |
| T02 | 138.6/162.0/163.6 | 48.4/48.8/48.9 | -65.1% |
| T03 | 79.8/90.7/92.9 | 48.7/49.0/49.0 | -39.0% |
| T04 | 167.7/185.7/195.5 | 47.5/48.3/51.5 | -71.7% |
| T05 | 81.4/93.0/95.1 | 48.4/48.7/48.8 | -40.5% |
| T06 | 78.0/89.3/93.1 | 48.6/48.8/48.8 | -37.7% |
| T07 | 79.2/82.5/88.6 | 48.6/49.0/49.0 | -38.6% |
| T08 | 93.7/103.6/106.6 | 48.6/48.8/48.9 | -48.1% |
| T09 | 94.0/106.8/109.1 | 48.7/48.9/48.9 | -48.2% |
| T10 | 114.3/124.3/141.2 | 49.2/51.0/52.1 | -57.0% |
| T11 | 48.5/48.9/53.7 | 48.4/48.7/48.8 | -0.2% |
| T12 | 48.8/49.0/49.0 | 48.7/48.9/48.9 | -0.2% |
| T13 | 52.1/56.1/57.6 | 48.7/49.9/50.6 | -6.5% |
| T14 | 48.8/48.9/48.9 | 48.7/48.9/50.2 | -0.2% |
| T15 | 163.3/178.8/185.4 | 48.5/48.7/48.8 | -70.3% |
| T16 | 78.0/89.5/91.8 | 48.6/48.9/49.0 | -37.7% |
| T17 | 431.5/432.1/432.2 | 432.0/432.2/432.3 | +0.1% |

#### 844×390, CPU4×, network, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 434.5/450.2/462.3 | 145.1/157.1/160.9 | -66.6% |
| T02 | 630.1/649.5/683.1 | 47.1/56.7/65.4 | -92.5% |
| T03 | 319.3/367.1/371.6 | 52.2/68.7/72.9 | -83.7% |
| T04 | 640.5/672.6/688.8 | 51.1/108.6/109.6 | -92.0% |
| T05 | 323.7/343.8/353.7 | 47.4/58.7/65.4 | -85.4% |
| T06 | 301.4/330.2/346.5 | 46.2/48.5/55.3 | -84.7% |
| T07 | 318.8/334.3/343.2 | 47.4/49.9/51.1 | -85.1% |
| T08 | 315.7/337.8/356.5 | 45.8/47.3/71.5 | -85.5% |
| T09 | 313.9/329.2/329.5 | 46.5/47.7/48.4 | -85.2% |
| T10 | 401.5/431.7/432.8 | 122.0/138.2/141.7 | -69.6% |
| T11 | 87.8/95.9/96.2 | 50.2/54.7/65.4 | -42.8% |
| T12 | 50.9/54.0/56.2 | 47.1/48.5/55.1 | -7.5% |
| T13 | 140.0/144.3/149.5 | 106.6/129.4/139.4 | -23.9% |
| T14 | 51.5/64.1/75.1 | 46.5/47.4/47.4 | -9.7% |
| T15 | 625.3/658.4/667.1 | 88.2/105.6/117.7 | -85.9% |
| T16 | 300.8/338.3/362.6 | 46.9/48.0/49.1 | -84.4% |
| T17 | 428.5/430.6/430.9 | 430.2/431.2/464.8 | +0.4% |

#### 844×390, CPU4×, network, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 391.1/406.6/410.3 | 109.9/117.1/128.5 | -71.9% |
| T02 | 594.9/626.6/640.6 | 46.4/47.8/47.8 | -92.2% |
| T03 | 307.6/322.5/323.6 | 48.0/53.4/57.1 | -84.4% |
| T04 | 639.1/662.7/665.0 | 52.4/55.9/69.7 | -91.8% |
| T05 | 322.1/345.8/355.4 | 47.9/52.0/55.0 | -85.1% |
| T06 | 304.4/333.6/334.4 | 46.8/47.7/49.2 | -84.6% |
| T07 | 304.4/329.6/329.7 | 46.7/48.1/48.4 | -84.7% |
| T08 | 320.2/346.0/361.1 | 45.8/47.5/50.4 | -85.7% |
| T09 | 298.2/327.6/341.8 | 46.8/49.0/63.4 | -84.3% |
| T10 | 393.8/415.3/446.9 | 123.6/139.8/140.7 | -68.6% |
| T11 | 86.3/107.6/113.6 | 51.5/53.4/55.4 | -40.3% |
| T12 | 51.3/55.0/61.2 | 46.5/47.4/47.5 | -9.4% |
| T13 | 136.3/140.1/146.5 | 113.4/126.1/138.0 | -16.8% |
| T14 | 49.5/53.6/54.0 | 46.9/48.2/49.4 | -5.3% |
| T15 | 621.9/640.3/642.2 | 88.2/95.3/106.0 | -85.8% |
| T16 | 303.8/315.8/316.8 | 46.7/47.4/47.8 | -84.6% |
| T17 | 429.3/430.8/430.8 | 429.8/430.8/431.1 | +0.1% |

#### 844×390, CPU4×, pwa-offline, cold

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 709.7/724.4/750.3 | 223.8/234.2/234.5 | -68.5% |
| T02 | 1011.9/1046.9/1057.1 | 50.1/62.1/64.9 | -95.0% |
| T03 | 538.3/560.4/572.2 | 47.8/51.0/56.2 | -91.1% |
| T04 | 1064.3/1133.7/1161.8 | 72.8/94.1/113.2 | -93.2% |
| T05 | 528.1/545.4/556.8 | 51.8/55.0/57.2 | -90.2% |
| T06 | 515.3/547.9/559.3 | 46.4/49.6/52.7 | -91.0% |
| T07 | 521.5/544.3/546.2 | 52.9/56.6/58.9 | -89.9% |
| T08 | 517.6/560.0/575.5 | 45.5/47.8/49.9 | -91.2% |
| T09 | 516.7/529.4/534.7 | 46.2/48.4/53.2 | -91.1% |
| T10 | 660.6/689.0/693.7 | 184.0/197.8/198.3 | -72.1% |
| T11 | 133.8/143.2/158.5 | 53.3/55.9/56.0 | -60.2% |
| T12 | 71.0/75.2/75.5 | 45.9/47.4/47.5 | -35.4% |
| T13 | 209.8/220.9/230.6 | 171.6/184.1/185.4 | -18.2% |
| T14 | 69.8/74.1/75.7 | 46.3/47.6/48.2 | -33.7% |
| T15 | 1003.1/1035.5/1035.6 | 125.3/134.4/135.4 | -87.5% |
| T16 | 511.6/521.7/527.2 | 46.0/48.0/48.0 | -91.0% |
| T17 | 427.2/428.5/429.4 | 428.5/430.3/440.9 | +0.3% |

#### 844×390, CPU4×, pwa-offline, warm

| Переход | До, мс | После, мс | Δ медианы |
| --- | ---: | ---: | ---: |
| T01 | 635.5/653.3/654.5 | 169.9/174.2/179.0 | -73.3% |
| T02 | 971.8/991.5/999.7 | 46.0/48.8/50.1 | -95.3% |
| T03 | 499.5/517.6/520.7 | 51.1/58.5/60.1 | -89.8% |
| T04 | 1023.3/1046.7/1072.9 | 54.1/60.5/62.6 | -94.7% |
| T05 | 509.3/518.4/525.4 | 52.2/58.7/61.9 | -89.8% |
| T06 | 495.2/513.8/526.2 | 45.8/46.9/48.1 | -90.8% |
| T07 | 503.6/526.4/539.2 | 54.4/57.8/58.7 | -89.2% |
| T08 | 507.1/521.0/526.3 | 45.5/52.6/59.5 | -91.0% |
| T09 | 501.6/512.4/518.4 | 44.9/47.0/48.2 | -91.0% |
| T10 | 640.8/664.7/669.5 | 179.4/198.0/203.8 | -72.0% |
| T11 | 134.4/139.8/140.5 | 53.8/58.4/63.5 | -60.0% |
| T12 | 71.3/76.7/79.9 | 46.1/47.6/48.0 | -35.3% |
| T13 | 202.4/218.4/219.0 | 171.3/190.0/190.2 | -15.4% |
| T14 | 70.3/77.3/86.9 | 46.2/47.3/48.3 | -34.3% |
| T15 | 980.2/1003.7/1007.8 | 127.3/141.6/142.2 | -87.0% |
| T16 | 497.6/519.6/534.2 | 46.5/48.2/49.4 | -90.7% |
| T17 | 427.1/429.4/429.4 | 428.2/430.0/443.5 | +0.3% |

</details>

### Контроль legacy на том же основном профиле

Существующие анимации входят в время; у legacy нет отдельного шага Startsummary. Все остальные32контрольные конфигурации и их20samples доступны в тех же report.json.

| Переход | До m/p95/max | После m/p95/max |
| --- | ---: | ---: |
| Меню → Игра | 562.6/579.4/579.5 | 562.4/578.6/579.6 |
| Игра → Игроки | 930.1/946.9/947.6 | 939.2/961.7/978.9 |
| Игроки → Правила | 919.8/945.0/945.1 | 918.6/945.1/945.2 |
| Настройки режимов: открыть | 51.3/72.5/79.3 | 49.4/74.7/83.6 |
| Настройки режимов: закрыть | 76.7/91.1/92.2 | 81.4/89.4/93.5 |
| Правила → Игроки | 929.2/957.3/960.9 | 930.0/949.8/955.3 |
| Игроки → Игра | 562.8/578.6/579.4 | 562.4/563.5/563.7 |
| Игра → Темы | 562.6/578.7/579.3 | 561.9/564.0/579.8 |
| Тема → Игроки | 496.7/512.6/520.1 | 500.5/510.6/514.0 |
| Вернуть стандартный набор | 929.9/948.8/951.9 | 935.1/948.3/958.2 |
| Игра → Меню | 428.6/429.6/429.6 | 429.0/430.7/430.7 |

### Разделение затрат основного профиля

JS/style/layout — медианы20samples,мс; Paint — один отдельный representative trace, не p95.

| Переход | JS до→после | Style до→после | Layout до→после | Paint до→после | TBT median до→после |
| --- | ---: | ---: | ---: | ---: | ---: |
| Игра → Игроки | 950.46→4.13 | 2.16→2.14 | 2.66→2.53 | 1.83→1.67 | 906.0→0.0 |
| Игроки → Правила | 471.90→3.57 | 5.29→4.71 | 4.86→5.11 | 5.66→5.97 | 435.0→0.0 |
| Правила → Старт | 481.67→3.70 | 4.12→3.70 | 2.67→2.47 | 2.07→2.83 | 438.0→0.0 |
| Старт → Правила | 477.24→4.03 | 3.85→4.11 | 4.38→4.60 | 6.48→5.13 | 437.0→0.0 |
| Настройки режимов: открыть | 982.32→14.09 | 5.49→5.22 | 15.21→10.03 | 8.20→6.74 | 956.0→0.0 |
| Меню → Игра | 615.77→143.61 | 2.64→2.88 | 2.66→2.78 | 2.76→2.51 | 572.0→99.0 |
