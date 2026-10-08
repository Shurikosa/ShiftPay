# ShiftPay Mobile UX

This document defines the practical UX plan for the ShiftPay mobile MVP.

It defines role flows, screen behavior, and real data states. The canonical
visual and component contract is `docs/UI_DESIGN_SYSTEM.md`, while
`docs/DesignExample.png` is the approved visual-language and composition
reference for the complete mobile MVP. It remains non-normative for APIs,
routes, data, and business behavior. `docs/TASKS.md` remains the ordered
backlog. Together, these documents give the mobile agent enough detail to
redesign every current screen without inventing product behavior.

## 1. Mobile UX Goal

The mobile app should help workers and foremen complete shift workflows quickly
on a phone.

The app should prioritize:

- clear login and registration
- company onboarding for foremen and workers
- fast shift joining for workers
- clear managed-shift visibility for foremen
- clear cancellation status
- readable shift status, salary, and premium pay information
- clear payroll request status for closed unpaid work
- simple forms with obvious success and error states

The MVP should feel like a practical workforce tool, not a marketing site.
Its product UI should nevertheless be visually deliberate and recognizably
reference-driven on every screen, not only on Login or dashboards.

## 2. Target Users

### Worker

Workers use the app to join a shift, see their attendance status, and review
worked time and salary after a shift closes.

Worker tasks:

- register and log in
- join a company by company join code
- join a shift with a join code
- see current and past joined shifts
- see company name in the dashboard or main menu
- see shift status, attendance status, worked minutes, and calculated salary
- see own read-only pay breakdown after close
- pause and resume themselves during an active joined shift
- see closed unpaid attendance records
- select unpaid work days and create a payout request
- track own pending and approved payout requests

### Foreman

Foremen use the app to create and manage shifts, approve worker attendance, and
review worker and private foreman salary summary after closing a shift.

Foreman tasks:

- register and log in
- create a company if they do not have one
- create a shift
- manage company pay rules
- manage company name, worker/foreman default rates, and currency label
- see shifts they created and manage
- see company name in the dashboard or main menu
- share the join code with workers
- approve joined workers
- start, cancel, and close shifts
- pause themselves or pause everyone during an active shift
- see closed-shift summary
- review worker premium pay breakdowns for managed shifts
- review worker payout requests for their company and managed shifts
- approve pending payout requests

Admin users are not a mobile MVP target. Admin user management is deferred to
the Vaadin admin dashboard.

## 3. Design Principles

- Use a mobile-first layout.
- Use large touch targets and readable text.
- Use a light cool canvas, dark slate typography, teal/emerald accents, rounded
  elevated or bordered surfaces, subtle depth, and clear separation between
  layers.
- Establish an explicit hierarchy for screen title, section title, card title,
  primary value, metadata, and supporting text.
- Use layered cards, consistent section headers, action tiles for real
  dashboard destinations, compact icon-supported metadata, semantic status
  chips, and distinct primary/secondary/tertiary actions.
- Keep forms simple and predictable, but group related fields and settings in
  explained surfaces rather than one long undifferentiated stack.
- Make shift status visible wherever a shift appears.
- Show loading, empty, error, and success states for network workflows.
- Use whitespace intentionally without creating large accidental empty zones.
- Use one consistent semantic icon system. Do not use Unicode emoji as
  production icons; decorative icons are accessibility-hidden, and icon-only
  actions have accessible labels and minimum touch targets. Icons never replace
  essential visible text or authorize an absent action.
- Use a separately approved construction hero only on Login under its asset contract;
  the shared branded auth/onboarding shell may use restrained visual branding
  without inventing marketing or product behavior.
- A screen migration is rejected if it only changes colors, fonts, spacing, or
  radii while retaining the old composition and hierarchy without a documented
  screen-specific reason.
- Do not put business logic in UI components.
- Render returned monetary amounts with the applicable backend currencyLabel as plain text, for example `20.00 EUR` or `20.00 грн`. Do not assume ISO codes, apply exchange rates, or replace historical labels with the current company label.
- Format numeric text and date language with the device locale. Use the returned
  Company/PayPolicy timezone for company-domain date/time display where it is
  available; use the authenticated current-company timezone for records in that
  company. If a view has no applicable timezone, fall back to device timezone
  for display only and never use that fallback to infer pay boundaries.
- Missing values use field-specific pending/unavailable copy, never numeric
  zero. A backend-returned zero remains zero.
- Screens should use the typed API client rather than calling `fetch` directly.
- Support responsive wrapping, narrow viewports, keyboard-safe reachability,
  and system font scale 1.5 without clipping critical content.

## 4. Navigation Model

### Unauthenticated Flow

- `LoginScreen`
- `RegisterScreen`

The app opens in this flow when no valid session is available.

On app start:

1. Load the stored token through the session storage abstraction.
2. If a token exists, call `GET /api/v1/users/me`.
3. If the token is valid, route by user role.
4. If the token is missing or invalid, clear the session and show login.

JWT/session expiration stays enabled. For the MVP, the backend default
session lifetime should be 8 hours. The app should restore valid sessions
automatically through `GET /api/v1/users/me`.

Future biometric unlock or refresh-token/long-lived session support can be
added later.

### Worker Flow

- without a company, the role gate renders route/screen `JoinCompany`
- worker stack route `WorkerDashboard`
- worker stack route `JoinShift`
- worker stack route `MyShiftHistory`
- worker stack route `WorkerPayroll`
- worker stack route `WorkerShiftDetails`

Worker navigation is centered on joining a shift and reading personal attendance
history from `GET /api/v1/me/shifts`. A worker who does not belong to a company
should be routed to company join before shift join.

Worker payroll navigation is centered on backend-owned payroll data from
`GET /api/v1/me/payable-attendances`,
`POST /api/v1/me/payout-requests/preview`, and
`GET /api/v1/me/payout-requests`.

### Foreman Flow

- without a company, the role gate renders route/screen `CreateCompany`
- foreman stack route `ForemanDashboard`
- foreman stack route `CreateShift`
- foreman stack route `ForemanShiftDetails`
- foreman stack route `ShiftSummary`
- foreman stack route `ForemanPayrollRequests`
- foreman stack route `ForemanCompanySettings`, with `ForemanPayRules` nested
  from Company Settings

The foreman shift details screen keeps attendance in its current section. A
dedicated attendance destination does not exist and must not be added during
this presentation redesign.

Foreman navigation is centered on managed shifts from
`GET /api/v1/me/managed-shifts`. A foreman who does not have a company should
be routed to company creation before shift creation or shift start.
Foreman payroll navigation shows payout requests from
`GET /api/v1/me/managed-payout-requests`.
Company Settings navigation uses `GET/PUT /api/v1/me/company`. Pay Rules is opened from Company Settings and uses `GET /api/v1/me/pay-policy`,
`PUT /api/v1/me/pay-policy`, and optionally
`GET /api/v1/me/pay-policy/versions`.

The verified app uses React Navigation native stacks only. Bottom tabs are not
part of this redesign phase: `@react-navigation/bottom-tabs` is absent, FOREMAN
has no separate Shifts route, and neither role has a More route. Do not add
empty or duplicate destinations to imitate the visual reference. Any future
bottom-tab information architecture requires a separate canonical decision.
ADMIN continues to use the unsupported-role state and has no mobile MVP flow.

### Shared presentation and state contract

Screens use the token and semantic-component layers in
`UI_DESIGN_SYSTEM.md`. Evolve the current `Screen`, `Button`, `FormField`,
`StatusBadge`, `StateMessage`, `SegmentedControl`, shift cards, and payout card
before introducing parallel components. Add shared `ScreenHeader`, `Card`,
`AppIcon`, `SectionHeader`, `ActionTile`, identity/company summary patterns,
`Metric`, `SettingGroup`, and dedicated empty/feedback abstractions only where
the documented contract requires them and the pattern genuinely repeats.

The theme/shared-component correction stage must happen before screen
migrations. It preserves existing accessibility and behavior while evolving the
visual composition primitives and unified icon approach required by the global
reference contract. Already-correct functional work remains usable; it is not,
by itself, evidence of visual approval.

Every redesigned network screen must preserve:

- blocking first load and a non-destructive refresh state where content already
  exists;
- a specific empty state and current next action when one exists;
- safe backend/field errors, generic network fallback, and retry/recovery;
- disabled/busy controls that prevent duplicate mutations;
- success or conflict feedback that remains visible for the current operation;
- current focus/unmount and stale-response protections.

Status badges use the canonical copy dictionary in `UI_DESIGN_SYSTEM.md`.
Shift, attendance, attendance payment, payout request, PayCalculation snapshot,
and pause states must not be collapsed into one label.

### Full reference-driven screen scope

The migration covers every current mobile MVP component below. Route names are
shown in parentheses when the screen is registered in a native stack. The
session, unsupported-role, and company gates remain conditional UI and do not
become new navigation destinations.

| Screen/component | Composition outcome |
| --- | --- |
| `LoginScreen` (`Login`) | Compact ShiftPay brand, `Welcome back`, product sentence, separately approved construction hero, overlapping elevated form card, icon-supported credentials, primary Log in, `or`, secondary Create account. |
| `RegisterScreen` (`Register`) | Shared branded auth/onboarding shell, clear intro, elevated grouped account/role form, and reference-like action hierarchy. |
| `RestoreSessionScreen` | Branded system-state shell with intentional loading feedback. |
| `UnsupportedRoleScreen` | Branded system-state shell with clear explanation and only existing recovery/logout behavior. |
| `JoinCompanyScreen` | Branded worker onboarding shell, elevated join-code form, explanation, and prominent join action. |
| `CreateCompanyScreen` | Branded foreman onboarding shell, elevated grouped company/currency/default-rate form, explanations, and prominent create action. |
| `WorkerDashboardScreen` (`WorkerDashboard`) | Identity/role header, returned company summary, prominent Join shift, History/Payroll action tiles, recent/current section header, redesigned semantic shift cards. |
| `JoinShiftScreen` (`JoinShift`) | Strong header, elevated join-code card, contextual help, clear feedback, and keyboard-safe primary action. |
| `MyShiftHistoryScreen` (`MyShiftHistory`) | Strong header, surfaced list context, redesigned compact shift cards, icon metadata, separate dates/duration/amount/status. |
| `WorkerPayrollScreen` (`WorkerPayroll`) | Strong header, surfaced selection, compact payable cards, backend-preview metrics, primary request action, segmented history, semantic request cards. |
| `WorkerShiftDetailsScreen` (`WorkerShiftDetails`) | Strong header, primary state/status summary, grouped timing/work/pay cards, returned metrics/breakdown, contextual pause action. |
| `ForemanDashboardScreen` (`ForemanDashboard`) | Identity/role header, returned company/join-code summary, prominent Create shift, Settings/Payroll action tiles, recent/current section, redesigned managed-shift cards. |
| `CreateShiftScreen` (`CreateShift`) | Strong header, grouped shift/rate cards with explanations and company/currency context, keyboard-safe create action. |
| `ForemanShiftDetailsScreen` (`ForemanShiftDetails`) | Strong header, lifecycle/status summary, grouped shift/pause/attendance/rate cards, metrics, contextual actions, separated destructive decisions. |
| `ShiftSummaryScreen` (`ShiftSummary`) | Strong result header, primary closed/status summary, returned total metrics, grouped worker cards, layered attendance/pay breakdown. |
| `ForemanPayrollRequestsScreen` (`ForemanPayrollRequests`) | Strong header, PENDING/APPROVED segment surface, compact request cards, icon metadata, chips, and conditional approve action. |
| `ForemanCompanySettingsScreen` (`ForemanCompanySettings`) | Strong header, grouped identity/localization/default/read-only cards, explained Pay Rules row, visible dirty/save feedback, keyboard-safe actions. |
| `ForemanPayRulesScreen` (`ForemanPayRules`) | Strong header, policy/version summary, grouped week/stacking settings, structured rule cards/editor, explanations, visible async/save state. |

Every composition uses only real fields, statuses, and actions returned or
already available to that screen. The reference must not supply missing data or
new destinations.

## 5. Screens

### LoginScreen

Purpose:

- authenticate an existing user
- restore role-based navigation after successful login

Fields:

- email
- password

Actions:

- log in
- navigate to register

API calls:

- `POST /api/v1/auth/login`
- after login, store the returned token and user
- restore later sessions through `GET /api/v1/users/me`

States:

- loading while submitting
- field validation error
- invalid credentials error
- generic network error

Rules:

- retain entered values and field errors after a rejected attempt
- block duplicate submit while authentication is in flight
- provide an accessible password-visibility action
- keep submit reachable with the keyboard and increased system text size
- implement the full Login composition from the scope table, including the
  construction hero and elevated/overlapping form card
- use `mobile/assets/images/login-hero.png`; the exact bitmap must receive
  separate user visual approval before implementation and may be derived from
  the reference or created as a new AI-generated variant in a close style
- bundle the hero locally, mark it decorative/accessibility-hidden, include no
  third-party text/branding or recognizable person, and use a
  portrait-responsive crop that preserves keyboard/form reachability
- do not add the reference image's Terms/Privacy copy or legal routes

### RestoreSessionScreen

Purpose:

- resolve an existing stored session before role routing

Presentation:

- use the same branded system-state shell as other app-level states
- show intentional, accessible loading feedback without fabricated progress
- avoid a blank screen, a dashboard preview, or actions that bypass session
  validation

Rules:

- preserve the current token load, `GET /api/v1/users/me`, invalid-session
  clearing, and role routing behavior
- do not add retry, navigation, or domain behavior unless it already exists

### UnsupportedRoleScreen

Purpose:

- explain that the authenticated role has no mobile MVP flow

Presentation:

- use the branded system-state shell and reference-like surface hierarchy
- present the role limitation clearly and expose only the existing
  recovery/logout action

Rules:

- do not create an ADMIN mobile flow or new destination
- preserve existing session/logout behavior

### RegisterScreen

Purpose:

- create a `WORKER` or `FOREMAN` account

Fields:

- first name
- last name
- email
- password
- role selection: `WORKER` or `FOREMAN`

Actions:

- register
- return to login

API calls:

- `POST /api/v1/auth/register`
- after successful registration, either return to login or log in through the
  existing login flow

Rules:

- use the shared branded auth/onboarding shell, clear intro, elevated grouped
  form surface, and primary/secondary action hierarchy from the scope table
- do not allow `ADMIN` registration in the mobile UI
- after FOREMAN registration/login, prompt company creation if no company exists
- after WORKER registration/login, prompt company join if no company exists
- show backend validation and duplicate-email errors clearly

### CreateCompanyScreen

Purpose:

- let a foreman create their company before creating shifts

Fields:

- company name
- currency label
- optional default worker hourly rate
- optional default foreman hourly rate

Actions:

- create company

API calls:

- `POST /api/v1/companies`
- refresh `GET /api/v1/users/me` after success

Rules:

- use the shared branded onboarding shell and grouped elevated company form
  from the scope table; keep the final action keyboard-safe
- only FOREMAN uses this screen
- FOREMAN cannot create or start shifts before company creation
- currency label is required free-form display text; examples such as `EUR`, `€`, `USD`, `долар`, `грн`, or `元` are hints, not a closed list. Use the exact shared boundary algorithm: remove only leading/trailing code points in this set, U+0009–U+000D, U+0020, U+0085, U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F, and U+3000; reject a blank result; then limit it to 64 Unicode code points, not UTF-8 bytes or UTF-16 code units. Preserve all non-boundary Unicode/case without normalization. Do not rely on JavaScript `trim()`; backend validation is authoritative, and the screen must display a backend field-validation response if rejected
- default rates may be left empty and configured later in Company Settings, but shift creation then requires explicit rates until defaults exist
- show company join code after creation so it can be shared with workers

### JoinCompanyScreen

Purpose:

- let a worker join a company before joining shifts

Fields:

- company join code

Actions:

- join company

API calls:

- `POST /api/v1/companies/join`
- refresh `GET /api/v1/users/me` after success

Rules:

- use the shared branded onboarding shell, elevated join-code surface, and
  reference-like action/feedback hierarchy from the scope table
- only WORKER uses this screen
- normalize company join code visually as uppercase if practical
- WORKER cannot join a shift before joining that shift's company

### WorkerDashboardScreen

Purpose:

- show the worker's most relevant shift status and quick actions

Content:

- current user name
- company name when joined
- primary action to join a shift
- shortcut to shift history
- shortcut to payroll
- recent joined shifts if available
- pause status if the worker has an active joined shift:
  worker paused, global pause active, or not paused

API calls:

- `GET /api/v1/users/me`
- `GET /api/v1/me/shifts`

Empty state:

- no joined shifts yet
- clear action to join by code
- no company yet
- clear action to join company by company join code

### JoinShiftScreen

Purpose:

- let a worker join an OPEN shift before start or an ACTIVE shift as a late worker by join code

Fields:

- join code

Actions:

- submit join code

API calls:

- `POST /api/v1/shifts/join`
- refresh `GET /api/v1/me/shifts` after success

Rules:

- normalize user input visually as uppercase if practical
- worker never enters or edits hourly rate
- worker must already belong to the shift's company
- backend accepts joins only for `OPEN` and `ACTIVE` shifts
- show duplicate join, unknown code, forbidden, and `CLOSED`/`CANCELLED`/`DISCARDED` shift errors

### MyShiftHistoryScreen

Purpose:

- list shifts where the current user has a worker attendance record

Content:

- shift title
- location
- company name
- shift status
- attendance status
- payment status when present: `UNPAID`, `PAYMENT_REQUESTED`, or `PAID`
- pause status when active
- actual date/time when available
- salary when calculated
- premium totals indicator when backend returns one

API calls:

- `GET /api/v1/me/shifts`

Rules:

- this screen is worker attendance history
- do not use it as foreman managed-shift history
- pay breakdown seconds, exact minutes, and base/premium/total amounts are backend audit fields; audit amounts can have up to 8 decimal places, so mobile may format them for display but must not calculate or re-sum them
- scale-2 settlement money, whole-number payout amounts, and scale-8 audit money
  use their distinct formatting contracts from `UI_DESIGN_SYSTEM.md`; do not
  apply a default three-fraction-digit locale formatter to audit values

### WorkerShiftDetailsScreen

Purpose:

- show details for one joined shift from the worker perspective

Content:

- shift title and location
- company name
- shift status
- attendance status
- actual start/end times when available
- hourly rate snapshot
- break minutes
- payable start time when provided by the backend
- current personal/all pause state
- persisted pause minutes after close
- worked minutes
- calculated salary
- read-only own pay breakdown after close when returned by the backend
- payment status when present

API calls:

- can use selected item data from `GET /api/v1/me/shifts`
- may refresh history if needed
- `POST /api/v1/shifts/{shiftId}/pauses/me/start`
- `POST /api/v1/shifts/{shiftId}/pauses/me/end`

Rules:

- worker pause controls are available only while the shift is `ACTIVE`
- worker pause controls require approved attendance, not only a pending join request
- worker pause controls affect only the current worker
- show whether an all-participant pause is active from `pauseState`
- do not calculate pause-adjusted salary on the client
- do not calculate premium pay, overtime, effective rates, or pay breakdown totals on the client
- do not calculate rounded payroll minutes or payout amount on the client
- pay breakdown `payableMinutes` is display-oriented; mobile must not use it to derive amounts
- if payCalculation is absent/null for legacy closed attendance, treat persisted calculatedSalary as the backend final amount; when totals are returned, base equals calculatedSalary and premium is 0. Do not ask the client to reconstruct a breakdown or recalculate it.
- if a returned payCalculation or segment has `snapshotStatus: "UNAVAILABLE"`, show a neutral unavailable-breakdown state. Persisted durations and amounts may be displayed, but appliedRules is null (never an empty-rule result) and mobile must not infer that no premium rules applied or recalculate any amount.
- detailed PayCalculation/PaySegment amounts are scale-8 audit data. Show stored calculatedSalary for normal currency display; do not independently round or sum segment amounts, because the audit-component sum can differ from the once-rounded currency salary.
- for late workers, display backend persisted `payableStartTime`, `workedMinutes`, `pauseMinutes`, and `calculatedSalary`; do not derive them from `actualStartTime`

### WorkerPayrollScreen

Purpose:

- let a worker select CLOSED unpaid work days and create a payout request
- show pending and approved payout requests for the current worker

Content:

- company name
- selectable list or calendar of payable attendance records
- checkbox beside each unpaid closed day
- shift title, date, location, raw worked minutes or formatted hours/minutes
- backend-calculated whole-number payout amount
- selected total raw minutes and payout amount from backend preview
- backend currency label beside each amount and preview/request total
- own payout request history with status badges

Actions:

- select or clear attendance records
- submit payout request
- refresh payable attendances and payout requests

API calls:

- `GET /api/v1/me/payable-attendances`
- `POST /api/v1/me/payout-requests/preview`
- `POST /api/v1/me/payout-requests`
- `GET /api/v1/me/payout-requests`

Rules:

- show only backend-returned payable attendance records
- use explicit attendanceIds from selected checkboxes
- disable submit when no attendance is selected
- call `POST /api/v1/me/payout-requests/preview` after selection changes before showing selected totals
- selected total raw minutes and payout amount must come from the latest backend preview response
- do not allow one selection to visually combine different currency labels. If the backend returns `MIXED_CURRENCY_LABELS`, keep the items separate and tell the worker to create separate requests
- a payable legacy item with `currencyLabel: null` may be shown as an unknown historical label but cannot be submitted; show the backend conflict explaining that it has no stored currency label and must not be relabelled from current Company Settings
- do not sum selected totals locally and do not calculate payroll locally
- preview is non-binding; create can still fail or return changed totals because the backend revalidates and recalculates during creation
- after successful request creation, refresh payable attendances and payout requests
- if selected attendanceIds contain duplicates due to UI state bugs, backend returns 400; the UI should refresh selection state instead of trying to de-duplicate silently
- `UNPAID` items are selectable
- `PAYMENT_REQUESTED` and `PAID` items are shown only in request/history context, not as selectable payable items
- mobile may format minutes into hours/minutes for display
- mobile must not calculate salary, rounded payable minutes, or payout amount
- backend preview/create `payoutAmount` and raw payable time are the payroll values shown on cards and selected-total UI
- do not show `payoutRoundedMinutes` or exact calculated amount on payout request
  cards in the current flow; any future inline audit presentation first requires
  a canonical docs update
- use status badges for `UNPAID`, `PAYMENT_REQUESTED`, `PAID`, `PENDING`, and `APPROVED`
- if backend returns a conflict because an item was already requested or paid, refresh and show the updated state

### ForemanDashboardScreen

Purpose:

- show shifts created and managed by the current foreman

Content:

- current user name
- company name
- primary action to create a shift
- managed shift list
- shortcut to Company Settings; Pay Rules is nested there
- shortcut to payroll requests
- status labels for `OPEN`, `ACTIVE`, `CLOSED`, `CANCELLED`, and `DISCARDED`

API calls:

- `GET /api/v1/users/me`
- `GET /api/v1/me/managed-shifts`

Rules:

- if no company exists, render `CreateCompanyScreen`
- this screen should not use `GET /api/v1/me/shifts`
- ADMIN has no mobile MVP route to this screen

### ForemanCompanySettingsScreen

Purpose:

- let a foreman manage the current company's basic settings and open Pay Rules

Content:

- editable company name
- editable free-form currency label
- optional default worker hourly rate
- optional default foreman hourly rate
- read-only company join code
- read-only company timezone
- Pay Rules navigation row/button
- clear saved, loading, validation, and error states

API calls:

- `GET /api/v1/me/company`
- `PUT /api/v1/me/company`

Rules:

- only FOREMAN sees or navigates to Company Settings; WORKER and ADMIN mobile navigation must not expose it
- currency label is free-form Unicode display text up to 64 Unicode code points. Use the exact shared boundary algorithm: remove only leading/trailing code points in this set, U+0009–U+000D, U+0020, U+0085, U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F, and U+3000; reject blank input after removal; and count the result by Unicode code points, not UTF-8 bytes or UTF-16 code units. Preserve all non-boundary characters/case without normalization; do not use JavaScript `trim()`. Mobile may mirror this validation for immediate feedback, but backend validation is authoritative and its field-validation response must be displayed if rejected. Do not use a fixed currency picker or require an ISO code
- explain that currency is a name shown beside amounts and that ShiftPay does not convert money
- worker and foreman defaults are independent, optional, non-negative values with at most two decimal places
- explain that defaults prefill/fallback for new shifts only and do not alter existing shifts or payroll history
- if a migrated company returns `currencyLabel: null`, require a valid label to save before allowing a new shift; do not use the current label to repaint any legacy history
- timeZone and joinCode are visible but read-only in this phase
- Pay Rules is part of Company Settings navigation but remains saved through its separate immutable policy endpoint

### ForemanPayRulesScreen

Purpose:

- let a foreman configure company premium pay policy

Content:

- company name
- read-only company default worker hourly rate and currency label used for examples
- current policy version and company timezone
- “Week starts on” selector with helper text explaining that it is the first day of the working week and the weekly overtime counter resets at the beginning of that day in the company timezone
- stacking strategy segmented control labelled `Combine all premiums` for backend `ADD` and `Use highest premium only` for backend `HIGHEST_ONLY`
- enable/disable rule toggles
- percentage inputs for each enabled rule
- per-rule illustrative premium/rate preview when a company default worker rate exists
- “Time of day” inputs for `TIME_OF_DAY`
- “Daily overtime” and “Weekly overtime” threshold inputs for `DAILY_OVERTIME` and `WEEKLY_OVERTIME`
- selected-weekday multi-select for `DAY_OF_WEEK`
- manual holiday local-date list with add/remove and optional labels for `HOLIDAY`
- validation, loading, error, and saved states

API calls:

- `GET /api/v1/me/pay-policy`
- `PUT /api/v1/me/pay-policy`
- optional `GET /api/v1/me/pay-policy/versions`
- `GET /api/v1/me/company` for preview/reference settings

Rules:

- only FOREMAN uses this screen
- open this screen from Company Settings rather than treating it as a worker/admin or standalone payroll destination
- if no company exists, render `CreateCompanyScreen`
- saving creates a new immutable policy version in the backend
- show `Company.timeZone` as the source of day, week, and holiday boundaries
- use `MONDAY` as the recommended default week start unless backend returns a different value
- keep backend enum values and persisted policy model unchanged while presenting understandable labels: `ADD` is “Combine all premiums” and combines every matching percentage using the same base rate; `HIGHEST_ONLY` is “Use highest premium only” and applies only the largest matching percentage
- label `TIME_OF_DAY` as `Time of day`, not `Time off`, and explain that it applies during a configured local-time window which may cross midnight
- explain `DAILY_OVERTIME` as “Daily overtime”: premium work after the configured payable-hours threshold within one company-local calendar day
- explain `WEEKLY_OVERTIME` as “Weekly overtime”: premium work after the configured payable-hours threshold from the selected week start
- explain `DAY_OF_WEEK` as a premium on selected company-local weekdays
- explain `HOLIDAY` as a premium on dates the foreman adds manually; the app does not import legal/country holiday calendars
- do not hardcode Saturday, Sunday, night, overtime, holiday, country, or legal premium percentages
- disabled rules do not apply
- percentage values may include decimals, for example 37.5
- `premiumPercent` must be from 0.0000 to 1000.0000 inclusive with a maximum of 4 decimal places
- 0 is allowed for temporary/no-op enabled rules, but the UI may warn before save
- invalid percentages should be shown as field validation errors
- `TIME_OF_DAY` start and end cannot be equal and may cross midnight
- overtime thresholds are shown as understandable hours in the UI but converted to/from backend thresholdMinutes without changing the API contract
- `DAY_OF_WEEK` supports any weekday combination
- holidays are manual local dates; do not use country holiday calendars
- show backend 400 field validation errors next to the relevant control
- when Company.defaultWorkerHourlyRate exists, entering a percentage may show `Premium: +5.00 EUR/hour` and `Rate with this rule only: 25.00 EUR/hour` for base 20.00 and 25%, using the current Company.currencyLabel
- the preview is clearly labelled as an example using the company worker default. It does not promise that a rule applies to a real shift and does not combine stacking, evaluate overtime, segment work, or calculate salary, payroll, or payout totals
- do not use defaultForemanHourlyRate for this preview because foreman premium pay remains deferred
- no preview is shown when the company worker default is absent; direct the foreman to Company Settings
- apart from this single-rule illustrative preview, mobile must not calculate premium pay, overtime, effective rates, or pay totals

### CreateShiftScreen

Purpose:

- let a foreman create a new shift

Fields:

- location
- default break minutes
- default hourly rate
- foreman hourly rate

Actions:

- create shift

API calls:

- `POST /api/v1/shifts`
- refresh `GET /api/v1/me/managed-shifts` after success

Rules:

- require a company before this screen is available
- do not show title input for the mobile MVP
- do not show planned start or planned end time inputs for the mobile MVP
- the backend generates the shift title from date/time and company name
- exact generated title locale/format can be refined during backend implementation
- load Company Settings before rendering defaults
- prefill default hourly rate from Company.defaultWorkerHourlyRate and foreman hourly rate from Company.defaultForemanHourlyRate when present
- either rate remains editable as a per-shift override
- for each rate, an omitted request property or explicit JSON `null` means no per-shift override and falls back to the matching company default; a numeric value, including `0`, is the per-shift override. The typed API client must not treat zero as missing
- a rate field may be omitted or sent as `null` when the matching company default exists; if neither the form nor company supplies it, block submission and explain which Company Setting or shift override is required. A stale request still receives the backend 400 field-validation error for the missing rate after fallback
- show Company.currencyLabel beside both rate inputs; if a migrated company has no label, route to Company Settings before shift creation. Do not infer a label from locale, ISO code, or an old amount
- if a stale submit receives the backend's 409 currency-label configuration conflict, return to Company Settings with its clear message; do not retry shift creation by silently assigning a label
- default break minutes is optional and defaults to 0 in the backend
- default break minutes cannot be negative when entered
- dynamic pause tracking is separate from create shift and is managed only after the shift becomes `ACTIVE`

### ForemanShiftDetailsScreen

Purpose:

- manage one foreman-created shift

Content:

- shift details
- company name
- join code
- status
- default break minutes
- default hourly rate for workers
- foreman hourly rate, visible only to the owner foreman
- actual start/end times when available
- pause state for all participants and the foreman's own personal pause
- attendance list
- lifecycle actions

Actions:

- approve joined worker
- start shift
- pause/resume self while active
- pause/resume everyone while active
- cancel shift before start
- close shift
- open summary for closed shifts

API calls:

- `GET /api/v1/shifts/{shiftId}`
- `GET /api/v1/shifts/{shiftId}/attendance`
- `POST /api/v1/shifts/{shiftId}/attendance/{attendanceId}/approve`
- `POST /api/v1/shifts/{shiftId}/start`
- `POST /api/v1/shifts/{shiftId}/cancel`
- `POST /api/v1/shifts/{shiftId}/pauses/me/start`
- `POST /api/v1/shifts/{shiftId}/pauses/me/end`
- `POST /api/v1/shifts/{shiftId}/pauses/all/start`
- `POST /api/v1/shifts/{shiftId}/pauses/all/end`
- `POST /api/v1/shifts/{shiftId}/close`
- `POST /api/v1/shifts/{shiftId}/discard`

Rules:

- approve is available only for `JOINED` attendance while the shift is `OPEN` or `ACTIVE`
- start is available only while the shift is `OPEN`
- cancel is available only while the shift is `OPEN`
- pause/resume is available only while the shift is `ACTIVE`
- foreman self pause affects only the owner foreman
- pause for all affects foreman and workers
- close is available only while the shift is `ACTIVE`
- summary is available only after the shift is `CLOSED`
- actualStartTime and actualEndTime are set by the backend
- do not calculate worker or foreman salary on the client
- do not decide whether a shift is shorter than 15 minutes on the client
- if close returns `SHORT_SHIFT_REQUIRES_DECISION`, show a foreman decision prompt
- if foreman chooses to save the short shift, call close again with `{ "saveShortShift": true }`
- if foreman chooses not to save the short shift, call `POST /api/v1/shifts/{shiftId}/discard`
- discarded shifts should show `DISCARDED` status, no summary action, and no payroll action
- late worker pay starts from backend `payableStartTime`/approval time, not the global shift start
- cancelled shifts should show CANCELLED status and no salary summary action
- use backend `pauseState` and attendance-level pause state; do not derive active pause state locally beyond rendering returned fields
- render a managed worker `payCalculation` only when the owner-FOREMAN attendance response returns it. Treat an omitted property as no returned breakdown; never infer, reconstruct, or calculate one. Render returned `UNAVAILABLE` snapshots with the neutral unavailable-breakdown state.

### ShiftSummaryScreen

Purpose:

- show final results for a closed foreman-managed shift

Content:

- total workers
- total worker salary
- worker premium pay totals when returned by the backend
- shift currency label beside worker and foreman monetary values
- worker rows with pause minutes, worked minutes, and calculated salary
- worker premium pay breakdown with base amount, premium amount, applied rules, effective premium percent, effective hourly rate, and segment amounts when returned by the backend
- private foreman salary fields for the owner foreman:
  foremanWorkedMinutes, foremanPauseMinutes, foremanHourlyRate, foremanSalary

API calls:

- `GET /api/v1/shifts/{shiftId}/summary`

Rules:

- show a clear message if the shift is not closed yet
- do not recalculate worker salary, foreman salary, premium pay, or pay breakdown totals on the client
- worker rows are based only on approved worker attendance
- backend salary subtracts backend-tracked dynamic pause minutes first, then static break minutes from earliest remaining payable worker time
- premium breakdown is read-only backend output and applies only to worker attendance in the initial implementation
- worker base/premium totals and segment money fields are scale-8 audit components; total worker salary is the sum of backend currency-settlement calculatedSalary values and can differ by a rounding delta
- for a legacy worker without a payCalculation, show the backend final salary and returned fallback totals without fabricating a detailed breakdown; base equals calculatedSalary and premium is 0
- for `snapshotStatus: "UNAVAILABLE"`, show a neutral unavailable-breakdown state rather than an empty applied-rules state, and never recalculate amounts
- do not show foreman salary fields to workers
- ADMIN users are not a mobile MVP target and should not receive foreman salary fields through REST/mobile API

### ForemanPayrollRequestsScreen

Purpose:

- let a foreman review and approve worker payout requests

Content:

- company name
- pending payout request list
- worker name
- selected shifts/days per request
- raw payable minutes with hours/minutes formatting
- backend-calculated whole-number payout amount
- persisted payout-request currency label beside monetary values
- current request cards keep returned audit-component totals and calculated
  salary hidden; request base/premium totals remain scale-8 audit values distinct
  from currency-settlement calculated salary and payout totals
- requestedAt, approvedAt, and paidAt when present
- status badges for `PENDING` and `APPROVED`

Actions:

- filter by pending or approved requests
- approve a pending payout request
- refresh request list

API calls:

- `GET /api/v1/me/managed-payout-requests`
- `POST /api/v1/me/managed-payout-requests/{requestId}/approve`

Rules:

- only FOREMAN uses this screen
- if no company exists, render `CreateCompanyScreen`
- default list should focus on `PENDING` requests
- foreman sees only requests for their company and shifts they created
- approve is available only for `PENDING` requests
- after approve, refresh the managed payout request list
- show backend conflict errors when a request was already approved or an attendance is no longer payment requested
- do not show another foreman's private salary fields
- do not calculate salary, rounded payable minutes, or payout amount on the client
- do not calculate premium pay, overtime, effective rates, or pay breakdown totals on the client
- rounded payable minutes are backend audit/display fields and must not be used by mobile to rescale premium-aware salary
- mobile must not derive payout totals locally
- no payout-request-detail route or action exists. Preserve the current inline
  card flow. If already-returned detailed content is later included on this
  existing screen, it may expand inline only; a separate destination requires a
  future canonical information-architecture and API decision
- show stored calculatedSalary/final payoutAmount for normal money display. If
  inline expanded content exposes scale-8 base/premium audit components, format
  each returned value only; do not independently round, sum, or reconcile it to
  currency totals
- for legacy payout items without a payCalculation, use backend-returned calculatedSalary/payout values and fallback totals only; do not synthesize a breakdown or recalculate the payout basis
- do not show exact calculated amount or rounded payable minutes on payout
  request cards in the current flow; any future inline audit presentation first
  requires a canonical docs update
- keep payroll cards focused on raw payable time, final payout amount, status, and selected days/items
- compact payroll cards remain compact; adding currencyLabel means appending the returned text to existing amounts, not exposing hidden audit/rate fields
- do not add a base-rate field to payroll cards. The existing payroll DTO `hourlyRate` remains available only where the existing detailed contract already exposes it; the Company worker base rate mentioned by Pay Rules is preview reference data, not a new payroll-card field

## 6. Shared States

### Loading

Use loading states when:

- restoring a session
- submitting login/register forms
- loading dashboards
- creating or joining a company
- joining a shift
- creating, starting, pausing, resuming, cancelling, closing, or approving a shift

### Empty

Use empty states when:

- worker has no joined shifts
- worker has not joined a company
- foreman has not created a company
- foreman has no managed shifts
- attendance list has no joined workers
- worker has no payable attendance records
- worker has no payout requests
- foreman has no pending payout requests

Each empty state should include one clear next action when an action is available.
Loading, empty, error, and retry presentation uses the same branded shell,
surface language, section hierarchy, and shared `Feedback`/`EmptyState`
patterns as populated screens; it must not look like a legacy utility view.

### Error

Show backend error messages when they are safe and useful, for example validation,
duplicate email, invalid credentials, duplicate join, forbidden, or shift state
conflicts. For payroll, show conflicts for already requested or already paid
attendance and stale approve attempts. For pay policies, show field-level
validation for invalid percentages, time ranges, overtime thresholds, weekdays,
and holiday dates.

Use a generic fallback for network failures.

### Success

Show success feedback for:

- registration
- login
- shift join
- shift creation
- company creation
- company settings save
- company join
- attendance approval
- shift start
- shift pause/resume
- shift cancel
- shift close
- payout request creation
- payout request approval
- pay policy save

### Redesign state acceptance by target screen

| Screen | Required state coverage before visual acceptance |
| --- | --- |
| Login | Initial/content, local field errors, invalid credentials/backend error, network error, submitting/disabled, keyboard, retained input, long text, font scale 1.5, narrow viewport, and approved hero crop. |
| Register | Initial/content, role selection, local/backend validation, duplicate email, submitting/disabled, keyboard, long text, font scale 1.5, and narrow viewport. |
| Restore Session | Loading with real session restore, invalid/expired-session transition, long text/font scale, and narrow viewport where applicable. |
| Unsupported Role | Real unsupported role, existing recovery/logout action and busy/error behavior where applicable, long text/font scale, and narrow viewport. |
| Join Company | Initial/content, validation, unknown code, submitting/disabled, success transition, keyboard, long text/font scale, and narrow viewport. |
| Create Company | Initial/content, optional/default-rate variants, validation/server error, submitting/disabled, success, keyboard, long Unicode text, font scale 1.5, and narrow viewport. |
| Worker dashboard | Initial load, refresh, no company gate, no shifts, error/retry, current OPEN/ACTIVE state, attendance approval, payment and pause states, long returned text, font scale 1.5, and narrow viewport. |
| Join Shift | Initial/content, validation, duplicate/unknown/forbidden/lifecycle errors, submitting/disabled, success, keyboard, long text/font scale, and narrow viewport. |
| Shift history | Initial load, empty/join action, error/retry, long list, cancelled/discarded non-payable rows, pending/null fields, legacy null currency, available/unavailable/absent breakdown, long text/font scale, and narrow viewport. |
| Worker payroll | Initial load, no payable work, no requests, preview loading/error/stale result, empty/mixed/null-label selection disable, create conflict/success, refreshed history, long real data, font scale 1.5, and narrow viewport. |
| Worker shift details | Initial/content, returned status combinations, pause mutation busy/error/success, closed breakdown complete/unavailable/absent, nullable data, long text/font scale, and narrow viewport. |
| Foreman dashboard | Initial load, refresh with content retained, no company gate, no managed shifts, error/retry, active shift priority, all canonical shift statuses, long returned text, font scale 1.5, and narrow viewport. |
| Create Shift | Blocking settings load, defaults/overrides including zero, missing-rate/null-label routing, validation/server error, submitting/disabled, keyboard, long text/font scale, and narrow viewport. |
| Foreman shift details | Initial/content, attendance empty/data/error, approval and lifecycle mutations disabled/busy/error/success, short-shift decision, pause states, all real statuses, breakdown variants, long text/font scale, and narrow viewport. |
| Shift Summary | Loading, not-closed/error/retry, empty/single/many workers, legacy and COMPLETE/UNAVAILABLE breakdowns, nullable label, long values/text, font scale 1.5, and narrow viewport. |
| Foreman payroll requests | Initial load, empty PENDING and APPROVED filters, refresh, approval loading/success, stale conflict, real `approvedAt` and `paidAt`, legacy null label, long text/font scale, and narrow viewport. |
| Company Settings | Blocking load, failed initial load/retry, migrated null label, route notice, dirty form, field/server error, saving/disabled, saved state, Pay Rules transition, keyboard, long Unicode/font scale, and narrow viewport. |
| Pay Rules | Blocking coherent-pair load, background refresh, required refresh/failure/retry, save loading/success/field error, focus/unmount/stale responses, empty/all rule editors, queued refresh, keyboard, long text/font scale, and narrow viewport. |

The state coverage above must use real typed fixtures or API data and real
returned statuses where the screen is network-backed. Screenshot mock values do
not replace behavior tests.

## 7. Basic Visual Direction

- Follow the canonical tokens, semantic components, status copy, and responsive
  rules in `UI_DESIGN_SYSTEM.md`.
- Treat `DesignExample.png` as the approved visual-language and composition
  reference for every mobile MVP screen. Each screen must recognizably carry
  its layered surfaces, hierarchy, actions, cards, semantic chips, icon
  treatment, and teal/slate language without literal pixel copying.
- A token-only reskin of an old layout is not accepted unless the unchanged
  composition has a documented, screen-specific justification.
- Use the separately approved Login hero only under its explicit asset contract. The
  reference's tabs, hamburger/settings destinations, legal links, and mock data
  do not create product requirements.
- Rebranding is deferred. The visible product name remains `ShiftPay`.

### Accessibility and responsive acceptance

- Support narrow phones, safe-area insets, reachable scrolling, Android/iOS
  keyboard behavior, and portrait plus practical landscape layouts.
- Support increased system font sizes without clipping critical copy, amounts,
  errors, controls, or badges. Long person, company, location, currency, and
  rule names wrap instead of disappearing behind one-line truncation.
- All actions expose accessible name, role, disabled/selected/busy state, and at
  least a 44 x 44 touch target. Color never carries status alone.
- Verify WCAG AA contrast for normal/large text, graphics, badges, focus, and
  disabled states.
- Preserve meaningful screen-reader order and announce important error/success
  feedback.

### Per-screen review gate

For every screen, use this gate in order:

1. Implement without commit or push.
2. Run typecheck, lint, focused tests, relevant regressions, and
   `git diff --check`.
3. Obtain an independent read-only review, correct every finding, and repeat
   until the reviewer reports `NO FINDINGS`.
4. Review the real app on an Android device or emulator. Check every relevant
   initial/content, loading, empty, error/retry, mutation-disabled, long-text,
   keyboard, font-scale-1.5, narrow-viewport, and real-status/data state from
   the table above. Record device/OS, viewport or orientation, font scale, and
   screenshots.
5. Obtain explicit user visual approval. Only then create and push the
   screen's feature-branch commit and begin the next screen.

Android is the current validation platform. Document iOS as unavailable until
that platform can be reviewed; Android approval does not silently imply iOS
approval. A screen is not complete merely because its populated happy path
resembles the reference.

## 8. Out Of Scope For Mobile MVP

- offline sync
- push notifications
- biometric unlock
- refresh-token or long-lived session
- GPS tracking
- QR code scanning
- PDF export
- admin screens
- tax calculations
- payment processing
- accounting integrations
- chat or messaging
- country-specific legal premium defaults
- country-specific holiday calendars

## 9. Pause UX Contract

Pause is implemented in the backend for active shifts.

Mobile should implement:

- worker self pause during an active joined shift
- foreman self pause during an active owned shift
- foreman all-participant pause during an active owned shift
- backend-provided `pauseState` in shift, managed-shift, attendance, and worker-history DTOs
- backend-provided `pauseMinutes`/`foremanPauseMinutes` after close

Mobile must not calculate pause-adjusted salary. It should display backend persisted `payableStartTime`, `workedMinutes`, `pauseMinutes`, `foremanPauseMinutes`, and salary fields after close. All-participant pauses that began before a late worker's payable start are already clipped by the backend for that worker.

## 10. Implementation Notes

- Use React Native, Expo, and TypeScript.
- Keep API calls in `src/api/`.
- Keep screen components focused on UI state and user interaction.
- Store auth/session state through a storage abstraction.
- Keep token expiration handling; do not assume tokens never expire.
- Restore sessions through `GET /api/v1/users/me`.
- Do not hardcode backend URLs inside screens.
- REST API is the source of truth.
- Do not calculate salary on the client.
- Do not calculate premium pay, overtime, rule matches, effective rates, or pay
  breakdown totals on the client.
- Do not calculate rounded payroll minutes or payout amounts on the client.
- The mobile app should consume persisted `workedMinutes` and
  `calculatedSalary` values returned by the backend.
- The mobile app should consume backend `payCalculation` breakdowns as
  read-only display data after close.
- The mobile app may format backend seconds/exact-minute audit fields as
  simplified hours/minutes, but must not use display minutes to calculate
  premium amounts.
- The mobile app should consume payroll `paymentStatus`,
  raw payable time, and `payoutAmount` values returned by the backend for card
  display.
- The mobile app must not show `payoutRoundedMinutes` or exact calculated amount
  on payout request cards in the current flow. Any future inline audit
  presentation first requires a canonical docs update.
- For late workers, the mobile app should treat backend `payableStartTime` as the worker's effective salary start.
- The mobile app should consume backend `pauseState`, `pauseMinutes`, and
  `foremanPauseMinutes` rather than deriving pause totals locally.
- If an API endpoint is missing or unclear, update `docs/API.md` before building
  against assumptions.
