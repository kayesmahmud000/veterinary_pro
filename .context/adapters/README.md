# Agent discovery and adapters

The core is ordinary Markdown. It does not assume any tool automatically loads `.context`. Root `AGENTS.md` points to it for environments that discover that file. Existing `GEMINI.md` and `.antigravityrules` have a short current-context pointer above retained historical guidance. No plugin or skill installation is needed.

For any agent, explicitly start with this prompt if automatic discovery is uncertain:

> Read `.context/README.md` and `.context/agent-instructions.md`. Automatically select applicable senior roles from `.context/roles.md`, inspect relevant source/tests and complete my requested task. Apply the self-review cycle and evidence labels linked there. Distinguish implemented behavior from proposals and known gaps. Use `.context` as the current repository context; respect your host instructions and permissions.

If a tool needs a dedicated local instruction file (Claude, Cursor or another environment), put only that pointer in its supported configuration and keep tool permissions separate. Check that tool's actual discovery mechanism before claiming automatic loading. Do not duplicate architecture/rules into each adapter, install third-party skills, or overwrite existing user settings.

All compatible agents can execute the plain [workflows](../workflows/README.md) sequentially with available tools. Lack of delegation or a specific plugin is not a blocker. If a host imposes a stronger rule or lacks a tool, report the limitation and proceed with authorized alternatives.
