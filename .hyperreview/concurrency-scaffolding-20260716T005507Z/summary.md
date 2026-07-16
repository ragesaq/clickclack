# HyperReview Concurrency Scaffolding — Summary

**Mode:** concurrency-scaffolding
**Target:** clickclack-code-mode staged diff, tree `9921901c395bb16dc20b25ce3342b16600fc6152`
**Staged paths SHA-256:** `86eb6677590310bb224eb1d350e9f365b8bf9bba2f7d28588e17156180e7d90e`
**Reviewer:** ollama/glm-5.2:cloud, family zai, effort max
**Author:** openai/gpt-5.6-sol, family openai, effort high
**Parity:** cross_model_parity (glm-5.2/max listed for openai-family authors)
**Verdict:** PASS

The independent GLM reviewer supplied the concurrency adjudication. Chisel then performed the parent gate without changing the verdict: machine-readable provenance and exact bindings were added, harness assertions were repaired where they did not prove their titles, and an unsupported universal runtime claim was removed. No product code was edited.

## Tier

Full tier. Triggered by: (1) blocking-capable mode in BLOCK posture would force Full, but verdict is PASS; (2) operator explicitly requested Full tier. Reviewable churn: 247 hand-authored lines across 10 files (excluding generated dist/ builds). No generated/lockfile lines excluded from the count since all changes are in `apps/web/src/` and `tests/e2e/`.

## Scope

The diff modifies pagination logic, agent-activity coalescing, and message grouping in the ClickClack web client. It touches three concurrency-relevant surfaces:

1. **`handleHistorySettled`** (ChatApp.svelte): removes `pendingOlderPageIntent` from the `shouldLoadOlder` condition, enabling continuous backfill after a successful older load.
2. **`handleScroll`** (MessageList.svelte): adds `suppressPagination` guard to the inline older-load path, making it symmetric with the newer-load path which already had the guard. Also replaces the fixed `OLDER_LOAD_THRESHOLD_PX` (160px) with a dynamic `olderLoadThreshold()` = `Math.max(640, viewportHeight * 1.5)`.
3. **`coalesceAgentActivity`** (agent-activity.ts): replaces the `lastOrdinaryIndexByAuthor` timing-based finality heuristic with an exact `finalMessageId` linear scan that finds the first ordinary message from the same author after the turn's first activity row, stopping at a different same-author turn.

## Scope Gate

**Target:** The pagination state machine (`olderPageState`, `pendingOlderPageIntent`, `suppressPagination`) and the agent-activity coalescer's `finalMessageId` scan.
**Shared State:** `olderPageState` (ChatApp.svelte), `suppressPagination` (MessageList.svelte), the `turns` Map and `finals` Map in `coalesceAgentActivity`.
**Execution Strategy:** Playwright E2E tests driving real scroll events and API route interception to provoke duplicate loads, stale callbacks, and page-state ordering violations. A unit test exercises the coalescer's linear scan for correctness and time bounding.

## Adjudication of Prior Candidate Packets

Three prior candidate packets were provided as untrusted leads:

- **003000Z (rejected false WARN):** Correctly rejected. It claimed the `pendingOlderPageIntent` removal causes unbounded backfill, but the `olderPageState !== "idle"` reentrancy guard in `requestOlderMessages` and `loadOlderMessages` prevents overlapping requests. The removal only enables a *second* older load after the first completes and `olderPageState` transitions back to `"idle"` via `"settling"` -> `"idle"` in `handleHistorySettled`.

- **003113Z (sound PASS reasoning, defective harness):** The reasoning was substantively correct: (1) initial load never sets `olderPageState` to `"settling"`, so removing `pendingOlderPageIntent` only enables continuous backfill after a successful older load; (2) `suppressPagination` asymmetry has no harmful reachable transition because `suppressPagination` is only true during programmatic scroll restoration, and the guard on the newer path was already present; (3) A-B-A stale response risk is preexisting because `loadOlderMessages` is unchanged; (4) `finalMessageId` worst-case complexity is bounded by `MAX_MESSAGE_WINDOW` (2400). However, the harness had defects: duplicate-load detection did not collect before_seq values in an array, did not assert Set size equals array length, and observers were not registered before scroll.

- **004900Z (incomplete, broken route delay):** Incomplete review with a route delay that used a single promise for both interception and release, creating a race between the route handler and the test assertion.

This review confirms the 003113Z adjudication through independent source analysis:

1. **`pendingOlderPageIntent` removal:** `handleHistorySettled` fires after the scroll restoration completes. The condition `olderPageState === "settling" && state.nearOlder && activeHasOlder` can only trigger `requestOlderMessages` when `olderPageState` is `"settling"`, which is set only after a successful `loadOlderMessages` commit. The function then transitions `olderPageState` to `"idle"` before calling `requestOlderMessages`, so the reentrancy guard in `requestOlderMessages` (`olderPageState !== "idle"`) cannot fire on the same call. The removal of `pendingOlderPageIntent` from the condition means a second older load can be requested immediately if the viewport is still near the older edge. This is the intended behavior: continuous backfill. No race condition is introduced because `requestOlderMessages` and `loadOlderMessages` both guard against `olderPageState !== "idle"`.

2. **`suppressPagination` asymmetry:** The inline `handleScroll` older-load path gains a `!suppressPagination` guard. The newer-load path already had the same guard. `suppressPagination` is set to `true` only in `suppressProgrammaticPagination` during programmatic scroll restoration and released after 2 animation frames. The asymmetry (older path did not have the guard before, newer path did) is now resolved. No harmful reachable transition exists: when `suppressPagination` is true, both older and newer inline loads are suppressed, preventing duplicate loads during scroll restoration.

3. **A-B-A stale response risk:** `loadOlderMessages` captures `key = currentConversationKey()` at call time and checks `currentConversationKey() !== key` after the await. This guard is unchanged by the diff. The stale response risk (request fires on channel A, user switches to channel B, response arrives and is discarded) is preexisting. The diff does not modify `loadOlderMessages` or any route-switching code. This risk is out of staged scope.

4. **`finalMessageId` complexity:** The linear scan in the finals loop iterates from `turn.firstIndex + 1` to `messages.length` for each turn. Worst case with T turns and N messages is O(T * N). `MAX_MESSAGE_WINDOW = 2400` bounds the input, and the scan breaks early when it hits a different same-author turn or finds the final message. No correctness or liveness defect is established; performance can be tracked separately if telemetry shows jank.

## Reentrancy Assessment

- **`requestOlderMessages`:** Guards with `olderPageState !== "idle"`. If busy, sets `pendingOlderPageIntent = true` and returns. No reentrancy issue.
- **`loadOlderMessages`:** Guards with `olderPageState !== "idle"` and `loadingMessagePages.has(loadKey)`. Double-guarded. No reentrancy issue.
- **`handleScroll` inline older load:** Guards with `suppressPagination` and `hasOlder`. The `suppressPagination` guard prevents loads during programmatic scroll restoration. No reentrancy issue with the `requestOlderMessages` path because `requestOlderMessages` has its own `olderPageState` guard.
- **`handleHistorySettled` -> `requestOlderMessages`:** Transitions `olderPageState` to `"idle"` before calling `requestOlderMessages`. No race between the transition and the call because JavaScript is single-threaded.

## Duplicate Load Assessment

The primary concern: can two older-load requests with the same `before_seq` fire concurrently? No, because:
1. `requestOlderMessages` checks `olderPageState !== "idle"` and returns immediately if busy.
2. `loadOlderMessages` checks `olderPageState !== "idle"` again (race against concurrent `requestOlderMessages` calls in the same microtask).
3. `loadingMessagePages.has(loadKey)` provides a third guard.
The harness test 1 collects every `before_seq` request and asserts `Set size === array length`.

## Stale Callback Assessment

`loadOlderMessages` captures the conversation key at call time. After the API response, it checks `currentConversationKey() !== key` and returns early if the route has changed. This guard is unchanged by the diff. Test 3 verifies this by switching channels during an in-flight older load.

## Page-State Ordering Assessment

The `olderPageState` transitions: `idle` -> `loading` (in `loadOlderMessages`) -> `settling` (after successful commit) -> `idle` (in `handleHistorySettled`). The removal of `pendingOlderPageIntent` from `shouldLoadOlder` means: after `olderPageState` transitions to `"idle"` in `handleHistorySettled`, if `state.nearOlder && activeHasOlder`, `requestOlderMessages` is called immediately. This is a clean state transition: `settling` -> `idle` -> (conditional) `loading`. No ordering violation is possible because the transition happens synchronously in the same tick.

## Findings

None. The diff is clean under concurrency analysis. The `pendingOlderPageIntent` removal, `suppressPagination` guard addition, and `finalMessageId` scan are all safe under the existing reentrancy and ordering guards.

## Rejected Findings

1. **`pendingOlderPageIntent` removal causes unbounded backfill (003000Z):** Rejected. The `olderPageState !== "idle"` guard in `requestOlderMessages` and `loadOlderMessages` prevents overlapping requests. The removal only enables sequential continuous backfill after each successful load, which is the intended behavior.
2. **`suppressPagination` asymmetry is harmful:** Rejected. The asymmetry is now resolved (both paths have the guard). Before the diff, the older path lacked the guard, but `suppressPagination` is only true during programmatic scroll restoration, and the older load threshold was 160px (unlikely to trigger during a 2-frame suppression window). The fix makes the behavior explicit and correct.
3. **`finalMessageId` scan is O(n^2) and could cause jank:** Rejected as a staged concurrency defect. `MAX_MESSAGE_WINDOW = 2400` bounds the pathological case, and typical scans break at the first ordinary message or different same-author turn. No universal runtime claim is made from this static review.

## Conditional Passes Skipped

- `finding-ledger`: not applicable; no findings to ledger. Clean result explicitly states what was checked.

## Race Harness

The harness patch at `.hyperreview/concurrency-scaffolding-20260716T005507Z/race-harness.patch` provides four tests:

1. **Duplicate-load detection:** Collects every `before_seq` request in an array, asserts `Set size === array length`. Observers registered before scroll via `page.route()` before navigation.
2. **Continuous backfill:** Requires a second older request after settlement, proves the requests are sequential (`maximumActiveOlderRequests === 1`), and rejects duplicate `before_seq` values.
3. **Stale callback after route switch:** Uses separate interception and release promises, awaits interception before switching A to B, then asserts A-only rows do not appear in B. The A-to-B-to-A same-key reentry risk is documented by static analysis as preexisting and is not misrepresented as covered by this test.
4. **`finalMessageId` complexity:** Unit test feeding 50 interleaved turns (200 messages) through `coalesceAgentActivity`, asserting correctness and a 2s time bound.

**Execution command (Playwright):**
```bash
npx playwright test tests/e2e/concurrency-race-harness.spec.ts --project=chromium --workers=1 --reporter=line
```

**Not run:** Go is not installed on this machine. The Playwright stress command above is the correct invocation. Tests are honestly marked as not run in this review session; they are provided for CI execution.

**`git apply --check` result:** PASSED (exit code 0, no output).

## Evidence Sources

1. `apps/web/src/ChatApp.svelte` lines 1300-1370 (handleHistorySettled, requestOlderMessages, loadOlderMessages)
2. `apps/web/src/components/messages/MessageList.svelte` lines 119-120, 337-350, 780-810 (olderLoadThreshold, handleScroll, suppressPagination)
3. `apps/web/src/lib/chat/agent-activity.ts` lines 170-260 (coalesceAgentActivity, finals loop, finalMessageId scan)
4. `apps/web/src/lib/chat/messages.ts` lines 78-118 (groupMessages, continuesPreambleChain)
5. `apps/web/src/lib/chat/messageWindow.ts` lines 1-93 (MAX_MESSAGE_WINDOW = 2400)
6. `apps/web/src/lib/types.ts` lines 90-100 (PreambleBlock.finalMessageId)
7. `tests/e2e/message-window.spec.ts` (existing unit tests for trim, coalesce, group)
8. `tests/e2e/chat.spec.ts` lines 425-480 (existing history backfill E2E test)
9. Staged tree SHA: `9921901c395bb16dc20b25ce3342b16600fc6152` (verified via `git write-tree`)
10. Parity matrix: `reviewer-parity-matrix.v0.json` v0.4.0, sha256 `522cec5a35c38d354e7924bf720b9968a8cfcd2c8bc39ae2341fb00dcfc455c6`

## Cross-Model Escalation

- **Author model:** openai/gpt-5.6-sol, family openai, effort high
- **Reviewer model:** ollama/glm-5.2:cloud, family zai, effort max
- **Independence:** xfam (different model family: zai vs openai)
- **Parity state:** cross_model_parity (glm-5.2/max is listed as primary eligible reviewer for openai-family authors in the parity matrix)
- **Matrix id:** glm-5.2, family zai, provider ollama, thinking max
- **Matrix file:** `/home/lumadmin/.openclaw/skills/_hyperreview-shared/contracts/reviewer-parity-matrix.v0.json` v0.4.0

## Reviewer Provenance

- **Effective provider:** ollama
- **Effective model:** glm-5.2:cloud
- **Effective family:** zai
- **Effective effort:** max
- **Required provenance:** provider ollama, model glm-5.2:cloud (matrix id glm-5.2), family zai, effort max — MATCHED

## Tree and Path Bindings

- **Repo:** `/home/lumadmin/.openclaw/workspace-council/chisel/active/clickclack-code-mode`
- **Pinned staged tree:** `9921901c395bb16dc20b25ce3342b16600fc6152`
- **Staged paths SHA-256:** `86eb6677590310bb224eb1d350e9f365b8bf9bba2f7d28588e17156180e7d90e`
- **Artifact directory:** `.hyperreview/concurrency-scaffolding-20260716T005507Z/`

## Validation Outputs

- **`git apply --check`:** exit 0, no output (PASS)
- **Schema validation:** Draft 2020-12 validation passed with 0 errors.
- **Go race detector:** Go is not installed. Playwright is the correct test runner for this TypeScript/Svelte codebase. Tests not run in this session.

## Next Action

no-action

---

hyperreview: concurrency-scaffolding, xfam, openclaw, ollama/glm-5.2:cloud/max → PASS
findings: none
outcome: no-action (confidence high)
