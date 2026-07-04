# CE-Ideate vs HyperIdea / HyperDesign — Analysis

_Archived 2026-07-04. Author: Chisel (Product). Source: group-chat analysis._

## Summary

CE-Ideate should sit before HyperIdea as a discovery pass. It is not a replacement for HyperIdea or HyperDesign.

The clean chain is:

`HyperDream / loose prompt -> CE-Ideate-style Discovery Pass -> HyperIdea -> HyperDesign -> HyperBuilder`

## What CE-Ideate does well

- It answers "which directions are worth exploring?" before committing to one direction.
- It grounds first: codebase, past learnings, external prior art, optional Slack and issue tracker.
- It decomposes the topic into 3-5 axes, then sends divergent agents across six frames.
- It requires a basis tag for every survivor: `direct`, `external`, or `reasoned`.
- It runs adversarial filtering and preserves rejection reasons.
- It outputs a small survivor set, usually 5-7 candidates, instead of pretending every idea deserves full planning.

## HyperIdea (heavier, authoritative)

HyperIdea takes a chosen direction and decides whether it deserves product-system commitment: Idea Packet, council proposal, Vanguard research, Compass integration, Forge/Clarity/Vanguard reviews, Sentinel threat modeling, Anvil teardown, and Final Approval with binding conditions.

## HyperDesign (the contract factory)

HyperDesign consumes accepted upstream judgment, runs Assembly, preserves fidelity through source artifacts, hashes, condition manifests, and validation gates, then produces design/build artifacts like Project Contract Baseline, PRD, Roadmap, and Build Shaping Brief.

## Where CE is ahead of us

1. We move promising fragments into governance too early. CE has a cheap divergent front door.
2. CE separates topic axes from thinking frames. That prevents all agents from clustering around the obvious interpretation.
3. CE's basis tags are simple and strong. Every survivor says why it exists.
4. CE keeps the rejection ledger. That stops weak ideas from coming back later as if they were new.
5. CE uses fresh-context critique only on survivors and cited evidence, which is the right cost shape.

## Where we are stronger

1. HyperIdea has authority and governance. CE can rank ideas; it does not bind Compass/Sentinel/Anvil decisions.
2. HyperDesign has much stronger fidelity controls. The Assembly Packet and validation gate are better than a saved ideation artifact for carrying conditions forward.
3. Our stage transitions are contracts, not vibes. Approved conditions move into build constraints through named artifacts.
4. Security and policy review are first-class, not just a critique frame.

## What I'd apply

- Add `HyperIdea Discovery Pass` before the formal Idea Packet.
- Require `candidate_basis`: `direct`, `external`, or `reasoned` for every survivor.
- Add `axis_coverage` as a dispatch invariant, with one bounded recovery pass if an axis has zero candidates.
- Add `rejection_ledger` to HyperIdea intake, so HyperDesign can see what was cut and why.
- Run a fresh-context verifier only on survivor claims, citations, and external prior art.
- Carry `concept_source`, `authority_state`, and `freshness_state` forward so inspiration never becomes hidden authority.

## What not to copy

- Do not make HTML the canonical artifact. Fine for viewing, wrong for authority.
- Do not let next-step menus replace governance gates.
- Do not put broad divergent ideation inside HyperDesign by default. HyperDesign should challenge accepted ideas, not restart greenfield discovery unless the intake is weak.
- Do not copy CE's universal-domain looseness into our product authority model.

## Product call

Build our version as a fast `HyperIdea Discovery Pass`. It should produce: topic, grounding sources, axes, raw candidates, survivors, rejection ledger, basis tags, verifier notes, and recommended survivor. Only the winning survivor enters formal HyperIdea governance.

## Sources

- CE-Ideate skill: https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/skills/ce-ideate.md
- Local refs checked: `hyperidea-internal/docs/HYPERIDEA_PIPELINE.md`, `hyperdesign-internal/docs/PROCESS.md`, `hyperdesign-internal/docs/ARTIFACT_SET.md`, `hyperdesign-internal/docs/ASSEMBLY_VALIDATION_GATE.md`, `hyperfactory/docs/SPINE.md`.
