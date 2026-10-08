# ShiftPay Mobile UI Design System

Version: 2.0 · 8 October 2026

This document is the canonical visual and interaction specification for the
ShiftPay React Native / Expo application. Product behavior remains defined by
`SPEC.md`, HTTP contracts by `API.md`, mobile flows by `MOBILE_UX.md`, and the
implementation sequence by `TASKS.md`.

[`DesignExample.png`](DesignExample.png) is the approved visual-language and
composition reference for the entire mobile MVP. Every mobile screen must
recognizably inherit its hierarchy, layered surfaces, cards, action treatment,
status presentation, icon-supported metadata, and teal/slate visual language;
pixel-for-pixel copying is not required. The image remains non-normative for
API contracts, routes, actions, returned data, status meanings, business rules,
permissions, calculations, and legal copy. Anything shown in the image but
absent from the canonical Markdown contracts remains out of scope.

## 1. Scope and invariants

This phase is a reference-driven presentation redesign of the complete mobile
MVP, not a token refresh of selected screens. It must not change backend APIs,
the data model, authorization, role permissions, pay or payout calculations,
persistence, or business rules. Existing typed clients, contexts, lifecycle
actions, error handling, concurrency protections, accessibility behavior, and
already-correct functional work remain the foundation and may be visually
evolved rather than discarded.

A migration is not accepted when it only applies new colors, fonts, spacing,
or radii to an old layout while retaining the previous composition and
information hierarchy without a documented, screen-specific reason. Each
screen must receive a visibly redesigned hierarchy, surface structure, action
placement, and state presentation appropriate to its real content and actions.

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

The reference image does not add Terms/Privacy routes, QR scanning, bottom
tabs, hamburger or generic settings destinations, account/legal screens, mock
worker counts, fabricated pay values, or any other absent feature. The existing
FOREMAN-only Company Settings route remains in scope. The Login hero slot is a
presentation-only exception governed by section 8; the exact bitmap
still requires separate visual approval and adds no product functionality.

## 2. Product direction

ShiftPay should feel calm, reliable, modern, and quick to scan during a shift.
The complete app uses a light cool canvas, dark slate typography, teal/emerald
brand accents, rounded elevated or bordered surfaces, and restrained semantic
status colors. Put the current task and its result first; keep audit detail and
policy configuration in their existing dedicated views.

The product name remains `ShiftPay`. Rebranding is deferred to a separate final
stage and is not part of this migration.

Design principles:

1. Establish a clear hierarchy of large screen titles, section titles, card
   titles, values, and supporting text; do not rely on font weight alone.
2. Prefer layered cards and grouped surfaces over plain content stacks. Use
   consistent section headers and compact icon-supported metadata to make real
   returned data easy to scan.
3. Use one clear primary action per screen or section, supported by visually
   distinct secondary and tertiary actions. Keep destructive actions separate
   and preserve existing confirmation behavior.
4. Use dashboard action tiles only for real existing destinations, and group
   related form/settings controls into explained sections.
5. Use the same semantic component for the same job throughout the app, but
   create a shared primitive only when the pattern genuinely repeats.
6. Keep number and unit together and allow both to wrap without clipping.
7. Explain policy implications beside controls, including stacking, timezone,
   thresholds, and immutable versions.
8. Keep identity, role, and company context visible where relevant while
   sharing tokens and components.
9. Use deliberate whitespace and subtle depth/surface separation; avoid both
   dense undifferentiated stacks and large accidental empty zones.
10. Design for long names, localization, narrow phones, safe areas, keyboard
    display, responsive wrapping, and a system font scale of at least 1.5.

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

Use borders, tonal background separation, and restrained platform-adjusted
shadows to create the reference-like layered depth. Elevation must remain
subtle and consistent rather than becoming decoration. Screen content respects
safe area, keyboard, scroll reachability, and existing navigation insets.

### 3.4 Iconography

Use one consistent production icon system across mobile. Semantic icons may
support fields, real navigation actions, metadata, status context, dashboard
tiles, and settings groups.

- Do not use Unicode emoji as production icons.
- Icon-only interactive controls require an accessible label, correct role and
  state, and at least the 44 x 44 minimum touch target.
- Decorative icons and the decorative Login hero are hidden from accessibility
  services.
- An icon supplements but never replaces important visible action text, status
  copy, or an essential value.
- Icon use follows existing product scope. An icon visible in the reference
  does not authorize a route, action, status, or data field.
- Use consistent size, optical weight, alignment, and semantic color through a
  shared icon wrapper or equivalent foundation instead of per-screen glyphs.

## 4. Shared component contracts

The implementation should evolve current components before introducing
parallel abstractions:

| Semantic role | Repository starting point | Required contract |
| --- | --- | --- |
| `AppScreen` | evolve `Screen` | Safe area, canvas, scroll/non-scroll, keyboard avoidance, reachable final action, configurable insets. |
| `ScreenHeader` | new shared component | Role/context eyebrow, wrapping title, optional subtitle, back and named action; no ubiquitous gear. |
| `AppIcon` | shared icon wrapper | One icon family, semantic size/color, decorative-hidden support, labelled icon-only controls, no emoji. |
| `Button` | evolve `Button` | Primary, secondary, text, destructive; loading, disabled, pressed, accessible state, stable label and minimum target. |
| `TextField` | evolve `FormField` | Persistent label, hint, field error, keyboard type, focus and optional trailing action; preserve input after rejection. |
| `Card` | new primitive | Surface, border, radius, padding and optional press state; nested surface remains distinguishable. |
| `SectionHeader` | new shared component where repeated | Wrapping section title, optional supporting text, and optional real named action such as View all. |
| `ActionTile` | new dashboard primitive | Icon, visible destination/action label, optional supporting context, pressed/disabled state; never invents a destination. |
| `IdentityHeader` / `CompanySummary` | shared pattern where repeated | Real user/role identity and returned company context without fabricated metrics. |
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
domain validation/calculation. Identity/company summaries, section headers,
metrics, action tiles, and redesigned cards should be shared only where their
content and interaction contract actually repeats.

## 5. Verified navigation map

The current app uses `@react-navigation/native-stack` only.
`@react-navigation/bottom-tabs` is not installed. Preserve these stacks and
existing transitions during the first redesign phase:

| Context | Verified routes and nesting |
| --- | --- |
| Session gate | `RestoreSessionScreen` while the stored session is resolved; it is not a new stack destination. |
| Unauthenticated | `Login`, `Register`, and their existing forward/back transitions |
| WORKER without company | role gate renders `JoinCompany` before the worker stack |
| WORKER | `WorkerDashboard`, `JoinShift`, `MyShiftHistory`, `WorkerPayroll`, `WorkerShiftDetails` |
| FOREMAN without company | role gate renders `CreateCompany` before the foreman stack |
| FOREMAN | `ForemanDashboard`, `CreateShift`, `ForemanShiftDetails`, `ShiftSummary`, `ForemanPayrollRequests`, `ForemanCompanySettings` -> `ForemanPayRules` |
| ADMIN/unsupported role | no mobile MVP flow; render `UnsupportedRoleScreen`, which is not a new product route |

The reference four-tab model is deferred. FOREMAN has no separate Shifts
destination, neither role has a More destination, and settings/account routes
must not be invented to fill tabs. A bottom-tab change requires a separate
canonical information-architecture decision and dependency/task update.

Nested screens provide a visible, named Back control and preserve Android
hardware-back behavior. `Create shift` and `Join shift` remain prominent
dashboard actions. Company Settings remains FOREMAN-only and Pay Rules remains
nested inside it. Visual headers may follow the reference composition, but they
show only actions that already exist for the current screen and role.

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

### Full mobile scope and composition contract

The reference-driven migration covers every current mobile MVP screen or gate
listed below. Route names are shown where the component is registered in a
native stack; `RestoreSessionScreen`, `UnsupportedRoleScreen`,
`JoinCompanyScreen`, and `CreateCompanyScreen` are current conditional gates,
not authorization for new routes.

| Screen/component (route where applicable) | Required reference-driven composition |
| --- | --- |
| `LoginScreen` (`Login`) | Compact ShiftPay brand area; large `Welcome back` title and product sentence; separately approved construction hero; elevated form card that visually overlaps/layers with the hero; icon-supported email/password fields; visible password action; primary Log in; `or` separator; secondary Create account. |
| `RegisterScreen` (`Register`) | Shared branded auth/onboarding shell, concise intro, elevated form surface, grouped identity/account/role fields, and clear primary/secondary action hierarchy. |
| `RestoreSessionScreen` | Branded system-state shell with compact identity, intentional loading/progress feedback, and no blank transitional canvas. |
| `UnsupportedRoleScreen` | Branded system-state shell, clear unsupported-role explanation, and only the existing recovery/logout action. |
| `JoinCompanyScreen` (company gate) | Branded onboarding shell, clear worker/company intro, elevated join-code form surface, supporting explanation, and one prominent join action. |
| `CreateCompanyScreen` (company gate) | Branded onboarding shell, clear foreman/company intro, elevated grouped company/currency/default-rate form, explanatory copy, and prominent create action. |
| `WorkerDashboardScreen` (`WorkerDashboard`) | Identity/WORKER header, returned company summary, prominent Join shift action, History and Payroll action tiles, current/recent section header, and redesigned shift cards with separate real status dimensions. |
| `JoinShiftScreen` (`JoinShift`) | Strong header, elevated join-code card, concise eligibility/help copy, reference-like primary action, and clear feedback surface. |
| `MyShiftHistoryScreen` (`MyShiftHistory`) | Strong header, filter/context surface only if backed by current behavior, section hierarchy, and compact redesigned shift cards separating date, duration, amount, and status. |
| `WorkerPayrollScreen` (`WorkerPayroll`) | Strong header; surfaced selection context; selectable payable-work cards; backend-preview metrics in a distinct summary card; primary request action; segmented request history; compact status-aware request cards. |
| `WorkerShiftDetailsScreen` (`WorkerShiftDetails`) | Strong header; primary shift/attendance/payment status summary; grouped timing, work, and pay cards; returned metrics and breakdown; contextual pause action with clear primary/secondary state. |
| `ForemanDashboardScreen` (`ForemanDashboard`) | Identity/FOREMAN header, returned company/join-code summary, prominent Create shift action, Company Settings and Payroll Requests action tiles, recent/current section header, and redesigned managed-shift cards. |
| `CreateShiftScreen` (`CreateShift`) | Strong header, grouped shift/rate form cards with explanations, visible returned company/currency context, and keyboard-safe primary create action. |
| `ForemanShiftDetailsScreen` (`ForemanShiftDetails`) | Strong header; primary lifecycle/status summary; grouped shift, pause, attendance, and rate cards; metrics; contextual lifecycle actions; clearly separated destructive cancel/discard decisions. |
| `ShiftSummaryScreen` (`ShiftSummary`) | Strong result header, closed-status summary, metric surfaces for returned totals, grouped worker result cards, and layered read-only attendance/pay breakdown. |
| `ForemanPayrollRequestsScreen` (`ForemanPayrollRequests`) | Strong header, prominent PENDING/APPROVED segmented surface, compact redesigned request cards, icon-supported time/date/amount metadata, status chips, and approve action only where currently allowed. |
| `ForemanCompanySettingsScreen` (`ForemanCompanySettings`) | Strong header; grouped identity, localization, defaults, and read-only company-detail cards; explained Pay Rules row; clear dirty/saving/saved/error feedback; keyboard-safe actions. |
| `ForemanPayRulesScreen` (`ForemanPayRules`) | Strong header; policy/version summary; grouped week/stacking settings; structured rule cards/editor; explanatory surfaces; visible loading/dirty/saving/saved/error state; keyboard-safe save action. |

Across the table, “strong header”, cards, metrics, icons, and action hierarchy
refer only to presentation of fields and actions already available to that
screen. They must not fabricate values or imply unsupported navigation.

### Login

- Use the full Login composition in the table above: compact brand, `Welcome back`,
  one product sentence, construction hero, overlapping elevated form
  card, labelled icon-supported email/password fields, `or` separator,
  accessible password-visibility action, primary Log in, and secondary Create
  account.
- Preserve values and field errors; show invalid credentials/network feedback;
  block duplicate submit. Keyboard and increased text must not hide submit.
- Do not add reference-image Terms/Privacy links without real routes and
  approved legal copy.
- The hero contract is `mobile/assets/images/login-hero.png`. Before mobile
  implementation, the exact bitmap requires separate user visual approval. It
  may be derived from the reference or be a new AI-generated image in a close
  style. It must be locally bundled, decorative and accessibility-hidden,
  contain no third-party text/branding or recognizable person, and use a
  portrait-responsive crop that preserves form reachability on narrow/short
  screens and at increased font scale.

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

The previously implemented mobile redesign is a behavioral/accessibility
foundation, not visual approval. First complete a correction stage that reviews
the theme and all shared components against this global composition contract.
Preserve correct behavior and accessibility while strengthening reusable
composition primitives, the unified icon approach, action tiles,
identity/company summaries, section headers, metrics, and redesigned cards only
where patterns genuinely repeat.

After that correction stage, migrate one screen at a time in this order:

1. `LoginScreen` after separate approval of `login-hero.png`.
2. `RegisterScreen`.
3. `RestoreSessionScreen`.
4. `UnsupportedRoleScreen`.
5. `JoinCompanyScreen`.
6. `CreateCompanyScreen`.
7. `WorkerDashboardScreen`.
8. `JoinShiftScreen`.
9. `MyShiftHistoryScreen`.
10. `WorkerPayrollScreen`.
11. `WorkerShiftDetailsScreen`.
12. `ForemanDashboardScreen`.
13. `CreateShiftScreen`.
14. `ForemanShiftDetailsScreen`.
15. `ShiftSummaryScreen`.
16. `ForemanPayrollRequestsScreen`.
17. `ForemanCompanySettingsScreen`.
18. `ForemanPayRulesScreen` shell/state, then its rule editor within the same
    screen approval boundary.
19. Verified navigation/header consistency and final regression across all
    screens without adding destinations.

Do not redesign all screens in one implementation task. A later screen may
reuse an already-approved shared primitive, but must still receive its own
composition and approval gate.

For each migrated screen:

1. Read this document, `MOBILE_UX.md`, `SPEC.md`, and the relevant `API.md`
   sections plus the current implementation/tests.
2. Change only mobile presentation code and focused tests; preserve typed API,
   role gates, actions, calculations, and async behavior.
3. Implement without commit or push, then run typecheck, lint, focused tests,
   relevant regressions, and `git diff --check`.
4. Obtain an independent read-only review. Correct every finding and repeat the
   review until it reports `NO FINDINGS`.
5. Review the real screen on an Android device or emulator. Check every
   relevant state: initial/content, loading, empty, error/retry, mutation
   disabled/busy, long text, keyboard, font scale 1.5, narrow viewport, and real
   returned statuses/data. Record device/OS, viewport or orientation, font
   scale, states, and comparison screenshots.
6. Obtain explicit user visual approval. Only after approval may the mobile
   agent create and push that screen's feature-branch commit. Then proceed to
   the next screen.

Android is the currently available visual-validation platform. Lack of iOS
review must be recorded for every affected gate until iOS is available; it is
not evidence of iOS approval.

The phase is accepted when all screens in the full scope use the approved
reference-driven visual language and have visibly reconsidered composition and
hierarchy, not merely tokens; shared semantic tokens/components do not create
scattered raw visual constants; every existing role action remains reachable;
status and null/money/time contracts above hold; each screen has independent
`NO FINDINGS` review and user visual approval; and final Android plus iOS when
available (otherwise explicitly documented as unavailable) smoke review passes
without backend, API, business-rule, permission, calculation, or data-model
changes.
