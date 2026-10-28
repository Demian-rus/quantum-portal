# TASK034 A — коммерческий каркас без изменения действующей игры

Issue: https://github.com/Demian-rus/quantum-portal/issues/186

Исходный подтверждённый Base: `4b84dc88bc39e0b0b4145dce240a0a66d964248a` (TASK028–033 и G46). Все production-файлы `party-game/`, включая index, sw, manifest, словари, профили, статистику и движки, остаются побайтно прежними. Внутри party-game добавлен только этот технический документ. SHA финального Head и точные push/PR CI фиксируются в Draft PR A.

Полный контракт, границы и инструкции: [commercial/README.md](../commercial/README.md).

| Требование | Реализация / проверка |
| --- | --- |
| Весь нынешний каталог бесплатен | Адаптер всех 67 версий, стабильные id/version, будущие бесплатные G без фиксированного лимита |
| Free/purchased/granted/owner | Серверная политика; fake-флаги клиента, другой account и просроченные grants не дают доступ |
| Бессрочный владелец / подарки | Trusted admin grant; wildcard owner включает новые наборы; grant+audit идемпотентны |
| Серверная выдача | Auth, действующие grants и audit до чтения материала; default fail-closed; API origin отделён от PWA cache |
| Подписанные права | Ed25519, account/key/time binding; snapshot не заменяет авторизацию контента |
| Разделение профилей | Ни одного обращения к localStorage/профилям/duel/team RAW из коммерческого каркаса |
| Premium/debug не в public | Явный allowlist, точный git SHA, замыкание HTML/CSS/SW ресурсов, только синтетические данные |
| Платформы | public-web; отдельная debug цель; Android/iOS только честно обозначенные шаблоны без APK/IPA |
| Публикация | Только dry-run с SHA256/размерами/планом; execute и облачные операции отсутствуют |
| Текущая PWA | Ни один ресурс/версия/cache name/manifest не изменён; существующий CI сохранён |

Базовый main CI: [Game checks](https://github.com/Demian-rus/quantum-portal/actions/runs/40720686272), [Smoke](https://github.com/Demian-rus/quantum-portal/actions/runs/40720686350). Его имеющиеся screenshots/geometry служат исходными доказательствами до отдельного независимого PR B. Физическая модель владельца и девушки неизвестна; ни эмуляция, ни произвольный viewport не обозначаются их устройствами.

Реальный коммерческий запуск потребует перечисленных в основном документе auth/DB/payment/security/platform работ и отдельного разрешения владельца. Нынешний PR не является разрешением на merge, Ready, публикацию, смену приватности или подключение инфраструктуры.

Дополнительная проверка независимой интеграции: новый бесплатный CSS из PR B потребует явного включения в public allowlist после review. До этого сборка откажет, не выпуская неполный offline bundle. Сам PR A не подключает этот CSS и не содержит исправлений B. Каркас содержит 13 contract/security/build тестов; точные CI финального Head — в описании PR A.
