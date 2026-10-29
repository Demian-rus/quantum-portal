# TASK037 — participant cards and profile selection

Base: `ac7e2ce49c2c4dd066220b701ce00d801a5664e9`. Issue [#206](https://github.com/Demian-rus/quantum-portal/issues/206). Existing branch `feat/quip-task037-player-cards-20261029`; one [Draft PR #207](https://github.com/Demian-rus/quantum-portal/pull/207). Exact current Head, CI results and artifact links belong to that PR's acceptance report. No merge or deployment.

## Continuity and scope

The resumed workspace contained only the clean TASK035 checkout, with no TASK037 objects, PNGs or raw measurements. GitHub retained the TASK037 branch at the base. The recorded five-file implementation was reproduced against that exact base and saved immediately after basic checks. Prior screenshots and measurements are not presented as recovered evidence. New before/after evidence is generated from immutable base and candidate by the same committed runner.

Two or four existing native profile selector buttons use shared participant cards, saved personal colors and wrapping names. Team accents identify the group separately from the personal dot. Mobile groups stack; layouts from 700px use two columns. A pseudo-element extends the existing native button over its card; no additional handler or dialog. Enter/Space, focus and cancellation remain owned by existing controllers.

The profile-name placeholder is removed without replacement. Label, empty initial value, required state, 24-codepoint validator, palette, errors and aria-describedby remain. `profile-views.js`, `player-profiles.js`, game styles, engines, dictionaries, commercial scaffold and storage schemas are byte-identical to base.

At 200% native text inflation, a fixed arrow column allowed the glyph to collide with a wrapped name. The name selector now excludes the arrow, whose separate column sizes intrinsically with its actual text. The detector measures name and arrow glyph ranges, each name's own column, personal dot and button, with an intentional arrow/name collision as a positive control. General button rectangles alone were insufficient.

## Catalog cache and START

The catalog projection cache formerly keyed on selected duel profile IDs and profile-store identity as well as settings. It now keys on the existing settings stamp and catalog/API references; the complete UI stamp is retained. Profile changes still refresh selectors and participant validity, including missing/duplicate IDs, while reusing only read-only catalog results. Actual settings changes invalidate it. The generated card/question/pack catalogs are immutable; new catalog/API references invalidate their projection. Explicit custom catalogs still bypass the UI cache. Temporary wrappers exist only inside synchronous rendering; real START receives the original full validators and selectors.

The acceptance runner installs transparent read-through counters, warms only API identity changes, measures the first profile change, then 20 different previously unused test IDs. This avoids a misleading n20 result based on repeatedly choosing two already-warmed IDs. Team selectors are separately tested; their draft IDs were already outside the duel UI cache key.

Invalidation probes change difficulty, modes, prompt types and selected content pack; each must execute a real catalog check. Both native START paths must execute full checks. Test UI consumes zero game RNG; team START consumes exactly three opening draws.

## Reproducible acceptance

`diagnostics/task037/profiles.cjs` and `.github/workflows/quip-task037.yml` test the same immutable base and candidate in fresh contexts. CI rejects pilot/debug subsets. Native Chromium uses Playwright 1.55.0 with runner Chrome; WebKit alone uses the proven Playwright 1.64.0. Historical pinned raster Chromium is unchanged.

Matrix: 320×568, 344×720, 360×640, 360×780, 390×844, 412×732, 412×915, 667×375, 844×390, 932×430, 1024×768; WebKit 375×667, 390×844, 393×852, 430×932. Both formats at 100/200 text, empty and selected cards, maximum-length names, chooser and empty create form. Each PNG has source rectangles and glyph ranges in raw JSON. Existing TASK034 covers fixed gameplay card geometry, expanded menus, actual results/statistics, PWA and installed Chrome; TASK035/036 retain their full behavioral, performance and historical compatibility checks.

For Chromium at 100%, CPU4 applies to both variants' measurement blocks, n20 for each of nine trusted-touch actions in each format: open, create, color, back, choose, reopen, cancel, Players→Rules and Rules→Players. Timing is trusted pointerdown through the actual model/DOM state and next presented frame, using rAF followed by a task. Unchanged budgets: median ≤200ms, p95 ≤350ms. Raw samples and Chrome timeline traces are retained. Functional Playwright traces stop before timing to avoid recording hundreds of heavyweight DOM snapshots during performance measurements. No samples are discarded from the n20 block.

Functional coverage includes native create/validation/color/cancel, unique 2/4 IDs, disabled duplicate, reassignment/swap, absent profile blocking START, whole-card one-open gesture, Enter/Space/Escape/focus, and enlarged-text scrolling without selection in Chromium. Exact non-profile RAW is compared across profile operations. START stores snapshots with permanent IDs and colors. Re-entering standard setup may legitimately save pack preferences, so the test separately requires exact unfinished duel game/taskMemory throughout setup, then exact entire duel RAW across team START. It does not falsely demand that changing setup preferences leave those preferences unchanged.

Cold offline uses the real worker after every HTML script/style is present in CacheStorage, then destroys actual loopback TCP connections and reloads. All localStorage RAW and serialized game/taskMemory/profile store/team record must remain exact. No intercepted/mock responses or assertions removed. Nonzero personal/team statistics, backup, ledger, historical saves and rollback are covered by the inherited full Game/Mobile suites.

Resource versions: setup-wizard.css 8, setup-wizard.js 12, team-controller.js 11; worker cache v103. No worker lifecycle changes. Exact reviewed hunks are reversed before inherited historical byte guards; negative controls keep unrelated mutations visible. Current-version upgrade assertions track the actual resources; immutable old versions remain fixed.

Commercial tests and exact-SHA public build/deployment dry-run verify existing allowlist closure and offline resources without changing commercial architecture. Final acceptance requires full Game, Mobile/PWA, Smoke, TASK035/036/037 and historical upgrade/rollback success on the reported Head. Raw CI artifacts and limitations are linked in the PR report.

No physical device, OS text zoom, real iPhone Safari or installed iOS PWA result is claimed. WebKit GTK uses the existing documented deterministic font stress when native text-size-adjust is unsupported. The owner's earlier physical display approval is retained as context, not expanded into a full device test.
