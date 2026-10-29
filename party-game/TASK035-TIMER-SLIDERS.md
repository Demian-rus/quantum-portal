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
