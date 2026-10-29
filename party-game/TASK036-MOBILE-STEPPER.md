# TASK036 — ровные этапы «Мастера»

Base: `76edbc0c1083060952fce004a1400fcbf6db15e3` (merge TASK035 #198). Issue #203. Единственная ветка `feat/quip-task036-mobile-stepper-20261029`; только Draft PR, без merge/публикации.

Причина: четыре равные колонки содержали flex-кнопки с номером и длинной подписью «Кто играет?». Правило TASK034 `flex-wrap:wrap` переносило подпись под номер только во втором этапе. На320px/100% круг второго этапа выше остальных; при200% `overflow-wrap:anywhere` дробит также текст. Это подтверждается PNG и bounding rectangles неизменяемого base, а не только исходниками.

Названия навигации теперь «Игра / Игроки / Правила / Старт». Каждая кнопка — одинаковая сетка из двух строк: круг и подпись. Весь столбец доступен подписи. Локальные gap/padding и tracking-.04em позволяют сохранить прежние9/10px при100% и читаемый текст при200%, без scale/общего уменьшения шрифта. Круг сохраняет одинаковую область во всех этапах; em также позволяет ему увеличиваться при computed-font stress. Фокус остаётся внутри hit area. Новые правила scoped к `.setup-wizard .wizard-steps`; игровой style.css и принятый responsive-layout.css неизменны.

Повторный kicker «ШАГ N ИЗ 4» скрывается через hidden и остаётся пустым на всех четырёх шагах, включая темы; места не занимает. Все h1 и пояснения сохранены, в том числе h1 «Кто играет?». «ОБЩИЙ ЦЕНТР» в настройках режимов остаётся полезной видимой подписью. На каждой кнопке доступное имя «Этап N из 4: Название», визуальный номер aria-hidden; прежний aria-current=step остаётся источником текущего шага. Существующие обработчики навигации не менялись.

Production delta ограничена setup-wizard.js/css и versioned HTML/SW loaders (JS11/CSS7/cache102). SW lifecycle прежний. `reviewed-hunks.json` разворачивает только точные согласованные hunks перед историческими byte guards; отрицательные контроли не допускают скрыть посторонние edits. Ни словари, ни runtime/controller/таймер, профили, схемы хранения или commercial не меняются. Старые upgrade assertions получают только актуальные точные версии ресурсов/cache.

## Приёмка

`diagnostics/task036/stepper.cjs`: один harness/browser на неизменяемом base и кандидате. Все15 профилей существующей матрицы TASK034,100/200%, оба формата,4этапа:240состояний на сторону. Chromium tooling1.55.0, только WebKit1.64.0. PNG, реальные rectangles кнопок/кругов/подписей/строк текста, RAW JSON и Playwright traces. Проверяются выравнивание обеих строк, равные hit areas≥44px, отсутствие wrapping/overflow/пересечений, текущий ARIA, h1 focus, отсутствие места kicker. Детектор обязан отвергать сдвинутый круг и multiline-подпись.

Trusted step taps, Enter/Space, Tab/focus-visible, Escape, видимый Back и native history Back сравнивают весь localStorage и модель, включая RAW партий, профили/историю. Центр правил сохраняет подпись и возвращается Escape. CPU4/n20 на каждом из4переходов и обоих форматах для всех11Chromium viewport, одинаково before/after; definition pointerdown→presented frame изTASK029. Прежние budgets median≤200ms/p95≤350ms; полные checkContentPack/getPackCardPool=0 на обычных переходах. WebKit не выдаётся за физический iPhone, computed-font stress не выдаётся за OS zoom.

Полные inherited Game/Logic, Browser/Profiles/Teams/History, Raster, Mobile/PWA/offline, Smoke остаются обязательны. Окончательные Head/CI/цифры и ссылки на исходные артефакты публикуются в Draft PR после завершения; локальный pilot не считается полной приёмкой.

## Следующий этап TASK037

Изученные реальные узлы: дуэльные `.setup-grid .team-input-wrap`, `#team-a/#team-b.profile-selector`; командный `#team-setup .team-profile-grid`, fieldset/legend, `.team-profile-slot`, `#team-profile-0-0`…`#team-profile-1-1.profile-selector`. Общий profile dialog и permanent ID принадлежат существующим profile/team контроллерам. Следующая самостоятельная задача может локально оформить эти selector-кнопки карточками участников и сгруппировать2×2 существующими fieldset, сохранив прежний dialog, dataset/bindings, ID и модель. Сначала before/after визуальное сравнение обоих форматов; затем строгая проверка4слотов, дублей/смены профиля, START/транзакций/RAW и CPU4. Реализация TASK037 до приёмки TASK036 не начинается.
