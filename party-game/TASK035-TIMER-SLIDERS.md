# TASK035 — таймер и отклик ползунков

Исходный принятый main: `651940652f4a4e582eed18a34646004006792aa3`. TASK034 не повторяется; её принятую геометрию сохраняем. PR #187/#188 объединены, все шесть post-merge workflows main прошли, включая Game16/16 и mobile5/5. Физическая обратная связь владельца подтверждает нормальный внешний вид на телефоне девушки; модель/ОС неизвестны, полного физического acceptance TASK035 нет.

## Таймер

Кольцо и цифры получают доступное действие только там, где действующий allowPause() это допускает: раскрытое task → start-timer, play → pause, paused → resume. В скрытом task, countdown, feedbackHold или без allowPause кольцо остаётся отображением. Отдельная кнопка паузы удалена, остальные кнопки сохранены. Используются прежний handleAction и неизменённый timer-controller; timerPolicy, deadline, remainingMs, feedbackHold, RNG и правила не меняются.

Enter/Space работают один раз на keydown, repeat игнорируется, фокус восстанавливается после пересоздания DOM, в том числе после командной транзакции. Focus outline не занимает места. Нативная отмена click при touch scrolling дополнена порогом перемещения8px; pointercancel тоже отменяет действие. Область остаётся вертикально прокручиваемой, touch-action не запрещается.

Новый timer.cjs проверяет оба формата, 320×568/390×844/844×390 и100/200%, старт/паузу/продолжение, шесть быстрых trusted taps, Enter/Space, скролл Chromium и реальные отключение loopback-сервера/offline reload с точным RAW. Таймерные JS/Node-контракты отдельно охватывают исторический Mixed и версионированные партии. Геометрия измеряется после окончания анимаций. WebKit остаётся1.64.0, Chromium инструменты1.55.0; browser versions фиксируются в CI.

## Причина задержки и изменение

Baseline измеряется из неизменяемого main651 тем же скриптом, браузером и CPU4. Native input синхронно вызывал renderOptions и persist. Числовые параметры меняли ключ кеша setup-wizard; общий рендер выполнял проверки режимов/набора и renderGameTypeCounts. На полном trusted drag времени получено246 input →953 checkContentPack/2451 getPackCardPool. Это реальная тяжёлая работа внутри input, не гипотеза по исходникам. Первичный локальный замер дал median≈292ms/p95≈584ms; итоговые условия и числа берутся из полного одинакового before/after CI, не из разовых прогонов с параллельными процессами.

Теперь input сразу обновляет options и небольшой DOM-проектор значений/подписей/quick choices/summary/footer. Общий рендер каталога на этот путь не вызывается. Четыре числовых параметра не определяют достижимость контента в текущем checkContentPack, поэтому исключены только из UI cache keys; ссылки на каталоги/validator/config и все параметры доступности остаются частью stamp. START по-прежнему вызывает настоящий полный validator, независимо от UI cache. Полный рендер сохраняется для изменений сложности, режимов, источников, типов, набора и профилей.

Записи настроек объединяются на150ms тишины; change/blur/pointercancel/Back/navigation/START/pagehide/beforeunload/hidden visibility синхронно завершают последнюю запись. Модель options обновляется на каждом input до любого отложенного действия. Механизма откладывания фактического значения нет.

2×2 прежде вообще не сохранял черновик настройки до START. Для четырёх числовых UI-предпочтений добавлен отдельный маленький guarded slot `kvip:teams-2x2:setup-ranges:v1` (version1, четыре значения с проверкой min/max/step). Он читается только при явном входе в настройку2×2 и не меняет активный record, roster, ledger, профили, дуэльный RAW или историю. Неизвестная/повреждённая версия или конкурентное изменение блокируют запись в этот слот; исходная строка сохраняется, пользователь получает сообщение о неудаче. START по-прежнему выполняет прежнюю транзакцию. Это UI-предпочтения, не новая версия партии.

## Проверки и артефакты

- task035.test.cjs: timer policy и неизменный clock controller; отсутствие побочных действий/RNG; pending input→START; реальный validator; corrupt/future save guard; exact approved hunk normalizer с отрицательным контролем.
- range-lifecycle.cjs: все4 ползунка × оба формата; native change, pending Back, reload, pagehide без change, реальный START и cold offline resume; неизменность game/history/profiles/team RAW до START; unknown preference version не перезаписывается.
- sliders.cjs: trusted native touch drag, track tap и keyboard; CPU4, n20 для каждого вида ×4×2, полные сырые события input и actual/label, frame latency, счётчики вызовов и времени функций на input. Порог median≤50ms/p95≤100ms, полный checker/pool на input=0. Сохраняются PNG, Playwright traces, V8 CPU profiles, JSON каждого случая и summary.
- Все существующие game/mobile/profile/team/history/PWA/raster и TASK029–032 performance checks остаются обязательными. Старые byte guards разворачивают только явные точные hunks из reviewed-hunks.json; остальные байты сравниваются по прежним SHA. PWA меняет только resource versions/cache name, lifecycle install/activate/fetch прежний. Старые upgrade tests направлены на актуальный worker/кольцо после обновления, исторические исходники не меняются.

Точные Head, CI, финальные показатели и ссылки на artifacts публикуются в единственном Draft PR TASK035 после полного прогона. До этого приёмка не объявлена завершённой. Без merge, публикации, словарных правок, платежей/облака или изменения коммерческих прав.

## Зафиксированная приёмка production9b

Целевые [PR CI3/3](https://github.com/Demian-rus/quantum-portal/actions/runs/40855981095) и [push CI3/3](https://github.com/Demian-rus/quantum-portal/actions/runs/40855935931) прошли для production Head `9b1b01d446c9b6f9148219b4c77864898e3cd1d4`. GitHub PR checkout использовал синтетическое merge-дерево `476a09c601afba8c858170344c99f7266158762c`, что честно отражено в raw summary. Последующие исправления приёмки уточняют неоднозначные селекторы (сохранённая стартовая button и новое кольцо), удалённый header pause и точные resource/cache versions; production остаётся побайтно прежним. Финальный Head и полный повтор Game/mobile/TASK035 фиксируются в [единственном Draft PR #198](https://github.com/Demian-rus/quantum-portal/pull/198).

Chrome156.0.8078.47, viewport390×844, DPR2.625, mobile+touch, CPU4; одинаковый harness и n20 на каждый вид ×4 ползунка ×2 формата. По480 взаимодействий и2248 проверенных trusted input событий на каждой стороне. Замер — от начала обработки native input до следующего requestAnimationFrame с проверкой фактического options и подписи; это не измерение физической панели телефона. Счётчики ниже включают один прогревочный жест каждого сценария.

| Ползунок: худший результат среди2 форматов и3 видов | median до → после, ms | p95 до → после, ms |
| --- | --- | --- |
| base-duration |188.3→5.9|203.6→18.8|
| target-score |187.7→6.2|195.7→17.5|
| custom-rounds |188.9→15.8|201.4→18.9|
| modifier-chance |190.1→19.0|201.7→20.8|

Суммарно на input: checkContentPack10166→0; getPackCardPool26142→0. В V8 profiles исходного рендера преобладают именно каталог/пулы, а не persist. После изменения полные проверки между сценариями остаются видны в профиле и по-прежнему выполняются при START; они не подменены mock. Порог median50/p95100ms не изменён.

Таймер: Chromium12/12 + WebKit12/12. По72 состояния и240 скалярных сравнений x/y/width/height на движок; maxdelta0px. Всего144 состояния/480 сравнений,144 быстрых trusted taps, Enter/Space, остаток без сброса, offline paused RAW и отсутствие изменений задания/очков/истории. Trusted вертикальный скролл дополнительно проверен в Chromium. 200% в WebKit — computed-font stress, в Chromium — проверяемый text-size-adjust probe16→32px; оба метода не выдаются за физический OS display zoom.

Range lifecycle:8/8 сочетаний,48 утверждений о native change/Back/reload/pagehide/real START/offline resume, плюс защита неизвестной версии отдельного preferences slot. Неизменность live game/history/memory/profiles/team RAW проверяется до START. Последующие полные inherited suites сохраняют прежние проверки статистики/backup/истории/rollback и budgets TASK029–032.

| Исходный архив (JSON, PNG, трассы) | SHA256 ZIP |
| --- | --- |
| [sliders + lifecycle;4 traces и4 CPU profiles](https://github.com/Demian-rus/quantum-portal/actions/runs/40855981095/artifacts/12889418301) |`2d8d580aa90b4189b23f029748b9f009efd5f6108ccdfe1e70797208f482946a`|
| [timer Chromium;60 PNG](https://github.com/Demian-rus/quantum-portal/actions/runs/40855981095/artifacts/12889456886) |`ebc44513a38df199a0ccfb14981def18bfed1a31b14af491eef2db885be0416f`|
| [timer WebKit;60 PNG](https://github.com/Demian-rus/quantum-portal/actions/runs/40855981095/artifacts/12889447144) |`b52cab97149e330b4593efdd88195cbb63380347ad26d96f843b222463a5bae1`|

Все три оригинальных ZIP повторно скачаны, SHA256 и CRC проверены. Срок хранения —27 января2027. Исходные failed Game/mobile runs также сохранены; они не выданы за успешные. После уточнения селекторов полный UI/PWA/raster прогон повторяется без ослабления assertions. Новые основные правила CSS и коммерческие allowlist/контракты не изменяются. Локальная Commercial проверка13/13 и exact-SHA dry-run на132031a2 сохранили networkOperations=[], cloudResources=[], releaseEnabled=false.
