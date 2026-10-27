# TASK029 — Android wizard responsiveness

Issue [#153](https://github.com/Demian-rus/quantum-portal/issues/153). Baseline: published main `8dd989f4017fa48d4279f243d13012ade1710a63`. TASK027 is already accepted. TASK028 PR #152 is a separate Draft and is not modified by this task. This branch is a candidate: no merge or PWA publication is authorized.

## Measurement protocol

`mobile-perf.cjs` serves an immutable `git archive` of the baseline and the candidate from separate local HTTP origins on the same Actions runner. Both variants use the same Chrome process/version, hardware, Pixel7 Android13 UA, mobile/touch flags, DPR2.625, input protocol, counters, and sample count. Source data, profiles and game controllers are real. Test profiles are explicitly provisioned through the existing controller; no production user data is accessed.

- CSS viewports: **320×568, 390×844, 412×915, 844×390**. `isMobile:true`, `hasTouch:true`, Android UA; every measured input must be a trusted `pointerType=touch`. Assert exact inner dimensions/DPR, coarse pointer, no hover and touch capability. Environment JSON and mobile screenshots are saved before timing.
- CPU **1× and 4×**, separate network loading (CDP bypasses SW and HTTP cache) and genuine installed **PWA cold offline** loading. Service Workers remain enabled. Assert actual SW responses in offline cases.
- **20** samples for each transition/configuration. Warm = untimed complete route then repeated navigation. Cold = new document/JS realm after reload, with installed PWA data retained. This is not an OS/device cold restart. Navigation Timing/FCP and DOM readiness are separate from transition timings; warmed navigation is not called startup time.
- From the browser's trusted pointerdown timestamp to the correct DOM, completed finite root entrance animation, next animation frame and after-paint task. Playwright scroll/actionability before the actual tap is excluded. This is a conservative rendered-frame proxy, not physical screen presentation telemetry. Event Timing is recorded where Chrome exposes it.
- Report nearest-rank median/p95/max, ScriptDuration, RecalcStyleDuration, LayoutDuration, TaskDuration, Long Tasks and blocking time. One separately traced representative route per case includes Paint/Raster/Layout/Layerize and user-timing interval marks. CPU profiler and function-call instrumentation run in a separate attribution pass, outside the statistical timing loops. Inclusive function times must not be added together.
- Both interfaces are measured under matching conditions. Legacy has no four-step Start summary: do not invent a legacy equivalent for that transition. Its existing finite scene animations are included and reported separately from JS work.

Main transitions: menu→catalog, standard→players, players→rules, rules→Start, each reverse step, mode settings open/close, themes open/select/back and return to standard. The route ends in standard configuration for both interfaces. All samples, startup records, network/SW evidence, environment, PNGs, trace JSON and `.cpuprofile` are Actions artifacts. Paired before/after numbers on the final Head are recorded in the Draft PR, not extrapolated from different runners.

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

For one full attribution route: `checkContentPack`86 calls/8251.7ms inclusive; `getPackCardPool`507/7873.2ms inclusive. V8 stacks place the time under `show → legacy.renderOptions → checkContentPack/getPackCardPool`. Standard selection renders through `openSetup`, then `show` repeats the whole renderer. Opening mode rules calls `modeRules` from both `renderMeta` and `show`. 1187 of1518 observed mutations target hidden elements. By comparison, selected-player checks total1.8ms and profile rendering13ms. Representative style/layout/paint each take single-digit milliseconds on ordinary transitions; there is no repeated image decode in their warm trace.

Blur ablation is n20 on the same pilot: catalog→players1000.3/1021.2ms; players→rules519.5/530.2ms. This does not account for the main delay. **SwiftShader is the runner GPU**: this comparison cannot rule out a different blur cost on a physical Android GPU. The owner's physical2–4s observation is not claimed to be reproduced exactly: the measured emulator delay is about0.5–1s on these ordinary actions. A separate n1 exploratory trace is explicitly not acceptance statistics.

## Local fix and correctness boundaries

Only `setup-wizard.js` changes production behavior. Existing48 controllers, all catalogs/historical versions, game CSS, RNG, scoring, profiles, storage and START handler remain byte-exact.

The adapter retains the last real settings render stamp: all current settings except unused pack-preference history, selected profile IDs/problem, profile-store reference, catalog references and config/validator function identities. Pure presentation navigation does not discard real validated state. Initial mode tiles copy the live checked/disabled/reason/art/points state from the controls that `app.boot` has already rendered. Missing future controls invalidate the stamp and run the real renderer. Changed settings/profile/config/catalog references refresh normally; legacy mode always invokes its unchanged renderer.

During a needed synchronous settings render only, identical default card-pool requests share one read-only result. Custom card/registry arguments delegate unchanged. The function is restored in `finally` before metadata or extension events; no cache reaches START, task selection or gameplay. This memo has no lifetime beyond one UI render. Mode rule descriptions use the real mode-toggle availability already computed by that renderer; song-source validation still runs. The duplicate center render is removed. No validation is disabled and no new storage is introduced.

TASK028's `renderMeta` extension event remains after metadata rendering and outside the temporary pool memo. Existing IDs, functions, mode registry and START button are retained. Integrating PR #152 later still requires its own rebase, resource-version reconciliation and full CI; this task does not alter its branch.

## Regression and delivery

`task029-browser.cjs`: true Android/touch/DPR profile at CPU4; n20 forward/reverse real taps; require **zero** repeated content validation/pool requests on pure steps, independently of CPU speed. Median≤200ms and p95≤350ms are conservative CI guards for this fixed profile, not an Android device guarantee. Report max/Long Tasks and all raw samples; one scheduling outlier is not hidden by asserting only a maximum. Real setting/profile/language changes and invalid input still validate; START validates afresh with the original pool function; legacy/data/offline behavior is checked. Existing TASK027 functional tests remain strict.

`task029-upgrade-browser.cjs`: actual published v90 SW → candidate → exact v90 rollback → candidate, native cache activation and cold offline each time, exact duel/profiles/earned history/paused timer. Candidate cache `kvip-pwa-v90-20261027-wizard-performance-candidate`, JS queryv2; 49 JS resources. The cache name indicates an unpublished candidate.

All original Logic/Browser/Mobile/PWA/Gameplay/Smoke remain mandatory. Final measured before/after, CI links, Head and artifacts belong in the Draft PR report. Do not declare success from functional tests alone. Physical Android owner acceptance remains necessary after separately authorized deployment.

Rollback: `?setup=legacy` or “ПРЕЖНИЙ ВИД” preserves data. Full release rollback uses a separately reviewed revert of TASK029 plus a unique SW cache for the restored bundle; never clear site data. The current-v90 rollback test verifies this source/schema boundary without publishing anything.
