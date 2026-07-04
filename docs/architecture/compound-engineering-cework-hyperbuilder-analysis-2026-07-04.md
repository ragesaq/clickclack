# CE-Work vs HyperBuilder — Analysis

_Archived 2026-07-04. Author: Chisel (Product). Source: group-chat analysis._

## Summary

`ce-work` is a strong execution skill, but it solves a narrower problem than HyperBuilder. It is a disciplined maintainer workflow for turning a plan into a shipped diff. HyperBuilder is a governed multi-agent delivery system with independent planning, generation, evaluation, verification, integration, regen policy, and run-state control.

## Where ce-work is strong

1. **Plan as a decision artifact, not a script.** The plan owns scope, units, verification, boundaries, and references. Execution still reads code and makes implementation choices locally. That is the right split.
2. **Explicit per-unit idempotency check.** Before implementing, it asks whether the unit already exists and satisfies the verification criteria. This is the biggest thing to steal. It directly helps resumed branches, compaction, repeated runs, and half-finished agent work.
3. **Preserves unit IDs through execution.** U-IDs carry from plan to task list to blocker notes to final verification. HyperBuilder has package and sprint IDs, but we should make that lineage show up more consistently in commits, run artifacts, closeout notes, and PR bodies.
4. **Good test discovery discipline.** Before behavior changes, it looks for existing tests, picks an evidence strategy, and prefers proof-first or characterization-first when practical. That is stronger than "add tests sometime before closeout."
5. **Concrete parallelism rules.** It maps units to files, checks hidden contention like schemas, lockfiles, migrations, generated clients, ports, DBs, and browser sessions, then caps parallel batches. HyperBuilder has stronger stage separation, but CE has very practical worker-batch hygiene.
6. **Return-to-caller mode is a good orchestration seam.** `ce-work` can implement and locally verify, then return changed files, unit evidence, blockers, and verification results while another owner handles review, PR, and shipping. That maps cleanly to HyperBuilder's orchestrator-owned tail.
7. **Residual work is treated as a gate.** Unresolved findings must be fixed, filed, accepted with a durable sink, or block. That matches where HyperReview and HyperBuilder closeout should land.

## Where HyperBuilder is stronger

1. **Role separation is much stronger.** HyperBuilder separates orchestrator, planner, generator, build evaluator, security evaluator, finding verifier, cross-validator, design evaluator, and integrator. Only generator writes. `ce-work` is more single-agent controlled, even with subagents.
2. **Evaluation independence is stronger.** HyperBuilder has model-family separation and explicit evaluator lanes. CE has review, but not the same independent model-family contract or bounded adversarial lanes.
3. **Stop states are better defined.** HyperBuilder has named run states, hard stops, circuit breakers, escalation triggers, and terminal outcome semantics. CE has disciplined workflow, but less machinery for "the run must stop here."
4. **Better for high-risk product work.** Auth, security, multi-repo schema contracts, UI quality gates, and rollout plans need HyperBuilder's heavier gates. CE is faster because it has fewer formal boundaries.
5. **Cross-run failure learning.** Failure-mode capture and promotion into regression criteria are already part of HyperBuilder's model. CE's compounding loop is easier to read, but HyperBuilder's failure taxonomy is more enforceable.

## What we should apply

1. **Add a `pre-unit idempotency gate` to HyperBuilder.** Before generator work on a package or sprint, check whether the acceptance contract is already satisfied by current repo state. If yes, record evidence and skip generation. This must be artifact-backed, not just model judgment.
2. **Require per-unit verification evidence in generator returns.** For every behavior-bearing unit: existing tests inspected, tests added or changed, red failure or characterization baseline when applicable, command results, and any no-test exception.
3. **Strengthen stable lineage IDs.** Carry package/sprint IDs into task subjects, commits, evaluator artifacts, Build Records, and PR summaries. No anonymous "fix parser" commits inside governed runs.
4. **Adopt CE-style parallel safety checks for package dispatch.** Even if HyperBuilder stays mostly sequential for now, the safety checklist should exist: files, hidden contention, generated artifacts, migrations, lockfiles, ports, DBs, browser sessions, and expected merge cost.
5. **Add a lightweight direct-work lane outside full HyperBuilder.** Small fixes should use normal agent execution plus HyperReview reflex. Medium/high-risk work enters HyperBuilder. Ambiguous product work goes through HyperIdea/HyperDesign first.
6. **Make residual handling a hard closeout rule.** Every unresolved finding must be `fixed`, `filed`, `accepted-with-rationale`, or `blocking`. No "known issue" prose without a durable pointer.

## What not to copy

- Do not collapse HyperBuilder into one execution skill. We would lose independent judgment.
- Do not make plan progress live inside the plan doc. HyperBuilder is right to derive state from run artifacts, commits, and Build Records.
- Do not let faster parallelism bypass ownership boundaries. Generator-only write authority still matters.
- Do not use CE as the default for high-risk suite work. It is a sharp maintainer lane, not the whole governance system.

## Bottom line

CE has better execution ergonomics. HyperBuilder has better governance, independence, and failure containment. The right move is to graft CE's execution hygiene onto HyperBuilder: idempotent resume, stable unit lineage, per-unit evidence, practical parallel safety checks, return-to-caller envelopes, and a hard residual gate.

## Sources

- CE `ce-work` skill: https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/skills/ce-work.md (skill: `skills/ce-work/SKILL.md`)
- HyperBuilder `README.md`, `docs/PIPELINE_ROLES.md`, `docs/ORCHESTRATOR_LOOP.md`, `docs/BUILD_PLAN_CONTRACT.md`.
