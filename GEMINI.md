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

### AUTONOMOUS ATOMIC TASK EXECUTION PROTOCOL (NO MIDWAY PERMISSION REQUIRED)
1. When performing a task, generate and save both `spec.md` and `plan.md` to disk under `docs/tasks/<task-name>/` or `docs/features/<feature-name>/`.
2. Do NOT ask for user permission or pause midway while performing the task. NEVER seek user permission to create or update any files. Execute the task end-to-end autonomously:
   - Spec & Plan authoring
   - Shared types, DTOs & Contracts
   - Repositories & Entities
   - Domain Service & Business Logic
   - Controllers & API Wiring
   - Unit & Integration Tests verification
3. Run verification commands and test suites (`pnpm test`, build checks).
4. Check off `[x]` items in `plan.md` and update `ROADMAP.md` upon completion.

---

### STRICT HUMAN-IN-THE-LOOP GATE BETWEEN TASKS (ONE ATOMIC TASK AT A TIME)
1. NEVER bundle multiple roadmap tasks or an entire sprint into a single turn.
2. Complete ONE atomic task at a time.
3. STRICT GATE: Once the task is 100% complete and verified, notify the user with a summary of the completed task, test results, and suggested commit message.
4. STOP AND WAIT for the user to tell the agent to move on to the next task before starting it.

---

### STRICT GIT GUARDRAIL
- The agent MUST NEVER execute `git add`, `git commit`, `git merge`, or `git push`.
- All Git commit operations must be performed manually by the human developer.
- When a task is complete, only suggest a conventional commit message.
