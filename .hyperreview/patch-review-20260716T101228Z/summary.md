# HyperReview: combined code-room rail shell

Verdict: PASS

Target: branch `feat/code-rail-preamble-combined` at exact head `58beae8850d6762cb315f800a574df362a89d7f7`, reviewed against accepted base `afb45e4d16ebb2e0a9d8664e80142c401ce58a52`.

## Tier

Full review was required because the target is a branch and contains 594 reviewable hand-authored lines across 6 files. No generated, vendored, or lockfile churn was counted.

Facet authored the change on `anthropic/claude-opus-4-8` at medium effort. Chisel reviewed it on `openai/gpt-5.6-sol` at high effort, providing a different-family review. The author tuple is not listed exactly in reviewer matrix v0.4.0, so assurance is `no_eligible_parity_reviewer` rather than parity-cleared.

## Result

No accepted findings.

- The branch is a single rail-shell commit directly atop accepted head `afb45e4`; it preserves the separate preamble commits, compact two-line agent identity row, editable plan and goal, and PR status implementation.
- The 46px desktop collapse state, per-user localStorage keying, focus transfer, Escape focus restoration, outside-pointer dismissal, and sub-1100px top-bar fallback match the stated contract.
- The slate reskin `187b91e` is a separate theme change. The provenance commit `55bab00` is a backend migration and bot-write slice. Neither is a prerequisite for this rail delivery, so both remain out of scope.

## Verification

- Node 24.18.0: full `pnpm check` PASS.
- Focused Chromium: 4/4 PASS for `code-channel-mode.spec.ts` plus `code-rail.spec.ts`.
- Changed timing surface: `code-rail.spec.ts --repeat-each=5` PASS, 15/15 with 4 workers.
- Exact ancestry, tree, author, changed paths, and nearby source inspected.

## Rejected candidates

- Concurrency specialist route rejected: `await tick()` sequences focus in a single browser event loop; there is no shared mutable state, thread, lock, queue, or parallel executor for TSAN-style scaffolding.
- Mixed 20-test stress failure rejected as pre-existing: repeated `code-channel-mode` cases reuse globally unique handle `chisel-stock`, unchanged from `afb45e4`. The changed rail suite passes repeated parallel execution cleanly.
- Preference leakage rejected: localStorage keys include the signed-in user id and reactive user changes reload the corresponding value.
- Responsive side-strip conflict rejected: the later `max-width: 1100px` rule restores a one-column layout and a compact top bar.

## Next action

The exact source head may proceed to the branch push and live deployment gate. Keep `187b91e` and `55bab00` separate unless ragesaq explicitly adds those product slices.

cleanResult: true

hyperreview: patch-review, xfam, openclaw, openai/gpt-5.6-sol/high → PASS
findings: none
outcome: no-action → exact head may proceed (confidence high)
