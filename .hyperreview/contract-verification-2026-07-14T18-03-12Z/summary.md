# HyperReview — Contract Verification (Re-review)

**Mode:** contract-verification (blocking-capable)
**Re-review:** yes — one regen cycle
**Prior artifact (finding ledger + baseline review evidence):** `.hyperreview/contract-verification-2026-07-14T17-51-51Z/{result.json,summary.md}` (verdict PASS, 2 low + 1 info advisory findings)
**Reviewer:** `ollama/glm-5.2:cloud` (family `zai`, effective provider `cloud`)
**Author:** `openai/gpt-5.6-sol/high` (family `openai`) — cross-model
**Assurance:** `no_eligible_parity_reviewer` (unchanged from prior; same parity matrix/version/hash)
**Pinned staged tree:** `dd1b7deb93257bc6c88627117ff98d76be6bc401`
**Staged-paths SHA-256:** `ada69e2ecfaec51652ce302049ae4c181a2769dc74d15734d88f8922cb1968c3`
**Baseline HEAD:** `213f43ef9aee35b490a26f5051c5e39972978a01`
**Verdict:** **PASS**

## Scope

Re-review of the channel `pull_request_url` / `pull_request_title` persistence
contract after one regen cycle, focused on confirming the two prior low findings
are resolved and that the fix delta introduces no new backward-compatibility break.
Contract surface: Go `store.Channel` JSON + `UpdateChannelInput`, `httpapi`
`updateChannel` request binding, OpenAPI `Channel`/`UpdateChannelRequest`/
`CreateChannelRequest`, SQLite+Postgres channels schema+migrations, sqlc channel
queries + generated storedb, store adapter mapping, `UpdateChannel`
normalize/preserve/clear logic, `NormalizePullRequestContext`, and the TS SDK
`Channel` type.

## Fix delta inspected

- **F-1 (resolved):** The title-clear heuristic in
  `apps/api/internal/store/sqlite/mutations.go` and the Postgres mirror now
  compares the **normalized** `pullRequestURL` to `ch.PullRequestURL`:
  `NormalizePullRequestContext(pullRequestURL, "")` runs *before*
  `if input.PullRequestTitle == nil && pullRequestURL != ch.PullRequestURL`.
  The prior artifact compared the raw pre-normalization input to the canonical
  stored value; now the canonical URL is compared, so an equivalent non-canonical
  re-send (trailing slash / whitespace) no longer clears a custom title.
- **SQLite trailing-slash regression test:** `channel_presentation_test.go` (sqlite)
  now sets a code-channel PR URL + custom title, re-sends `pullRequestURL + "/"`
  with no title, and asserts `updated.PullRequestURL == pullRequestURL &&
  updated.PullRequestTitle == pullRequestTitle` — the exact prior edge, now
  protected. A store-level `TestNormalizePullRequestContext` accept/reject test
  was also added.
- **F-2 (resolved):** `packages/protocol/openapi.yaml`
  `UpdateChannelRequest.pull_request_url` now declares
  `format: uri-reference`, `pattern: '^$|^https://github\.com/[^/]+/[^/]+/pull/[1-9][0-9]*$'`,
  and a description to clear the context — closing the schema-vs-server 400
  surprise for canonical lowercase URLs.

## Contract Correctness (backward compatibility, re-verified)

- **Legacy create** (omits both fields): DB columns default `''`; accepted; no data
  loss. ✅
- **Legacy update** (omits both fields): pointer inputs `nil`; PR context
  preserved; `NormalizePullRequestContext` idempotent on stored values. ✅
- **Empty URL clears:** `{"pull_request_url":""}` → `("","")`. ✅
- **Non-code template clears:** switching to `chat` clears PR context. ✅
- **Equivalent non-canonical re-send (F-1 fix):** trailing-slash URL normalizes to
  the stored canonical URL; custom title preserved. ✅
- **Response required fields:** server always emits both (non-omitempty); the
  required declaration is satisfied. ✅
- **No dropped fields, no type changes, no removals.** The fix delta is purely
  additive plus the title-clear comparison fix. ✅

## Findings (re-review ledger: WARN → PASS)

- **F-1 (low → resolved):** Title-clear now compares the canonical URL; proven by
  the SQLite trailing-slash regression test. *Route:* no-action.
- **F-2 (low → resolved):** OpenAPI now declares `uri-reference` + canonical
  GitHub PR pattern. *Residual (info, safe direction):* the pattern is marginally
  stricter than the server (rejects uppercase host `GITHUB.COM`, which
  `strings.EqualFold` accepts, and leading-zero numbers `pull/01`, which
  `strconv.Atoi` accepts as `1`); this does **not** reintroduce the F-2 surprise
  (schema accepting what the server rejects). *Route:* no-action.
- **F-3 (info, unchanged):** Response `Channel` schema tightened with two new
  required fields; additive TS SDK compile-time change. *Route:* no-action;
  document in changelog.
- **RF-1 (rejected, re-confirmed):** Legacy-update PR-drop hypothesis disproven by
  trace + passing test; not reintroduced by the F-1 fix.

## Test Evidence (fresh)

- `go build ./apps/api/internal/store/... ./apps/api/internal/store/postgres/
  ./apps/api/internal/store/sqlite/ ./apps/api/internal/httpapi/` → exit 0
  (go1.26.5).
- `go build -buildvcs=false ./apps/api/...` → exit 0 (typecheck).
  `go vet -buildvcs=false <touched packages>` → exit 0. (`-buildvcs=false`
  works around a read-only `.git` VCS-stamping error in this sandbox; not a
  code defect.)
- `go test -count=1 -run 'NormalizePullRequest|ChannelPresentation'
  ./apps/api/internal/store/ ./apps/api/internal/store/sqlite/` →
  `ok store 0.002s`, `ok sqlite 0.074s`.
- **httpapi:** `go test ./apps/api/internal/httpapi/` is blocked in this sandbox —
  every `httptest.NewServer` panics with
  `listen tcp6 [::1]:0: socket: operation not permitted` (sandbox network
  namespace). Environment restriction, not a code regression; the
  operator-asserted fresh httpapi pass (Testbox) is recorded. The
  contract-relevant `updateChannel` binding is verified by build+vet+source
  read.
- **Postgres:** build+vet exit 0; the postgres title-clear heuristic mirrors the
  sqlite fix. No live Postgres in this sandbox, so the postgres path is verified
  by build + mirrored logic, not an integration test (same limitation as the
  prior artifact).
- **code-channel Playwright** (`tests/e2e/code-channel-mode.spec.ts`):
  operator-asserted pass; not executed in this sandbox.

## Escalation (cross-family, additive; unchanged assurance)

- **Decision:** escalate (assurance-limited, not finding-limited).
- **Author:** `openai/gpt-5.6-sol/high` (family `openai`).
- **Reviewer:** `ollama/glm-5.2:cloud` (family `zai`, effort `max`; effective
  provider `cloud`; matrix-asserted provider `ollama` → provider mismatch).
- **Independence:** cross-model (different family).
- **Assurance state:** `no_eligible_parity_reviewer` — unchanged from the prior
  artifact. No parity-cleared row for `openai/gpt-5.6-sol/high`; the reachable
  `glm-5.2:cloud` endpoint fails `requireEffectiveProviderMatch` against the
  asserted `ollama` route. A different family is reachable, so the state is
  `no_eligible_parity_reviewer` (not `single_model`).
- **Parity matrix:** `/home/lumadmin/.openclaw/skills/_hyperreview-shared/contracts/reviewer-parity-matrix.v0.json`,
  version `0.4.0`, sha256 `522cec5a35c38d354e7924bf720b9968a8cfcd2c8bc39ae2341fb00dcfc455c6`
  (same parity matrix/version/hash as the prior artifact).
- **Bound to:** pinned staged tree `dd1b7deb93257bc6c88627117ff98d76be6bc401`;
  staged-paths SHA-256 `ada69e2ecfaec51652ce302049ae4c181a2769dc74d15734d88f8922cb1968c3`;
  baseline HEAD `213f43ef9aee35b490a26f5051c5e39972978a01`.
- **Disposition:** advisory-but-independent cross-family pass; both low findings
  resolved (WARN→PASS); route to operator sign-off because no parity-cleared
  reviewer is available for `openai/gpt-5.6-sol/high`.

## Operator-visible status

- **Why this action:** The contract is backward-compatible and both prior low
  findings are resolved in the regen cycle, but the cross-family review is not
  parity-cleared (`no_eligible_parity_reviewer`), so it cannot auto-close as a
  certifying gate; it holds for operator sign-off.
- **Capability used/missing:** Cross-family route used (zai/glm-5.2:cloud);
  parity-cleared reviewer missing for `openai/gpt-5.6-sol/high`.
- **Operator next step:** Sign off the degraded-assurance cross-family re-review,
  or re-run with a parity-cleared reviewer if one becomes reachable.
- **Commit/merge/release blocked?** No — verdict is PASS and `blocksStage: false`;
  the escalation is advisory (operator-review), not a hard block.

**cleanResult:** has-findings (1 info, F-3, no-action; both prior low findings
resolved). No new low or higher findings introduced by the fix delta.
