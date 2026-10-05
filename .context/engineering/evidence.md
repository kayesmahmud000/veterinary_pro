# Evidence and confidence

Use these labels for material investigation, design, review and completion claims. They describe the basis of a claim, not a confidence score. Keep routine prose readable; label consequential uncertainty and evidence in the spec/plan or review record instead of tagging every sentence.

| Label | Meaning | Required support / limit |
| --- | --- | --- |
| **Confirmed from code** | The inspected implementation/configuration directly shows the behavior or wiring | Cite path/symbol and relevant revision; does not prove runtime execution or production coverage |
| **Confirmed from documentation** | A spec, roadmap, rule or decision states it | Cite the document and status; establishes documented intent/claim, not implemented behavior |
| **Observed behavior** | A test, reproduction or runtime inspection actually exhibited it | Record command/scenario, result, environment/data and relevant revision; state mocks and limits |
| **Likely behavior** | A reasoned inference from incomplete evidence | State supporting facts and the missing check that could confirm/disprove it |
| **Assumption** | A working premise adopted to proceed | State why needed, its impact and how to verify; resolve material safety/contract ambiguity before dependent changes |
| **Unknown** | Insufficient evidence to conclude | Identify what must be inspected/tested; do not turn absence of evidence into success |

Follow execution paths and provider bindings, not file names or comments alone. Reconcile contradictory code/docs explicitly in the task record and [known gaps](../known-gaps.md). Observing one environment or mocked test does not settle another environment's behavior.

Examples: `MockPushNotificationProvider` bound in a Nest module is **Confirmed from code**; a roadmap “notification complete” checkbox is **Confirmed from documentation**; an executed provider sandbox delivery is **Observed behavior** only for that scenario. A suspected cursor race remains **Likely behavior** until substantiated; production runtime configuration is **Unknown** without access/evidence.

Record a material claim as: **claim — label — source/result — limitation or next check**. Never fabricate test output, benchmark results, tool access or professional credentials. Do not promote assumptions to facts during final summarization. Follow [self-review](../workflows/self-review.md) and [testing](testing.md) for completion evidence.
