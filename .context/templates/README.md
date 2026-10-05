# Documentation templates

Copy the relevant template content into a task-specific document; do not edit the templates to describe an individual feature.

- [Spec](spec.md): `docs/tasks/<slug>/spec.md` or `docs/features/<slug>/spec.md`.
- [Plan](plan.md): sibling `plan.md`; scale detail to the task and record actual results.
- [ADR](adr.md): `.context/decisions/NNNN-short-title.md` for a consequential technical choice.

Replace bracketed fields. Link current implementation and acceptance tests. Avoid boilerplate sections that say nothing about the task; a small fix can use short paragraphs while retaining the relevant risk/verification information. Documentation-only maintenance does not require a fabricated application feature specification.
