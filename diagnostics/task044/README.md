# TASK044 acceptance evidence

Base: `9812c655cbb8333be91306836d8170827ecc4ddb`. Branch: `fix/quip-task044-stability`. Draft only; no merge/deployment.

The published Game Checks run [41645578429](https://github.com/Demian-rus/quantum-portal/actions/runs/41645578429) reproduced the condition-scroll expectation, extra-outcome card displacement and Approx raster failure. The TASK034 run [41645578374](https://github.com/Demian-rus/quantum-portal/actions/runs/41645578374) reproduced enlarged Blitz timer overflow.

## Changes

- Preserve 100% Blitz geometry; intrinsic timer bounds and one enlarged-text track contain the numerals at 200%. The existing game surface remains keyboard-scrollable when physical space is insufficient.
- Use one ordinary-round card track with/without the third outcome. Preserve complete unknown historical condition text in the game surface without a nested condition scroller.
- Render the independent Approx pixel comparison first in fresh contexts, before differing task layouts warm Skia's glyph cache. Retain the exact screenshot gate and first-failure evidence.
- Reuse exact-input pure SHA-256 results with bounded private caches, prepare SHA constants once, and reuse the immutable built-in dictionary environment. All validators, RAW checks, RNG, native CAS, strict writes and readbacks remain active. Native receipt readback is queued behind the strict writer on the same IndexedDB store; success awaits both completion events. Custom receipt providers keep their sequential contract.
- Use supported WebKit 1.64, matching TASK034/038. Keep complete localStorage equality, add independent explicit-key reads, exact origin/context checks, a device card/draft/queue, and offline exact party/RNG/memory restoration for both formats.

## Targeted checks at this checkpoint

- Blitz: 42 cases per engine, Chromium and WebKit; 100% exact accepted main card/ring/counter coordinates, 200% text/controls, 320/360/390/412 plus portrait/landscape boundaries. Repeat on final tree in Actions.
- `round-layout`: 5 devices × 7 modes; `round-outcomes`: all 5 devices PASS.
- TASK024: all 5 devices, exact Approx pixels and all condition/phase assertions PASS.
- TASK013B: real historical worker update/offline restore, exact old RAW/options/memory, unknown long text with keyboard access at 320/390 PASS.
- Extended TASK043 WebKit: all 4 widths, real server outage, cards/drafts/queue, both quip@2 parties and exact storage PASS.
- Targeted storage/engine/device contracts: 49 PASS. Additional checksum tamper/block-boundary and exact source/immutable-data tests are included in TASK044.
- Local Chromium 140, 15,000-card real START, CPU×4, N=20: main team median/p95 **245.7/391.3 ms**, candidate **213.3/272.3 ms**. Median still exceeds 200 ms here. Final acceptance must use supported Chromium 156 as in CI; no threshold changes.

`diagnostics/task044/start.cjs` restores the same real 27-profile/one-archive RAW and native receipt before every sample. Measurement includes trusted pointerdown, full validation, strict durability, first screen, two frames and the after-frame task. Diagnostic profiling is prohibited in GitHub Actions. Mandatory 200/350 ms median/p95 ceilings remain enforced.

Catalogs, all 248 TASK043 source rows, edition records and immutable locks are checked byte-for-byte against main. No content or game-rule changes are included. Final Actions and performance results are pending at this checkpoint.
