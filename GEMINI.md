# AGENT AUTO-BOOTSTRAP & SPEC-DRIVEN EXECUTION INSTRUCTIONS (READ ON EVERY SESSION)

At the beginning of ANY interaction, conversation, or task:
1. Automatically read and enforce all guidelines in `.antigravityrules`.
2. Inspect `ARCHITECTURE.md` to maintain system design, database schemas, and coding patterns.
3. Review `ROADMAP.md` to identify the current milestone and the next uncompleted `[ ]` task.
4. Always state: "Checked project state. Current pending task is: [Task Name]. Ready to proceed." before taking any action.
5. NEVER ask the user what to do next if the roadmap already specifies the next pending task.

---

### MANDATORY PROTOCOL: SPEC-DRIVEN DEVELOPMENT (NO CODE WITHOUT DOCS)

Before writing or modifying ANY code for a new Phase, Feature, Bugfix, or Architectural Change (big or small), you MUST strictly follow this 2-stage documentation protocol.

#### Rule 1: Dedicated Documentation Directory
Create a folder under `docs/` named after the task/feature:
`docs/features/<feature-name>/` or `docs/tasks/<task-name>/`

Inside this folder, you MUST generate two comprehensive documents:

#### 1. `spec.md` (Specification Document)
This document must clearly detail:
- **Feature Overview & Objective:** What problem are we solving?
- **Current State vs. Proposed State:** What already exists in the codebase, and what is missing or needs refactoring?
- **Architectural & Design Trade-offs:** Compare options (e.g., Option A vs. Option B), clearly explain which approach is better, and state technical justification (scalability, performance, security, maintainability).
- **Data Models & Contracts:** Exact database schema changes, DTOs, interfaces, and API request/response contracts.
- **Security & Edge Cases:** Validation rules, potential breaking changes, and error boundary handling.

#### 2. `plan.md` (Step-by-Step Execution Plan)
This document must outline:
- **Prerequisites:** Dependencies, environment variables, or DB migrations needed.
- **Implementation Steps:** Granular, atomic checklist (`[ ]`) mapping out:
  - Step 1: Migration / Schema update
  - Step 2: Repository & Data Access Layer
  - Step 3: Domain Service & Business Logic
  - Step 4: Controller / API Endpoints / UI Wiring
  - Step 5: Unit & Integration Tests
- **Verification & Acceptance Criteria:** Exact curl commands, test cases, or UI behaviors to verify completion.

---

### EXECUTION GATE & HUMAN-IN-THE-LOOP RULE
1. Generate and save both `spec.md` and `plan.md` to the disk.
2. Present a concise summary of the proposed changes, trade-offs, and why this design is superior.
3. **STOP AND PAUSE.** Do NOT write actual application code until the user explicitly reviews and approves the spec and plan with: "Approved" or "Proceed".
4. Once approved, execute the steps strictly following `plan.md`, ticking off `[x]` items as you finish, and update `ROADMAP.md` upon final completion.
