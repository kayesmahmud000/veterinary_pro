# Context creation and validation record

Date: 2026-10-05. Application baseline: Git revision `4b1597a`.

## Scope and method

Reviewed reference instruction entry points, permission settings, five agent roles, skill organization/dependencies/reference materials, lockfile provenance and dated design/implementation documentation. Adapted the methodology to the target after inspecting manifests, architecture/product documents, roadmap/task specs, registered modules, representative domain/repository/guard/provider/test code, both server entry points, schemas/migration layout, web/mobile source, CI and infrastructure.

The output is current context, reusable workflows, templates and decision records. Added root AGENTS.md for discovery and prepended current-context pointers to GEMINI.md/.antigravityrules while retaining their historical text. No application code, dependency, schema, migration, CI or deployment configuration was changed. No credentials were copied.

## Recorded results

- `python3 .context/scripts/validate.py`: passed; 34 Markdown documents, 84 local links and 68 curated source entries; all context documents reachable from the index.
- `git diff --check`: passed.
- Literal repository-path review: the only missing referenced API path is the deliberately documented absent e2e configuration.
- Scope review: tracked edits are only the eight-line context pointers in GEMINI.md and .antigravityrules; new files are AGENTS.md and `.context/`.
- Context files use UTF-8/LF with final newlines. No application files were modified.

## Verification scope

Follow-up on 2026-10-05: added an existing-document index in README.md and direct product-source links in project.md, connecting the original roadmap, architecture, blueprints, task/feature docs, guides and agent rules. The validator passed with 34 Markdown documents, 102 local links and 68 source entries; `git diff --check` passed. Original source documents and application code were unchanged by this follow-up.

Run `python3 .context/scripts/validate.py` and `git diff --check` from the repository root. Structural checks cover internal file links/anchors, context reachability and curated source paths/symbols. Manual review checks source-grounded claims, policy consistency, intent versus implementation, and absence of reference-specific application rules.

Application builds/tests, database migrations, provider calls, load testing and deployment are outside this documentation-only change and were not run. Known gaps are source-review observations and explicitly not a production audit or certification. No claim is made that every backend method has been dynamically exercised.

See [maintenance](maintenance.md) for future update/verification responsibilities.

## Senior role workflow update — 2026-10-05

Scope: implement the user's senior multidisciplinary role standard throughout `.context`, preserving existing application facts, original document links, permission boundaries and human-managed Git policy. Plan: inspect current instructions/workflows; define automatic role selection and focused profiles; integrate self-review/evidence rules into domain guidance and templates; review requirements coverage; validate structure and change scope; re-review final wording.

Implemented a role dispatcher with ten grouped specialist profiles, a mandatory self-review procedure, six evidence categories and a UI workflow. Updated entry instructions, architecture/engineering/operations guidance, existing workflows, templates and the generic adapter prompt. Decision 0004 records the adopted workflow and explicitly supersedes the optional-role clause in decision 0001.

### Requirement and review coverage

| Requested behavior | Reviewed implementation |
| --- | --- |
| Senior identity, judgment, production awareness and no overengineering | agent-instructions.md and roles.md define the 4–5+ years standard, actual-code priority and minimal safe change |
| Dynamic selection, switching and role combinations | roles.md maps every requested discipline to profiles and includes frontend/API, user management, production UI, migration and offline examples |
| Backend, frontend/web/UI, UX and dedicated interface review | Focused backend-api, frontend-ui and ui-ux profiles link to actual Nest, Next.js and Flutter context |
| QA, code review, debugging, security, performance, database and incident/release work | Profiles define risk-based checks, concrete evidence and cross-feature review; existing workflows route to them |
| Tech Lead, Architect, refactoring and documentation | Profiles require impact/recovery analysis, justified architectural alternatives and maintainability/source accuracy |
| Mandatory review cycle and evidence-based conclusions | self-review.md specifies Implement → Review → Test → Re-review → Finalize; evidence.md defines all six requested labels |
| Integration and portability | Entry points reach role selection through shared instructions; topic rules, workflows and templates link to the same canonical policies; no plugin or extra agents required |

Manual scenario walkthroughs checked that a frontend feature with a new API selects client, API/backend, UX, lead and QA/reviewer perspectives; a production UI defect adds debugger/incident and UI review; a migration adds database/backend, QA, lead and release. Documentation-only work selects writer/architect and reviewer/QA with structural/source checks. Review-only scope remains intact. These are instruction-routing reviews, not evidence that future agents will always comply.

### Verification and re-review

- `python3 .context/scripts/validate.py`: passed with 48 Markdown documents, 252 local links and 68 source entries; every context document is reachable.
- `git diff --check`: passed; explicit trailing-whitespace/LF/final-newline checks also covered the untracked context documents.
- SHA-256 comparison against the task-start snapshot: all changes in this request are `.context` Markdown only; application/configuration files, existing root adapters, validator and source manifest are unchanged.
- Re-review reconciled historical optional-role wording through the explicit decision amendment, checked both lifecycle descriptions against the canonical self-review sequence, and preserved lightweight work, review-only scope and truthful evidence limits.

No application tests/builds, external services or deployments were needed or run for this documentation change. Structural validation does not establish runtime behavior, future agent compliance or production certification.
