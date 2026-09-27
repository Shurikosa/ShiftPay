# ShiftPay Mobile UI Design System

Version: 1.0 · 27 September 2026

This document is the canonical visual and interaction specification for the
ShiftPay React Native / Expo application. Product behavior remains defined by
`SPEC.md`, HTTP contracts by `API.md`, mobile flows by `MOBILE_UX.md`, and the
implementation sequence by `TASKS.md`.

[`DesignExample.png`](DesignExample.png) is a non-normative visual reference for
the teal direction, spacing, typography, surfaces, and information hierarchy.
It is not contract authority and does not authorize routes, actions, data,
status meanings, legal copy, calculations, or assets that are absent from the
canonical specifications and implementation.

## 1. Scope and invariants

This phase is a presentation redesign. It must not change backend APIs, the data
model, authorization, role permissions, pay or payout calculations, persistence,
or business rules. Existing typed clients, contexts, lifecycle actions, error
handling, and concurrency protections remain in place.

The redesign must preserve these invariants:

- shift, attendance, attendance-payment, payout-request, calculation-snapshot,
  and pause state are separate dimensions;
- a `CLOSED` shift is not necessarily paid, attendance `APPROVED` is not paid,
  and payout-request `APPROVED` must not be relabelled as `PAID`;
- missing money, durations, timestamps, or labels are unavailable or pending
  according to field semantics, never numeric zero; a real backend zero remains
  zero;
- `currencyLabel` is opaque persisted display text, not an ISO-4217 code and
  not permission to convert, normalize, infer, or historically relabel money;
- all payable results and totals are backend-owned. The already-approved,
  single-rule Pay Rules example is the only client-side monetary illustration;
- saving Pay Rules creates a new immutable current version. Shift start freezes
  the then-current policy for calculation, and historical results do not change;
- the UI must not claim a per-shift policy version where the current DTO does
  not provide one.

The reference image does not add Terms/Privacy routes, construction-photo
functionality, QR scanning, generic account or role-agnostic settings
destinations, decorative settings gears, mock worker counts, fabricated pay
values, or any other absent feature. The existing FOREMAN-only Company Settings
route remains in scope.

## 2. Product direction

ShiftPay should feel calm, reliable, and quick to scan during a shift. Use a
light neutral canvas, white surfaces, deep teal primary actions, clear system
type, and restrained semantic status colors. Put the current task and its
result first; keep audit detail and policy configuration in their existing
dedicated views.

Design principles:

1. Use one clear primary action per screen or section. Keep destructive actions
   distinct and preserve existing confirmation behavior.
2. Use the same semantic component for the same job throughout the app.
3. Keep number and unit together and allow both to wrap without clipping.
4. Explain policy implications beside controls, including stacking, timezone,
   thresholds, and immutable versions.
5. Keep role context visible while sharing tokens and components.
6. Design for long names, localization, narrow phones, safe areas, keyboard
   display, and increased system font size.

## 3. Foundations

### 3.1 Color tokens

Use semantic aliases through the theme module. New screen code must not contain
raw color literals.

| Token | Initial value | Use |
| --- | --- | --- |
| `brand.primary` | `#0F766E` | Primary action, link, selected control |
| `brand.pressed` | `#115E59` | Pressed primary state |
| `brand.tint` | `#CCFBF1` | Selected or emphasized subtle surface |
| `canvas` | `#F8FAFC` | App background |
| `surface` | `#FFFFFF` | Card and input background |
| `surface.subtle` | `#F1F5F9` | Secondary action and nested row |
| `ink.primary` | `#0F172A` | Heading and primary value |
| `ink.secondary` | `#475569` | Supporting copy |
| `ink.muted` | `#64748B` | Hint and metadata |
| `border` | `#CBD5E1` | Outline and divider |
| `focus` | `#0F766E` | Visible focus indication |
| `success.fg/bg` | `#166534` / `#DCFCE7` | Successful outcome |
| `warning.fg/bg` | `#92400E` / `#FEF3C7` | Pending/attention state |
| `danger.fg/bg` | `#B91C1C` / `#FEE2E2` | Destructive action or error |
| `info.fg/bg` | `#075985` / `#E0F2FE` | Informational/current state |

Status color is supplementary. Every status has visible text and, when several
dimensions appear together, a context label or unambiguous copy.

### 3.2 Typography

Use platform system fonts and OS font scaling. Values are density-independent
React Native sizes, not screenshot pixels.

| Role | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| Display | 32 / 38 | 700 | Key timer or amount |
| Screen title | 24 / 30 | 700 | Screen heading |
| Section title | 18 / 24 | 700 | Section heading |
| Card title | 16 / 22 | 600 | Record heading |
| Body | 16 / 24 | 400 | Main copy and form value |
| Label | 14 / 20 | 600 | Field/control label |
| Supporting | 14 / 20 | 400 | Description and metadata |
| Caption | 12 / 16 | 500 | Compact optional metadata |

Use tabular numerals for timers and money where supported. Buttons, fields,
cards, and badges grow vertically and wrap at larger font scales. Critical
labels, errors, amounts, and actions must not be ellipsized.

### 3.3 Spacing, dimensions, and elevation

| Token | Value | Use |
| --- | ---: | --- |
| `space.1/2/3/4/6/8` | 4 / 8 / 12 / 16 / 24 / 32 | Standard spacing scale |
| `inset.screen` | 20 | Phone horizontal content inset |
| `gap.section` | 24 | Content-group separation |
| `padding.card` | 16 | Card content |
| `height.control.min` | 48 | Button and field minimum |
| `target.min` | 44 x 44 | Minimum actionable target |
| `radius.sm/md/lg` | 8 / 12 / 16 | Compact control, input, card |
| `border.default` | 1 | Surface delineation |

Prefer borders and background separation over shadows. Reserve a subtle
platform-adjusted shadow for floating overlays. Screen content respects safe
area, keyboard, scroll reachability, and any future navigation inset.

## 4. Shared component contracts

The implementation should evolve current components before introducing
parallel abstractions:

| Semantic role | Repository starting point | Required contract |
| --- | --- | --- |
| `AppScreen` | evolve `Screen` | Safe area, canvas, scroll/non-scroll, keyboard avoidance, reachable final action, configurable insets. |
| `ScreenHeader` | new shared component | Role/context eyebrow, wrapping title, optional subtitle, back and named action; no ubiquitous gear. |
| `Button` | evolve `Button` | Primary, secondary, text, destructive; loading, disabled, pressed, accessible state, stable label and minimum target. |
| `TextField` | evolve `FormField` | Persistent label, hint, field error, keyboard type, focus and optional trailing action; preserve input after rejection. |
| `Card` | new primitive | Surface, border, radius, padding and optional press state; nested surface remains distinguishable. |
| `StatusBadge` | evolve `StatusBadge` | Domain-specific visible copy plus semantic tone; wraps and never relies on color alone. |
| `Metric` | new component | Label, value, unit, explanation, pending and unavailable variants. |
| `ShiftCard` | converge `ManagedShiftCard` and `WorkerShiftCard` | Shared shell with role-specific data; separate status dimensions; show duration/amount only when returned. |
| `RequestCard` | evolve `PayoutRequestCard` | Worker/company, request status, selected work, raw time, final payout and returned timestamps; compact-card field limits remain. |
| `SegmentedControl` | evolve existing component | Accessible selected/disabled states; wrapping or scrolling labels at large text/narrow widths. |
| `SettingGroup` | new component | Heading, explanation, controls, dirty/saving/saved/error feedback. |
| `EmptyState` | split from `StateMessage` | Specific title, explanation, and one available next action. |
| `Feedback` | evolve/split `StateMessage` | Loading, inline/screen error, retry, warning, and success; announce important updates accessibly. |

`DetailRow`, `PayCalculationBreakdown`, `PayPolicyRuleEditor`, and the current
context/API abstractions remain valid specialized building blocks. Presentation
components display typed state; they do not fetch directly or reimplement
domain validation/calculation.

## 5. Verified navigation map

The current app uses `@react-navigation/native-stack` only.
`@react-navigation/bottom-tabs` is not installed. Preserve these stacks and
existing transitions during the first redesign phase:

| Context | Verified routes and nesting |
| --- | --- |
| Unauthenticated | `Login`, `Register`, and their existing forward/back transitions |
| WORKER without company | role gate renders `JoinCompany` before the worker stack |
| WORKER | `WorkerDashboard`, `JoinShift`, `MyShiftHistory`, `WorkerPayroll`, `WorkerShiftDetails` |
| FOREMAN without company | role gate renders `CreateCompany` before the foreman stack |
| FOREMAN | `ForemanDashboard`, `CreateShift`, `ForemanShiftDetails`, `ShiftSummary`, `ForemanPayrollRequests`, `ForemanCompanySettings` -> `ForemanPayRules` |
| ADMIN | no mobile MVP flow; render the existing unsupported-role state |

The reference four-tab model is deferred. FOREMAN has no separate Shifts
destination, neither role has a More destination, and settings/account routes
must not be invented to fill tabs. A bottom-tab change requires a separate
canonical information-architecture decision and dependency/task update.

Nested screens provide a visible, named Back control and preserve Android
hardware-back behavior. `Create shift` and `Join shift` remain prominent
dashboard actions. Company Settings remains FOREMAN-only and Pay Rules remains
nested inside it.

## 6. Status and copy dictionary

These are separate UI dimensions. Components may use title case while typed API
values remain unchanged.

| Dimension / API value | Approved UI copy | Tone |
| --- | --- | --- |
| Shift `OPEN` | Open | info |
| Shift `ACTIVE` | Active | success |
| Shift `CLOSED` | Closed | neutral |
| Shift `CANCELLED` | Cancelled | danger |
| Shift `DISCARDED` | Discarded | warning |
| Attendance `JOINED` | Waiting for approval | info |
| Attendance `APPROVED` | Attendance approved | success |
| Attendance `REJECTED` | Attendance rejected | danger |
| Attendance `CANCELLED` | Attendance cancelled | neutral |
| Payment `UNPAID` | Unpaid | warning |
| Payment `PAYMENT_REQUESTED` | Payment requested | info |
| Payment `PAID` | Paid | success |
| Payout request `PENDING` | Pending approval | warning |
| Payout request `APPROVED` | Approved | success |
| PayCalculation `COMPLETE` | Breakdown available | neutral |
| PayCalculation `UNAVAILABLE` | Breakdown unavailable | warning |
| Personal pause active | Personal pause active | warning |
| All-participant pause active | Crew pause active | warning |

`CREATED` exists defensively in the current mobile `ShiftStatus` TypeScript
union, but it is not a canonical API ShiftStatus and must not be advertised as a
returned product state or assigned product copy. An inactive pause does not need
a status badge; when both returned pause flags are active, keep personal and
crew pause meaning explicit instead of collapsing either into shift status.
When returned, `approvedAt`, `paidAt`, and attendance payment status are
displayed as their own facts; payout approval must not be used as a generic Paid
badge. `CLOSED`, attendance `APPROVED`, and payout-request `APPROVED` therefore
never imply attendance payment `PAID`.

## 7. Formatting contracts

### 7.1 Money and nullable values

- Format a numeric amount with the device locale as a decimal, not with a
  locale currency formatter. Append the exact persisted non-null
  `currencyLabel`: `<locale-formatted amount> <currencyLabel>`.
- Currency-settlement fields whose API contract is scale 2, including
  `calculatedSalary`, summary salary, foreman salary, hourly rates, and
  `exactCalculatedAmount`, use an explicit two-fraction-digit presentation.
  Whole-number `payoutAmount` uses zero fraction digits. These rules format the
  returned value only; they do not round one returned field into another.
- All API-defined scale-8 audit amount occurrences use one formatting rule.
  This includes PayCalculation/PaySegment `totalBaseAmount`,
  `totalPremiumAmount`, `totalAmount`, `baseAmount`, and `premiumAmount`, plus
  summary, payable-attendance, payout-preview, payout-request, and payout-item
  `totalBaseAmount` and `totalPremiumAmount` fields. Format each directly
  returned field with an explicitly configured maximum of eight fraction digits
  and enough digits to retain its material precision; never use
  `Intl.NumberFormat` defaults, the scale-2 settlement formatter, or a locally
  summed/recomputed/reconciled value. Trailing-zero display may be compacted,
  but the UI must not imply that audit components equal the separately returned
  settlement salary when a rounding delta exists.
- Do not inspect the label to choose prefix/suffix, decimals, symbol, or
  conversion. The reference image's `€` prefix is not normative.
- When the amount exists but its historical label is null, show the returned
  numeric amount with a neutral `currency unavailable` annotation. Never use the
  current company label as a replacement.
- When an amount itself is null, show field-specific copy such as `Salary
  pending` or `Amount unavailable`; do not render `0`.
- Preserve backend numeric zero as zero. The same rule applies to duration and
  count fields.
- Compact payout cards retain only already-approved fields: raw payable time,
  final `payoutAmount`, request/payment status, and selected work summary. A
  label beside those amounts does not authorize extra audit/rate fields.

### 7.2 Locale, dates, and timezone

- Use the device locale for date/number language and ordering.
- Use `Company.timeZone` for company-domain date/time display when available.
  Pay Rules uses the returned `PayPolicy.timeZone`; Company Settings uses its
  returned timezone. Other current-company screens may use
  `user.company.timeZone` when the record belongs to that company.
- When a view has no applicable timezone in its response or authenticated
  company context, including a historical record that cannot be safely tied to
  that current context, fall back explicitly to the device timezone for
  display. The UI does not need to add a synthetic timezone label unless the
  view already labels timezone; this is a presentation limitation, not
  authority for pay-policy boundaries.
- Never derive day/week/holiday or payroll calculation semantics from the
  device timezone. Backend persisted instants and calculations remain
  authoritative.
- Use absolute date/time for auditable shift and payout events. Relative copy
  may supplement, never replace, an important persisted timestamp.

## 8. Screen requirements

Every network screen has a first-load state, content/empty state, recoverable
error with retry where safe, mutation-disabled state, and success or conflict
feedback appropriate to its current behavior. A visual redesign must preserve
existing stale-response, focus/unmount, selection-preview, and save/load
coordination instead of replacing it with static mock layouts.

Known coordination invariants include the Company Settings load sequence and
focus/unmount guard; Create Shift's settings-load sequence plus user-edited-rate
guards; Worker Payroll's single-mutation lock, selection-bound latest preview,
and refresh recovery; and Pay Rules' coherent policy/settings pair, focus
generation, required-freshness state, queued load, and stale-callback
suppression. Header or shared-component work that touches these screens must not
weaken those owners even when the screen itself is not the current migration
target.

### Login

- Compact brand, one product sentence, labelled email/password fields, an
  accessible password-visibility action, primary Log in, and secondary Create
  account.
- Preserve values and field errors; show invalid credentials/network feedback;
  block duplicate submit. Keyboard and increased text must not hide submit.
- Do not add reference-image Terms/Privacy links without real routes and
  approved legal copy. The construction photo is not an implementation asset.

### Foreman dashboard

- Show role/name/company context and existing worker join code. Keep Create
  shift, Company Settings, Payroll requests, refresh, managed shift detail, and
  logout actions.
- Prioritize a real ACTIVE shift without fabricating counts or money. Preserve
  loading, no-company, no-shifts, error/retry, refresh, and all five canonical
  shift statuses.

### Worker dashboard

- Show role/name/company context, Join shift, My shift history, Payroll, recent
  shift details, refresh/retry, and logout.
- Prioritize a returned active shift and separate shift, attendance, payment,
  and pause state. Preserve no-company and no-shifts actions.

### Shift history

- Preserve backend order and existing detail navigation. Show title, company,
  location, actual time when returned, separate statuses, payable start/worked
  time, and stored amount only when available.
- Preserve loading, empty/join action, error/retry, legacy null-label, degraded
  breakdown, and non-payable cancelled/discarded states.

### Worker payroll

- Preserve selectable backend-returned payable attendance, latest backend
  preview, explicit attendance IDs, create, refresh, and request history.
- Keep submit disabled for empty, null-label, mixed-label, loading, stale, or
  unpreviewed selection as currently required. Show preview/create conflicts and
  refresh recovery. Never locally sum or de-duplicate payout data.

### Foreman payroll requests

- Preserve PENDING/APPROVED filtering, refresh, approve, selected work, raw
  time, final payout, and returned requested/approved/paid timestamps.
- Approve exists only for PENDING. Preserve initial loading, per-filter empty,
  stale conflict, mutation disable, success, and error recovery. `APPROVED` copy
  and `paidAt` remain distinct facts.

### Company Settings

- FOREMAN-only. Group company identity, localization, independent rate defaults,
  and the Pay Rules link. Name, currency label, and defaults are editable;
  join code and timezone remain read-only.
- Preserve migrated null-label handling, exact Unicode validation, route notice,
  initial load/reload, field/server errors, dirty/saving/saved state, and
  future-shifts-only explanation. Do not relabel history.

### Pay Rules

- FOREMAN-only and nested under Company Settings. Separate policy metadata,
  week/stacking settings, and rule editor. Explain timezone and immutable new
  versions without claiming a per-shift version not returned by the DTO.
- Preserve the current coherent policy/settings pair, focus lifecycle,
  generation sequencing, required freshness gate, background refresh,
  queued-load ownership, save feedback, field errors, and stale callback
  suppression.
- Preserve exact percentage/threshold validation, all five rule types, manual
  holidays, weekday choices, and the worker-default-only single-rule preview.
  No production pay, applicability, stacking, overtime, salary, or payout math
  is allowed in presentation code.

## 9. Accessibility and responsive behavior

- Meet WCAG AA contrast targets: 4.5:1 for normal text and 3:1 for large text
  and essential graphics. Verify badge and disabled combinations on device.
- Every control has an accessible name, role, and selected/disabled/busy state.
  Icon-only controls require a name and at least a 44 x 44 target.
- Use meaningful reading order and announce important errors/success changes.
- Support narrow phones, portrait and landscape where practical, safe-area
  insets, Android/iOS keyboard behavior, and large system fonts. Content scrolls
  instead of being clipped or placed behind the keyboard.
- Long person/company/site/currency/rule names wrap. Do not use fixed heights
  that fail under localization or font scaling.
- Copy remains concise and localizable. Uppercase enum values are not used as
  visual hierarchy when approved UI copy exists.

## 10. Migration and acceptance

Migrate in this order: theme tokens, shared components, Login, foreman
dashboard, worker dashboard, shift history, worker payroll, foreman payroll
requests, Company Settings, Pay Rules shell/state, Pay Rules rule editor, then
navigation/header polish and final regression. Do not redesign all screens in
one task.

For each migrated screen:

1. Read this document, `MOBILE_UX.md`, `SPEC.md`, and the relevant `API.md`
   sections plus the current implementation/tests.
2. Change only mobile presentation code and focused tests; preserve typed API,
   role gates, actions, calculations, and async behavior.
3. Run typecheck, lint, focused tests, and `git diff --check`.
4. Review on a device or emulator before starting the next screen. Record
   platform/device, viewport or orientation, font scale, and representative
   loading, empty, error, long-text, disabled, and real-data states; retain a
   screenshot for visual comparison.

The phase is accepted when all targeted screens use shared semantic tokens and
components without new scattered raw visual constants; every existing role
action remains reachable; status and null/money/time contracts above hold; and
final Android plus iOS when available (otherwise documented available-device)
smoke review passes without backend, API, business-rule, permission, or data
model changes.
