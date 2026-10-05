# Mandatory self-review cycle

**Trigger:** every meaningful implementation, including context/instruction changes. Small edits use a brief version with relevant checks. For review-only work, enter at Review and report findings; do not implement fixes without authorization. This is an agent work discipline, not a new human approval gate or a guarantee of external independent review.

**Sequence: Implement → Review → Test → Re-review → Finalize.** Domain workflows supply project checks; this document governs the transition between implementation and critical assessment. Reproductions/tests may also run earlier during investigation or development.

## 1. Implement

Use the appropriate [senior implementer roles](../roles.md) after understanding, investigating and planning. Make the smallest complete change that preserves architecture and meets acceptance criteria. Keep a map of affected callers, data and failure boundaries; avoid unrelated cleanup or speculative generalization.

## 2. Review

Switch to **Senior Code Reviewer + Senior QA/Test Engineer**. Inspect the final diff and relevant surrounding code as if another engineer submitted it. Try to falsify the intended behavior; do not rely on the original implementation explanation. Add **Senior UI Reviewer** for UI and **Senior Tech Lead** for cross-module/high-impact changes, plus Security/Database/Performance where triggered.

| Review area | Question and evidence to inspect |
| --- | --- |
| Correctness | Does this solve the requested problem and its acceptance criteria? Trace actual execution, not names/comments |
| Architecture | Does it respect current module, contract, state and persistence boundaries? Is any exception justified? |
| Regression | Which callers, features, jobs, clients or data depend on the changed behavior? What protects them? |
| UX | Are user states, accessibility, feedback and error/offline recovery correct? Inspect rendered behavior when relevant |
| Security | Can another user/farm or malformed/replayed input cross a boundary? Are data, tokens and logs protected? |
| Performance | Does it add unbounded work, requests, queries, rebuilds or resource cost? Measure sensitive paths |
| Error handling | What happens on API/DB/provider failure, timeout, partial success, restart or retry? |
| Edge cases | What happens with null/empty/invalid data, duplicate/rapid/concurrent actions, denied permissions and large inputs? |
| Maintainability | Will another developer understand this six months later? Challenge naming, duplication and unnecessary abstraction |
| Production safety | Can existing data/clients survive rollout, migration and recovery? Is the evidence sufficient for the claimed scope? |

Identify specific defects and their impact. Fix in-scope findings during authorized implementation. Record unrelated existing problems without expanding scope. An unresolved material issue must remain visible; do not approve readiness by merely acknowledging it.

## 3. Test

Run checks matched to the changed boundaries and review findings, using [testing guidance](../engineering/testing.md). Include relevant negative, edge and dependent-feature cases. Tests must prove behavior, not mirror code or exist only to inflate coverage. For docs, validate structure and source/claim accuracy; do not run unrelated application suites.

Record actual results and environment, separating mocks/static checks from runtime observations. If required verification cannot run, report that limitation and the concrete check still needed. Do not call blocked checks passed.

## 4. Re-review

Review the final state after fixes/tests: did the correction introduce another problem, leave a stale contract/doc, or invalidate earlier evidence? Re-run affected checks only when new changes, failures or unresolved concerns justify it. Repeat Review → Test → Re-review until in-scope material findings are resolved or explicitly reported as unresolved. Do not enter an endless cosmetic review loop.

## 5. Finalize

Check scope, acceptance criteria and the final diff. Update affected docs/plan and report what changed, evidence actually obtained, unresolved risks/limits and the existing project's suggested commit message. Separate task completion from production release approval. Never claim deployment, comprehensive certification or independent review merely because self-review passed.

Keep one concise review/evidence summary in the existing task plan or validation record. Use [evidence labels](../engineering/evidence.md); no transcript of internal deliberation or role-by-role ceremonial reports is required.
