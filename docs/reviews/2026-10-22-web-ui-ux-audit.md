# Web UI/UX audit — 2026-10-22

**Result:** prioritize preventing lost edits, making financial amounts readable, and correcting recovery/error guidance before broad visual redesign. The current green/cream visual language is coherent; information hierarchy and interaction recovery need more attention than decoration.

This is a review, not an implementation plan or release approval. Application code was not changed. Findings remain open; the proposed corrections below are recommendations, not newly approved feature contracts.

## Scope and evidence

- Baseline: repository HEAD `a07d77f` plus the existing local ADM-9 changes. Those changes were preserved.
- Inspected public home, learning, courses and help pages; login; administrative dashboard, users, reports, audit, media, settings and content editing.
- Used the existing production web build from the credential-free source snapshot at `/tmp/vet-adm9-0bjcZp/source/apps/web`, with Chrome and a controlled synthetic upstream. The rendered application and navigation were real; API data and identities were fixtures. This does not establish production API/provider behavior.
- Captured 35 page/state screenshots: public pages at 375/1440px, login at 375px, six administrative pages in Bangla and English at 320/1440px, invalid report dates, and 720px CSS viewport reflow. Additional probes covered the 320px mobile drawer, unsaved settings/content navigation, search request counts, currency text and actual Bangla font selection.
- The main capture contains 38 measurement records, including nonvisual interaction records; this is not a claim of 38 independent page screenshots. Raw temporary evidence: `/tmp/vet-uiux-audit-E6h6yT/{measurements.json,additional.json,browser.log,extra-browser.log}`. Selected screenshots are preserved alongside this report.
- **Observed behavior** below means this controlled browser run. **Confirmed from code** means inspected implementation, not a production reproduction. Proposed user impact is an assessment, not a measured usability-study result.
- Not covered: a complete learner/farmer/veterinarian journey, screen-reader testing, real phones, Safari/Firefox, native browser zoom, throttled real mobile networks, production content scale or a full WCAG audit. No usability score or performance benchmark is assigned.

## Priorities

P1 means address first because work can be lost, amounts misunderstood or users blocked. P2 means address next to improve completion speed, clarity and accessibility. These are audit priorities, not claims of security severity.

| ID | Priority | Finding | Evidence basis |
| --- | --- | --- | --- |
| UX-01 | P1 | Unsaved settings and content disappear during navigation | Observed behavior + code |
| UX-02 | P1 | Report money uses raw minor units as the primary display | Observed behavior + code |
| UX-03 | P1 | Login has no self-service forgotten-password recovery | Observed login + code; backend dependency |
| UX-04 | P2 | Learning copy describes available course discovery/library as future plans | Observed pages + code |
| UX-05 | P2 | Invalid report dates produce generic, partly unrelated errors | Observed behavior + code |
| UX-06 | P2 | Dashboard hides actionable information below shortcut sections | Observed layout + code |
| UX-07 | P2 | Long navigation buries account controls and is hard to scan | Observed layout + code |
| UX-08 | P2 | Reports combine long explanations, results and advanced export controls | Observed layout + code |
| UX-09 | P2 | Media product search sends a request for every keystroke | Observed request count + code |
| UX-10 | P2 | Form boundaries have weak contrast against white cards | Computed colors + contrast calculation |

## Findings and scoped corrections

### UX-01 — Prevent silent loss of unsaved edits

**Observed behavior:** changed the English organization name on `/admin/settings`, clicked Dashboard in the sidebar, then returned. The original value replaced the unsaved draft and no discard confirmation appeared. The same navigation sequence lost an edited English body on `/admin/content/:id` without warning. No save request was made in either scenario.

**Impact:** an ordinary navigation action can discard substantial bilingual editing work. Reload, locale switching and other exits need separate coverage when this is fixed; they were not all reproduced here.

**Confirmed from code:** [settings state](../../apps/web/src/components/workspace/admin-platform.tsx) uses local fields; [content editing](../../apps/web/src/components/workspace/admin-communications.tsx), around line 678, computes `dirty` for save/publish controls but does not register a navigation guard. [Course curriculum](../../apps/web/src/components/workspace/admin-course-curriculum.tsx), around lines 62–139, already provides a useful guard pattern.

**Correction:** share the existing navigation guard across these editors; offer clear Stay/Discard actions, retain drafts after failed saves, and clear dirty state only after confirmed saves. Any draft persistence needs an explicit sensitive-data policy; passwords and private support content must not be casually persisted in browser storage.

**Acceptance:** edit, attempt sidebar/back/locale/reload exits, cancel the exit, and verify the draft remains; save successfully and verify normal navigation no longer warns.

### UX-02 — Display currency in units people read

**Observed behavior:** estimated MRR with `totalMinor = "1234567"` renders as `১২,৩৪,৫৬৭ USD`, followed by the explicit label “integer minor units.” A person must convert it to USD 12,345.67 themselves. Order totals use the same raw-minor-unit presentation.

**Limit:** the label is present. This finding does not establish incorrect arithmetic, stored amounts, currency conversion or a billing defect.

**Confirmed from code:** [report rendering](../../apps/web/src/components/workspace/admin-platform.tsx), around lines 591 and 645, formats `totalMinor` as an integer; [report messages](../../apps/web/src/lib/i18n/admin-platform.ts) label that representation explicitly.

**Correction:** use currency-aware major-unit formatting for the primary amount, with exact string/BigInt handling for large values. Keep per-currency grouping, exact raw values in exports, and the distinction between estimated MRR, current status, creation cohorts and actual revenue. Formatting must not imply provider settlement or cash receipts.

**Acceptance:** verify BDT/USD examples, zero and very large totals in both languages without precision loss; preserve export contracts and report meanings.

### UX-03 — Provide a real account recovery route

**Observed/code evidence:** login offers email, password, password visibility and registration switching, but no forgotten-password link. The inspected web auth flow and API auth routes do not provide a complete reset journey. See [auth dialog](../../apps/web/src/components/auth/auth-dialog.tsx), around lines 475–519, and [auth module](../../apps/api/src/modules/auth).

**Impact:** someone who forgets a password has no self-service route back into their account.

**Correction:** scope a complete reset flow with the backend contract, expiring single-use token, delivery provider and session policy. A decorative link alone does not resolve this. A verified support route can provide interim guidance if the product actually supports that process.

**Acceptance:** cover request feedback without account enumeration, delivery, expired/used tokens, successful password replacement and the chosen session invalidation policy. This requires separately planned API/provider work.

### UX-04 — Reconcile learning copy with shipped capability

**Observed/code evidence:** `/learning` describes courses and a searchable learning library as longer-term plans, while the menu links to a rendered course catalogue. Free YouTube course discovery, enrollment and the learner library have implementation/evidence; paid purchases and other planned services must remain clearly distinguished. See [English learning messages](../../apps/web/src/lib/i18n/en.ts), around lines 374–390, [Bangla messages](../../apps/web/src/lib/i18n/bn.ts), [course components](../../apps/web/src/components/courses) and [course delivery evidence](../features/youtube-courses/plan.md).

**Impact:** visitors cannot confidently tell what they can use today or which next action is appropriate.

**Correction:** state the available free-course journey plainly, give course discovery/enrollment a clear CTA, and keep paid delivery, marketplace and consultation booking descriptions aligned with their actual status. Review both locales and metadata together. The existing My Courses entry should be retained.

**Evidence:** [mobile learning page](assets/2026-10-22-web-ui-ux/learning-375.png).

### UX-05 — Make validation specific and connected to the field

**Observed behavior:** on `/admin/reports`, submitted start `2026-10-20` and end `2026-10-01`. The alert mentions dates, field limits, **password and reason**, although this action only applies report dates. Neither date input receives `aria-invalid` or an error association via `aria-describedby`.

**Confirmed from code:** [date form](../../apps/web/src/components/workspace/admin-platform.tsx), around lines 769–795, reduces failed parsing to `VALIDATION_FAILED`. [Field/validation helpers](../../apps/web/src/components/workspace/workspace-ui.tsx) provide reusable pieces, but this form does not map issues to individual fields.

**Correction:** explain the actual start/end error beside the relevant date control, connect it programmatically, and focus the first invalid field or an appropriately linked error summary. Preserve the existing report until a valid filter is applied and make the applied range clear.

**Reference:** W3C [Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html). This is a focused finding, not an accessibility certification.

**Evidence:** [invalid-date state](assets/2026-10-22-web-ui-ux/report-date-error-1440.png).

### UX-06 — Put dashboard work before module shortcuts

**Observed layout:** on the Bangla Super Admin dashboard at 320×900, subscription overview starts about **1,741px** down and recent pending applications at **2,746px**. On 1440×900 they start at approximately **1,076px** and **1,431px**. Several shortcut/intro sections precede them. These values describe fixture content, not every possible account.

**Confirmed from code:** [dashboard](../../apps/web/src/components/workspace/admin-dashboard.tsx), around lines 68–163, renders shortcut sections before overview and pending applications.

**Correction:** prioritize a compact overview and review queue, then frequent actions, with less frequent module introductions lower down. Choose metrics/actions already supported for the role; do not invent clinical or financial signals. Make primary actions visually clearer than secondary navigation links.

**Acceptance:** at narrow and wide widths, a reviewer can identify pending work and enter its queue without traversing several introductory panels.

**Evidence:** [320px dashboard](assets/2026-10-22-web-ui-ux/dashboard-320.png).

### UX-07 — Make long navigation easier to scan and keep the account footer reachable

**Observed layout:** the Super Admin sidebar has 29 navigation links. At 1440×900, the Bangla account block begins approximately **1,861px** down its scrollable content. A 320×700 mobile drawer has a **1,942px** scroll height and its account block begins at **1,825px**. Most module entries share the same shield icon.

**Confirmed from code:** [workspace shell](../../apps/web/src/components/workspace/workspace-shell.tsx), around line 52, scrolls the whole sidebar; [navigation](../../apps/web/src/components/workspace/workspace-navigation.tsx) defaults many administrative links to the same icon.

**Correction:** preserve the requested bottom-sidebar account/profile/logout placement, pin that footer within the shell/drawer, and scroll the navigation region independently. Refine domain grouping/collapsible sections and meaningful icons. Keep the desktop language control in the header as requested. Test keyboard reachability and long translated labels after changes.

**Evidence:** [mobile drawer](assets/2026-10-22-web-ui-ux/navigation-320.png). This is a discoverability/scrolling problem; navigation was not found to be inaccessible by authorization.

### UX-08 — Separate everyday reporting from advanced controls

**Observed layout:** the Bangla report page is approximately **6,300px** tall at 320px width. Current platform totals begin at **1,703px**, report export at **4,719px**, and audit filters at **5,166px**. It is about **4,106px** tall at 1440px. Source and labels expose UTC instants, actor/entity UUIDs, exact action names and a manual audit UUID cursor.

**Confirmed from code:** [report view/filters](../../apps/web/src/components/workspace/admin-platform.tsx), including metadata around lines 603–619, and [platform messages](../../apps/web/src/lib/i18n/admin-platform.ts).

**Correction:** bring key results closer to compact filters; use sections or tabs for report results versus audit exports; offer useful date presets. Keep concise visible warnings, with detailed methodology available on demand. Put UUID/cursor controls in an advanced area; add record/name lookup only where contracts and privacy rules support it. A friendlier inclusive end-date UI must still translate correctly to the API's exclusive end boundary.

**Constraint:** JSON export is the current intentional contract. CSV/Excel is a future enhancement, not a demonstrated defect, and would require equivalent redaction, limits and confirmations. Do not simplify away truthful estimate, cohort, timezone or provider limitations.

### UX-09 — Reduce request churn during media search

**Observed behavior:** typing `c`, `co`, `cou`, `cour`, `cours`, `course` at roughly 90ms intervals caused **six** product-search requests. This is a request-count observation, not a real mobile-network latency benchmark.

**Confirmed from code:** [media search](../../apps/web/src/components/workspace/admin-media.tsx), around lines 116–125, directly interpolates each input change into `useRemote`; [remote hook](../../apps/web/src/components/workspace/workspace-ui.tsx), around lines 10–38, suppresses stale results but does not cancel the superseded request.

**Correction:** debounce search by approximately 250–350ms or submit explicitly, support cancellation of superseded reads, and retain existing results with a clear updating state where appropriate. Preserve server limits and error/retry feedback.

**Acceptance:** rapid typing issues only the intended final search; stale responses cannot replace current results; clear/reset and request failures remain understandable.

### UX-10 — Strengthen input boundary contrast

**Observed/computed evidence:** workspace controls use `#9aa99c` borders on white, approximately **2.46:1** contrast. Login controls use `#a4b4a7` on white, approximately **2.17:1**. Empty white controls on white cards rely substantially on their border to communicate their shape. See [workspace styles](../../apps/web/src/components/workspace/workspace.styles.ts) and [auth styles](../../apps/web/src/components/auth/auth.styles.ts).

**Correction:** darken meaningful control boundaries to reach at least 3:1 against their adjacent background, retaining visible focus/error states and the existing palette. Check actual computed states rather than changing every decorative border indiscriminately.

**Reference/limit:** W3C [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) applies to information needed to identify controls; decorative and inactive elements have exceptions. This finding does not mean all site text or borders fail contrast.

## Preserve what already works

- No horizontal document overflow was observed in the captured states, including the 720px CSS viewport reflow check. This does not replace browser zoom or long-content testing.
- Skip links, visible focus treatments, labelled controls, loading/error feedback and retry patterns already exist. Form controls are generally 46–50px tall in the inspected states.
- The public design has a consistent green/cream palette and clear page headings. Hero pause/reduced-motion support already exists; it should not be removed in a redesign.
- Bangla actually rendered with installed Noto Sans Bengali in this browser. No broken Bangla font was established. Self-hosting/subsetting a font is an optional consistency/performance decision that needs separate measurement.
- Role restrictions, sensitive-action confirmations, export redaction/limits and truthful provider/status wording must survive UX simplification.

## Recommended delivery order and verification

1. Address lost edits, readable money and field-specific date errors. These can be scoped against existing contracts; currency formatting still needs exactness tests.
2. Improve dashboard hierarchy, independently scrolling navigation with a bottom account footer, and reporting section structure. Recheck Bangla/English, 320/375/1440px, keyboard focus and representative long/empty/error content.
3. Reconcile public availability copy, reduce media-search churn and strengthen control contrast. Check both locales and actual rendered states.
4. Plan account recovery as complete API/web/provider work. Do not mark it delivered after adding only a link.

For any implementation, use the repository's existing specification/plan workflow and Tailwind utility policy. Validate the changed states with both UI reproduction and the relevant functional checks; the prior passing ADM acceptance checks do not establish usability or production accessibility.

**Audit validation:** reviewed measurements against screenshots and source, checked referenced local paths and document whitespace, and preserved pre-existing local modifications. No application tests were rerun because this change records an investigation rather than changing runtime behavior. Browser evidence is controlled/synthetic; production and assistive-technology verification remain open.

Suggested documentation commit: `docs: record web UI and UX audit findings`. No Git staging or commit was performed.

## Remediation evidence added after this audit

The observations above remain historical. The [web-owned UXR roadmap](../../apps/web/ROADMAP.md#uiux-remediation-roadmap) tracks remaining delivery.

| Finding | Correction and evidence | Boundary |
| --- | --- | --- |
| UX-01 | UXR-1 shared settings/content exit protection, guarded recovery reloads and preserved curriculum behavior; [commands, results and review](../features/admin-settings-reports/plan.md#uxr-1-verification-record). | Locally accepted 2026-10-22; production Chrome with controlled identities/upstreams, actual native reload/close dialogs. No deployment, alternate-browser or full accessibility certification. |
| UX-02 | UXR-2 exact major-unit USD/BDT MRR/order/month display, localized digits and truthful raw-unit fallback; [commands, results and review](../features/admin-settings-reports/plan.md#uxr-2-verification-record). | Locally accepted 2026-10-22; unchanged raw JSON and report meanings. Controlled production Chrome, no deployed/alternate-browser acceptance. |
| UX-05 | UXR-3 translated field-specific date errors, associations/focus, retained applied reports and unapplied notice; [commands, results and review](../features/admin-settings-reports/plan.md#uxr-3-verification-record). | Locally accepted 2026-10-22; controlled production Chrome, both locales/roles at 320/1440px. No screen-reader, alternate-engine or deployed certification. |
| UX-03 | UXR-4 [shared recovery contract](../features/account-recovery/spec.md) and [implementation plan/design review](../features/account-recovery/plan.md) prepared. | **Finding remains open.** No recovery routes, credentials, worker, web flow or configured delivery implemented by this preparation stage. |
