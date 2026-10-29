# TASK037 — participant cards and profile selection

Base: ac7e2ce49c2c4dd066220b701ce00d801a5664e9. Issue #206. Existing branch feat/quip-task037-player-cards-20261029. Draft acceptance in progress; no merge or deployment.

The resumed workspace contained only the clean TASK035 checkout, with no TASK037 objects, PNGs or raw measurements. GitHub retained the TASK037 branch at the base. The recorded five-file implementation was reproduced against that exact base. Prior screenshots and measurements are not presented as recovered evidence. New reproducible before/after evidence must come from the acceptance workflow.

Two or four existing native profile selector buttons use shared participant cards, saved personal colors and wrapping names. Team accents identify the group separately from the personal dot. Mobile groups stack; wide layouts use two columns. The existing native button covers its card with a pseudo-element; no second event handler or dialog is introduced. Enter/Space, focus and cancellation remain owned by existing controllers.

The profile-name placeholder is removed without replacement. Label, required state, 24-codepoint validation, palette, errors and aria-describedby remain. profile-views.js, player-profiles.js, game styles, engines, dictionaries, commercial scaffold and storage schemas are byte-identical to the base.

Catalog projection cache previously keyed on profile identity as well as options. It now uses the existing settings stamp and catalog/API references. Profile changes still refresh the full UI, including eligibility of participants, but reuse read-only catalog projections. Settings/catalog/function changes invalidate it; explicit custom catalogs still bypass it. Wrappers exist only during synchronous rendering. Real START retains original validators/selectors and must be proved by read-through counters in acceptance.

Resource versions: setup-wizard.css 8, setup-wizard.js 12, team-controller.js 11, worker cache v103. No worker lifecycle changes. Reviewed exact hunks are reversed before inherited historical byte guards; unrelated mutations remain visible, with negative controls.

Acceptance pending: native touch/keyboard profiles, cancellation/unique IDs/missing profile/START, CPU4 n20 before/after and invalidation counters, mobile matrix and 100/200 text, PNG/rectangles/traces, RAW/reload/cold offline, historical upgrade/rollback, TASK035/036, full Game/Mobile/Smoke and commercial dry-run. Physical devices are not claimed tested.
