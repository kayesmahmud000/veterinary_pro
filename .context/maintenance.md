# Maintaining the context

Documentation/context work uses [Senior Technical Writer/Architect](roles/documentation.md) and [QA/Code Reviewer](roles/quality.md) perspectives. Apply [evidence labels](engineering/evidence.md) and the [self-review cycle](workflows/self-review.md), using structural and source/claim checks for prose changes. Roles define responsibilities, not a requirement for extra agents.

## Update triggers and ownership

The person/agent changing behavior owns the corresponding context update in the same task. Reviewers verify claims against source. Use `.context` for current cross-cutting knowledge, `docs/tasks/<slug>/` or `docs/features/<slug>/` for acceptance criteria and execution evidence, and the owning `apps/api/ROADMAP.md` or `apps/web/ROADMAP.md` for actual progress changes. Root `ROADMAP.md` coordinates the workstreams; [docs/README.md](../docs/README.md) defines authority and dependency handoffs. Do not mark an unrelated roadmap feature complete during maintenance.

| Changed surface | Update |
| --- | --- |
| Modules, layers, providers | Architecture, feature map, known gaps |
| Schema/indices/transaction behavior | Database rules, source manifest, affected feature and task docs |
| HTTP/shared/Dart contracts | API/sync context and task spec; update actual contracts separately |
| Commands/CI/runtime/config | Testing and runtime documents |
| Security or readiness discrepancy fixed | Known-gap row with test/evidence link; do not erase history silently |
| Important design trade-off | New/superseding decision record |
| Agent workflow or role triggers | Canonical instructions, role dispatcher/profiles, affected workflow/template links and adapters only as necessary |

## Evidence standard

Use repository-relative source paths, important symbols and a checked date/revision for snapshots. Avoid copying source code or environment values into docs. Label inference/proposal separately from observed implementation. Link executable contracts and task evidence rather than maintaining a second exhaustive endpoint/schema list.

A task plan checkbox means that step was performed and verified, not that a related method/file exists. A baseline build, historical test count or sign-off cannot establish future readiness. Keep unmet requirements visible with concrete next checks.

Source anchors are maintained in [sources.json](sources.json); the executable check is [scripts/validate.py](scripts/validate.py). The initial review record is [validation.md](validation.md).

## Validation

From repository root run `python3 .context/scripts/validate.py` and `git diff --check`. The validator checks relative Markdown file links, anchors, source-path manifest entries and reachable context documents; it requires only Python's standard library. It does not verify clinical correctness, implementation claims, remote links or production state.

Review the changed documentation against manifests, module bindings, schema/SQL and tests. Check for duplicate rules, contradictory authority, stale paths, fabricated installed libraries, copied reference terminology and any secret values. Inspect Git status to ensure the change stayed within scope.

When moving context files, update the index, all inbound links and adapters. Preserve meaningful historical specs/ADRs. Do not change workflow safety or scope policy through an incidental formatting edit.
