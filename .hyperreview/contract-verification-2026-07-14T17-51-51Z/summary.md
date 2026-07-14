# HyperReview — Contract Verification Summary

**Mode:** contract-verification (blocking-capable)
**Verdict:** PASS
**Target:** Staged diff — pinned staged tree `50bf082920da2007328de9099104df0a94e4fb4e`, staged-paths SHA-256 `ada69e2ecfaec51652ce302049ae4c181a2769dc74d15734d88f8922cb1968c3`, baseline HEAD `213f43ef9aee35b490a26f5051c5e39972978a01`.
**Scope:** Channel JSON/OpenAPI/SQLite/Postgres persistence contract for new `pull_request_url` and `pull_request_title`.

## Scope Gate

- **Target Contract:** Go `store.Channel` JSON struct; OpenAPI `Channel` (response), `UpdateChannelRequest`, `CreateChannelRequest`; SQLite + Postgres `channels` table schema and migrations; sqlc `UpdateChannel`/`GetChannel`/`ListChannels`/`GetChannelByIDAndWorkspace`/`GetChannelByRouteIDAndWorkspace` queries and generated `storedb`; store adapter row mapping; `httpapi.updateChannel` handler; TS SDK `Channel` type.
- **Consumer Assumption:** Legacy clients omit both `pull_request_url` and `pull_request_title` on create and update; clients may send an empty `pull_request_url` to clear the context.
- **Verification Strategy:** Serialize legacy v1 payloads (create/update without the new fields) and confirm the new parser accepts them without failure or data loss; confirm empty URL clears both fields; confirm the DB schema is additive (`NOT NULL DEFAULT ''`); confirm the response always emits the new fields so the tightened `required` declaration is satisfied.

The change alters an externally consumed interface, so the target is VALID for contract verification.

## Tier

Full tier (durable output). Triggers:
1. Operator explicitly required full-tier durable output via parent reflex escalation.
2. Conditional pass `finding-ledger` activated (findings exist).

Reviewable churn: 42 files staged (733 insertions / 319 deletions); excluding 12 built webassets files (90/90) and 1 generated SDK type file (8 insertions) leaves ~29 reviewable files (635 insertions / 229 deletions). The contract-scope hand-authored surface is smaller; frontend (`apps/web`) and e2e test are out of persistence-contract scope.

## Changed Surface

Two new string fields added across the channel persistence contract:
- `store.Channel` gains `PullRequestURL` / `PullRequestTitle` (non-omitempty JSON tags → always serialized).
- `UpdateChannelInput` gains pointer fields (`*string`) so omitted = unchanged; `httpapi.updateChannel` binds them as pointers.
- OpenAPI `UpdateChannelRequest` adds optional `pull_request_url` / `pull_request_title` (title `maxLength: 160`); `CreateChannelRequest` intentionally omits them.
- OpenAPI `Channel` response adds both as **required** properties.
- SQLite + Postgres `channels` table: `pull_request_url TEXT NOT NULL DEFAULT ''`, `pull_request_title TEXT NOT NULL DEFAULT ''` (additive migrations 0028/0021).
- sqlc queries select the two new columns (column order + scan order match the generated Row structs/`UpdateChannelParams`).
- Store adapters map the new columns into `store.Channel` for `GetChannel` and `ListChannels`.
- TS SDK `Channel` type and `updateChannel` signature gain the fields (response required, request optional).

## Contract Correctness (backward compatibility)

- **Legacy create** (omits both fields): DB columns default `''`; request accepted; no data loss. ✅
- **Legacy update** (omits both fields): pointer inputs are `nil`, so `pullRequestURL`/`pullRequestTitle` default to the existing `ch` values; `template` stays `code` when `input.Template` is empty; `NormalizePullRequestContext` is idempotent on already-normalized stored values; PR context preserved. ✅
- **Empty URL clears:** `{"pull_request_url":""}` → `NormalizePullRequestContext("","")` returns `("","")`; the title-clear heuristic also resets the title when the URL changes. ✅
- **Non-code template clears:** switching to `chat` clears the PR context. ✅
- **Response required fields:** server always emits both fields (non-omitempty), so the new `required` declaration is satisfied for every response. ✅
- **No dropped fields, no type changes, no removals.** The schema is purely additive. ✅

`go build` of all touched packages exits 0; `go test -count=1 -run 'NormalizePullRequest|ChannelPresentation'` passes for `store` and `store/sqlite`.

## Findings (advisory; none block)

- **F-1 (low):** Non-canonical `pull_request_url` re-send silently resets a custom title to the default. The title-clear heuristic (`sqlite/mutations.go:243`, `postgres/mutations.go:249`) compares the raw pre-normalization input URL to the canonical stored value, so re-sending the same PR with a trailing slash / case / whitespace variation (and no title) clears the title. URL data is not lost; only the derived title regenerates. *Remedy:* compare the normalized URL to the stored URL before clearing. *Route:* backlog-residual-risk.
- **F-2 (low):** OpenAPI under-specifies `pull_request_url` (unconstrained `string`), but the server rejects any non-`https://github.com/{owner}/{repo}/pull/{n}` URL with `ErrInvalidChannelPresentation` (HTTP 400). Schema-conformant clients can be surprised. *Remedy:* add a pattern/description capturing the server constraint. *Route:* backlog-residual-risk.
- **F-3 (info):** Response `Channel` schema tightened with two new required fields; TS SDK consumers that construct/mock `Channel` objects get a compile-time required-field change. Runtime is consistent (server always emits them). *Route:* no-action; document in changelog.

## Rejected Findings

- **RF-1:** Hypothesis that a legacy update on a code channel would drop PR context because `NormalizePullRequestContext` is always called — **rejected**; traced and tested: the preserve path keeps `ch` values when inputs are `nil` and `template` stays `code`.

## Escalation (cross-family, additive)

- **Decision:** escalate
- **Author:** `openai/gpt-5.6-sol`, family `openai`, effort `high`.
- **Reviewer:** `ollama/glm-5.2:cloud`, family `zai`, effort `max` (effective provider `cloud`; matrix-asserted provider `ollama` → provider mismatch).
- **Independence:** cross-model (different family: zai reviewing openai).
- **Assurance state:** `no_eligible_parity_reviewer` — the matrix lists `glm-5.2/max` for `gpt-5.6-sol` only at `xhigh`; the author effort is `high` (no parity-cleared row), and the reachable endpoint `glm-5.2:cloud` fails the matrix `requireEffectiveProviderMatch` against the asserted `ollama` route, so the primary route fails closed. A different family is reachable, so the state is `no_eligible_parity_reviewer` (not `single_model`).
- **Parity matrix:** `/home/lumadmin/.openclaw/skills/_hyperreview-shared/contracts/reviewer-parity-matrix.v0.json`, version `0.4.0`, sha256 `522cec5a35c38d354e7924bf720b9968a8cfcd2c8bc39ae2341fb00dcfc455c6`.
- **Bound to:** pinned staged tree `50bf082920da2007328de9099104df0a94e4fb4e`; staged-paths SHA-256 `ada69e2ecfaec51652ce302049ae4c181a2769dc74d15734d88f8922cb1968c3`; baseline HEAD `213f43ef9aee35b490a26f5051c5e39972978a01`.
- **Disposition:** advisory-but-independent cross-family pass; route to operator sign-off because no parity-cleared reviewer is available for `openai/gpt-5.6-sol/high`.

## Operator-visible status

- **Why this action:** The contract is backward-compatible (PASS), but the cross-family review is not parity-cleared (`no_eligible_parity_reviewer`), so it cannot auto-close as a certifying gate; it holds for operator sign-off.
- **Capability used/missing:** Cross-family route used (zai/glm-5.2:cloud); parity-cleared reviewer missing for `openai/gpt-5.6-sol/high`.
- **Operator next step:** Sign off the degraded-assurance cross-family review, or re-run with a parity-cleared reviewer if one becomes reachable.
- **Commit/merge/release blocked?** No — verdict is PASS and `blocksStage: false`; the escalation is advisory (operator-review), not a hard block.

**cleanResult:** false (advisory findings recorded).
