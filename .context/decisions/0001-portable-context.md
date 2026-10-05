# 0001: Portable central context

- Date: 2026-10-05
- Status: Adopted for this context system
- Scope: Documentation and agent entry points only
- Amendment: [0004](0004-senior-role-workflow.md) supersedes the optional-role clause below with mandatory applicable role perspectives and self-review; this record retains the original design rationale.

## Context

The user requested the reference project's discovery-first instruction methodology across multiple AI agents. The target already has agent rules, extensive task specs and architectural blueprints, but several claimed capabilities diverge from source. Copying reference instructions would introduce the wrong framework, branding and access policy.

## Decision

Use `.context/README.md` as a small routing index, common instructions plus topic rules, source-backed architecture/feature maps, explicit known gaps, optional role responsibilities, portable workflow documents, templates and decision records. Keep specs/plans in existing `docs/` directories. Use root `AGENTS.md` as a thin entry point; give other tools a generic bootstrap prompt in adapters. No host-specific permission grants or imported skills are required.

## Alternatives and consequences

One large instruction file is easier to start but costly to read and prone to repetition. Separate copied instructions per agent drift independently. A central modular directory provides one maintained body of knowledge, but tools that do not discover AGENTS.md need an explicit prompt or a small local adapter. A documentation validator checks links and source anchors, not semantic correctness. Source review remains mandatory.

Existing `GEMINI.md` and `.antigravityrules` receive a short pointer declaring the current `.context` precedence for repository-policy conflicts; their historical content remains intact. Retained safeguards include human-managed Git and spec/plan before code changes. The active user request and host instructions still take precedence.

## Revisit when

A target tool demonstrably needs another entry file, context navigation becomes slow, or repeated duplication appears. Add only a pointer/route where possible, not a second policy body.
