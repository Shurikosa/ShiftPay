
---

# 3. `docs/SPEC.md`

```md
# ShiftPay Specification

## 1. Product Overview

ShiftPay is an application for tracking work shifts, worked hours, and salary.

The main users are:

- foremen
- workers
- admins

The application should support teams where a foreman manages a work shift and workers join that shift.

The product should be cross-platform:

- Android mobile app
- iOS mobile app
- web admin dashboard served by the backend using Vaadin

## 2. Main Problem

Manual tracking of working hours can be inaccurate.

Workers may forget start or end time.

Foremen may need a simple way to manage shift attendance.

Salary calculation can become confusing when there are:

- different hourly rates
- breaks
- incomplete shifts
- multiple workers
- daily or weekly summaries

ShiftPay should make this process simple.

## 3. MVP Goal

The MVP should allow:

- user registration
- user login
- role-based access
- foreman creates a shift session
- workers join a shift session
- system tracks time
- system calculates salary
- users can view basic shift history

## 4. Roles

### 4.1 Worker

A worker can:

- create an account
- log in
- join a company by company join code
- join an OPEN shift before it starts or join an ACTIVE shift as a late worker
- join only shifts that belong to their company
- join without entering or selecting an hourly rate
- leave or finish a shift if allowed
- see own worked hours
- see own salary calculation
- see own premium pay breakdown after close
- see shift history
- see company name in the mobile app
- see CLOSED unpaid attendance records
- create a payout request from selected unpaid attendance records
- see own payout request statuses

### 4.2 Foreman

A foreman can:

- create a company after registration if they do not have one
- create a shift session
- start a shift
- close a shift
- cancel an OPEN shift before it starts
- manage company pay policy and premium pay rules
- invite workers or share join code
- approve joined workers
- set break duration
- set the default hourly rate for a shift
- set their own hourly rate for a shift
- cancel an OPEN shift before it starts
- pause themselves during an ACTIVE shift
- pause everyone during an ACTIVE shift
- view shifts they created and manage
- view shift summary
- view worker salary summary
- view worker premium pay breakdown for managed shifts
- view their own private foreman salary summary
- see company name in the mobile app
- view payout requests for workers in their company and their managed shifts
- approve pending payout requests

### 4.3 Admin

An admin can:

- manage companies
- manage users
- assign roles
- view reports
- manage system settings

Admin features will be available through the Vaadin admin dashboard.
Advanced admin features are not required for the first MVP, but the backend architecture should support them later.
ADMIN user management is deferred until after the mobile MVP.
The mobile MVP should not include an ADMIN flow.

## 5. Shift Session Flow

Basic flow:

1. Foreman logs in.
2. If the FOREMAN does not have a company, the foreman creates one.
3. System generates a company join code.
4. Foreman creates a shift session attached to their company with optional location, optional default break minutes, default worker hourly rate, and foreman hourly rate.
5. System generates a default title from date/time and company name.
6. System generates a shift join code.
7. Worker logs in.
8. If the WORKER is not a company member, the worker joins the company by company join code.
9. Worker enters the shift join code.
10. Worker joins the session only if they are already a member of that shift's company.
11. Worker joins the session without providing an hourly rate.
12. System copies the shift default hourly rate into the worker attendance record as a snapshot.
13. While the shift is OPEN or ACTIVE, the foreman approves joined workers and may override the rate for an individual attendance.
14. If no rate override is provided, the attendance keeps its join-time rate snapshot.
15. If the shift should not happen, Foreman cancels the OPEN shift before it starts.
16. Foreman starts the shift.
17. System records shift start time as actualStartTime.
18. System freezes the current company PayPolicy version on the shift for worker premium pay.
19. During the ACTIVE shift, late workers may join by shift join code and wait for approval.
20. During the ACTIVE shift, workers with approved attendance can pause and resume themselves.
21. During the ACTIVE shift, foreman can pause and resume themselves or everyone.
22. Foreman closes the shift.
23. If the backend detects actual duration 0 or less than 15 minutes, the system asks the foreman whether to save or discard the short shift.
24. If the foreman saves the short shift, system records shift end time as actualEndTime and closes any active pause intervals at actualEndTime.
25. If the foreman discards the short shift, system marks it DISCARDED for audit and does not calculate salary or payroll.
26. System calculates payable work intervals for approved worker attendance, subtracting static break minutes and effective pause minutes.
27. System applies the frozen PayPolicy version to approved worker attendance and stores a premium pay calculation snapshot.
28. System calculates worker salary totals from base pay plus configured percentage premiums.
29. System calculates the foreman's private salary from ShiftSession.foremanHourlyRate without creating ShiftAttendance for the foreman. Foreman premium pay is deferred.
30. Worker can view their own worker result and own pay breakdown after close.
31. Foreman can view shift summary, including worker salary summary, worker premium breakdown, and their own private foreman salary.
32. Foreman can view the list of shifts they created and manage.

## 6. Shift Statuses

A shift can have these statuses:

OPEN
ACTIVE
CLOSED
CANCELLED
DISCARDED

CANCELLED is for pre-start cancellation. DISCARDED is for an active short shift that the foreman explicitly chooses not to save.

## 7. Shift Creation Rules

FOREMAN must have a company before creating or starting a shift.

Each shift belongs to a real company through ShiftSession.companyId.

The backend must not use Default Company for real MVP shifts.

For the mobile MVP, the foreman does not enter plannedStartTime or plannedEndTime when creating a shift.

Shift creation should not require planned times.

The foreman should not manually enter a shift title in the mobile MVP.

The backend generates a default title automatically from date/time and the real company name.
Example format:

Tuesday 10:00 - Acme Construction

The exact locale and format can be refined during implementation.

Shift creation still includes:

- optional location
- optional defaultBreakMinutes
- defaultHourlyRate for workers
- foremanHourlyRate for the foreman

If defaultBreakMinutes is not provided, the backend uses 0.

actualStartTime is set by the backend when the foreman starts the shift.

actualEndTime is set by the backend when the foreman closes the shift.

## 8. Company Rules

Company onboarding is part of the mobile MVP.

FOREMAN creates a company after registration if they do not already have one.

Company has a join code generated by the backend.

Company has a timeZone using an IANA timezone id, for example Europe/Berlin.

Company.timeZone is the source of truth for pay policy day, week, and holiday date boundaries.

Existing companies can default to the backend configured timezone until a configurable company timezone UI exists.

WORKER joins a company by company join code.

WORKER can join a shift only if they are already a member of that shift's company.

WORKER can join by shift join code when the shift is OPEN or ACTIVE.

WORKER cannot join CLOSED, CANCELLED, or DISCARDED shifts.

Company name must be visible in the main menu or dashboard for FOREMAN and WORKER.

The mobile MVP should not use or show Default Company for real shifts.

## 9. Shift Cancellation Rules

Implemented for the mobile MVP.

Endpoint:

POST /api/v1/shifts/{shiftId}/cancel

Rules:

- owner FOREMAN can cancel only their own OPEN shift before it starts
- cancelled shift has status CANCELLED
- cancelled shift does not set actualStartTime or actualEndTime
- cancelled shift does not calculate salary
- cancelled shift cannot be started, closed, joined by workers, paused, resumed, or summarized
- worker history can show CANCELLED shift/status
- ADMIN is not allowed to cancel through the REST/mobile API

## 9.1 Short Shift Discard Rules

If FOREMAN tries to close an ACTIVE shift with actual duration 0 or less than
15 minutes, the backend must require an explicit decision before mutating payroll
state.

Endpoints:

POST /api/v1/shifts/{shiftId}/close

POST /api/v1/shifts/{shiftId}/discard

Rules:

- Backend is the source of truth for actual duration and the short-shift threshold.
- shortShiftMinimumMinutes = 15.
- Closing a short shift without explicit `saveShortShift: true` returns 409
  Conflict with code SHORT_SHIFT_REQUIRES_DECISION.
- The 409 warning does not close the shift, end pauses, calculate salary, or
  change attendance payment status.
- If the foreman chooses save, mobile calls close with `saveShortShift: true`;
  the shift becomes CLOSED and salary/payroll are calculated normally.
- If the foreman chooses not save, mobile calls discard; the shift becomes
  DISCARDED.
- DISCARDED must not reuse CANCELLED because CANCELLED is pre-start
  cancellation.
- Discard records actualEndTime/discardedAt, discardedBy, and discardReason for
  audit. MVP discardReason is SHORT_SHIFT_NOT_SAVED.
- Discard may auto-end active pause intervals at discardedAt for audit, but those
  pause intervals are not used for salary calculation.
- DISCARDED shifts do not calculate worker salary, foreman salary, worked
  minutes, payable minutes, or payout request data.
- Attendance on DISCARDED shifts is never payable and cannot be previewed,
  requested, or approved for payout.
- DISCARDED shifts cannot be started, closed, joined by workers, paused,
  resumed, or summarized.
- Worker history may show DISCARDED shift/status as non-payable history with no
  payroll action.
- Foreman managed shift history may show DISCARDED shift/status for audit, but it
  must not appear as normal completed work.

## 10. Pause Rules

Implemented for the mobile MVP.

Pause is separate from static defaultBreakMinutes.

Endpoints:

POST /api/v1/shifts/{shiftId}/pauses/me/start

POST /api/v1/shifts/{shiftId}/pauses/me/end

POST /api/v1/shifts/{shiftId}/pauses/all/start

POST /api/v1/shifts/{shiftId}/pauses/all/end

WORKER can start and stop pause only for themselves.

FOREMAN can:

- pause themselves
- pause everyone on the shift

Rules:

- Pause is available only while shift status is ACTIVE.
- OPEN, CLOSED, CANCELLED, and DISCARDED shifts cannot be paused or resumed.
- WORKER must already have approved attendance on the ACTIVE shift in their company.
- FOREMAN must own the shift.
- ADMIN cannot pause through the REST/mobile API.
- duplicate start for the same active pause target/scope returns conflict
- ending when no pause is active for the target/scope returns conflict
- pause for all applies to the foreman and all workers on the shift
- pause for all affects late workers only from their payable start onward
- personal pause applies only to the target user
- overlapping personal and all-pause intervals are merged as a union for salary calculation, without double-counting
- closing the shift automatically closes any active pause intervals at actualEndTime

Pause status must be visible:

- worker dashboard/details shows whether the worker is paused or global pause is active
- foreman details/dashboard shows global pause status, foreman self pause status, and worker pause status

Salary calculation subtracts accumulated effective pause minutes.

The backend persists pause intervals with start/end timestamps, scope, shift, and affected user for personal pauses.

No client-side salary calculation is allowed.

## 11. Salary Calculation

Basic formula when no premium rules apply:

duration_minutes = shift_end_time - shift_start_time
unpaid_minutes = break_minutes + effective_pause_minutes
worked_minutes = max(0, duration_minutes - unpaid_minutes)
salary = worked_minutes / 60 * hourly_rate

Example:

start time: 08:00
end time: 17:00
break: 60 minutes
hourly rate: 15 EUR/DOL

worked time = 8 hours
salary = 8 * 15 = 120 EUR/DOL

Worker salary:

worker_payable_start = actualStartTime if attendance was approved before shift start, or approvedAt/payableStartTime if attendance was approved while ACTIVE
worker_duration_minutes = actualEndTime - worker_payable_start
worker_unpaid_minutes = attendance.breakMinutes + attendance.pauseMinutes
worker_worked_minutes = max(0, worker_duration_minutes - worker_unpaid_minutes)
worker_salary = worker_worked_minutes / 60 * attendance.hourlyRate when no premium rules apply

With configurable pay rules, worker_salary is PayCalculation.totalAmount:

totalBaseAmount = sum(segment payable minutes / 60 * baseHourlyRate)
totalPremiumAmount = sum(segment premium amount)
totalAmount = totalBaseAmount + totalPremiumAmount

Foreman salary:

foreman_duration_minutes = actualEndTime - actualStartTime
foreman_unpaid_minutes = shift.defaultBreakMinutes + shift.foremanPauseMinutes
foreman_worked_minutes = max(0, foreman_duration_minutes - foreman_unpaid_minutes)
foreman_salary = foreman_worked_minutes / 60 * shift.foremanHourlyRate

## 12. Important Salary Rules
-Salary must not be negative.
-Break time and pause time cannot make paid minutes negative; paid minutes clamp to 0.
-If shift is not closed, final salary should not be calculated.
-Cancelled and DISCARDED shifts do not calculate final salary.
-Hourly rate should be stored for the attendance record, because rates can change later.
-WORKER never sets an hourly rate.
-FOREMAN sets one default hourly rate for a shift that they own.
-FOREMAN sets foremanHourlyRate for their own salary on the shift.
-ADMIN cannot create shifts or set shift default hourly rates through the REST/mobile API.
-The attendance hourly rate is copied from the shift default hourly rate when the worker joins and remains a snapshot for that attendance record.
-During approval, FOREMAN may override the hourly rate for an attendance on a shift they own.
-During approval, ADMIN may override the hourly rate for an attendance on any shift.
-An approval without an hourly rate override preserves the attendance rate snapshot.
-An attendance-specific override does not change the shift default hourly rate or another worker's attendance rate.
-Salary calculation should use precise decimal values, not floating-point double.
-Salary is calculated when a shift closes successfully.
-Only APPROVED attendance receives worked minutes and calculated salary.
-JOINED, REJECTED, CANCELLED, and DISCARDED-shift attendance keep worked minutes and calculated salary empty.
-Worker salary calculation uses the attendance hourly rate snapshot or override as the base hourly rate.
-Worker calculatedSalary stores the premium-aware total amount when a PayPolicy applies.
-Salary calculation subtracts accumulated effective pause minutes.
-Salary calculation for late approved workers starts from the worker payable start time, not the global shift actualStartTime.
-Dynamic pause calculations are clipped to each worker's payable work interval.
-Static break minutes, or static break plus pause minutes, that exceed a worker's payable duration clamp worker worked minutes and salary to 0.
-Static break minutes, or static break plus pause minutes, that exceed the foreman's payable duration clamp foreman worked minutes and salary to 0.
-Static defaultBreakMinutes is optional and defaults to 0.
-Dynamic pauses are separate from defaultBreakMinutes.
-Worker salary is calculated from ShiftAttendance.hourlyRate and must not use ShiftSession.foremanHourlyRate.
-Foreman salary is calculated separately from worker attendance using ShiftSession.foremanHourlyRate.
-The system must not create a ShiftAttendance row for foreman salary.
-Foreman salary fields are private and visible only to the owner FOREMAN of the shift.
-WORKER never receives foreman salary fields.
-For the MVP REST/mobile API, ADMIN does not receive foreman salary fields.
-Calculated salary is rounded to 2 decimal places with HALF_UP.
-Closing fails if actualStartTime is missing or salary input values are negative where request validation normally prevents them.

## 12.1 Configurable Pay Rules / Premium Pay

Configurable pay rules are company-owned and backend-calculated.

Domain rules:

- Company owns PayPolicy.
- PayPolicy is immutable and versioned.
- Editing a policy creates a new version instead of mutating the existing version.
- Company must always have a current default PayPolicy after company creation or migration.
- Backend creates a default empty PayPolicy version for a company if needed by onboarding or migration.
- Starting a shift freezes/resolves the current company PayPolicy version onto the ShiftSession.
- If shift start cannot resolve a current PayPolicy version because the invariant is broken, the backend returns 409 Conflict with code PAY_POLICY_REQUIRED.
- The backend must not silently start a shift without a frozen PayPolicy version.
- Historical CLOSED calculations must not change when the current policy changes later.
- The initial implementation applies premium rules only to worker attendance payroll.
- Foreman premium pay is deferred unless a later docs update explicitly specifies it.
- Worker attendance hourlyRate remains the base hourly rate snapshot or approval override.
- Premium percentages are additional percentages on top of the base hourly rate.
- No legal, country, Saturday, Sunday, night, overtime, or holiday premium values are hardcoded.
- If no matching rule is configured, only base pay applies.

MVP rule types:

- TIME_OF_DAY
- DAILY_OVERTIME
- WEEKLY_OVERTIME
- DAY_OF_WEEK
- HOLIDAY

Future/deferred rule types:

- fixed amount per hour
- site/project rules
- worker-specific overrides
- travel/on-call/consecutive-hours rules

Adjustment model:

- MVP supports percentage premiums only.
- Percentages support decimals, for example 37.5%.
- Backend must use decimal-safe types such as BigDecimal for percentages, rates, and money.
- premiumPercent must be a decimal from 0.0000 to 1000.0000 inclusive.
- premiumPercent supports a maximum scale of 4 decimal places.
- Invalid premiumPercent values return 400 with field errors.
- 0 is allowed to support temporary/no-op enabled rules, but UI may warn.

Stacking:

- PayPolicy has stackingStrategy.
- Supported values are ADD and HIGHEST_ONLY.
- ADD sums all applicable percentage premiums against the base rate.
- HIGHEST_ONLY applies only the highest applicable premium.
- Stacking must be implemented through the PayPolicy strategy, not scattered conditional logic.

Timezone and boundaries:

- Company.timeZone is the source of truth for policy day, week, and holiday boundaries.
- Existing companies can default to the backend configured timezone until a configurable UI exists.
- PayPolicy defines weekStartsOn. Recommended default is MONDAY.
- Work sessions crossing midnight must be segmented at policy timezone day boundaries.
- DST transitions must use real instants and durations, not naive local-hour subtraction.
- Holiday dates are manual company-configured local dates in the company/policy timezone.
- No country-specific holiday calendars are included in the MVP.

Calculation pipeline:

1. Load approved payable intervals for worker attendance.
2. Clip and subtract static breaks and dynamic pauses.
3. Segment payable work time wherever applicable rules may change.
4. Evaluate enabled PayPolicy rules on each segment.
5. Apply PayPolicy.stackingStrategy.
6. Persist PayCalculation/PaySegment snapshot data.
7. Store worker totals on attendance and expose backend-owned results.

Premium rules apply only to payable work time after unpaid deductions. Static breaks and dynamic pauses remain unpaid. Late workers use backend payableStartTime. CANCELLED and DISCARDED shifts are non-payable and excluded. Short saved CLOSED shifts can still produce zero payable minutes, zero premium amount, and zero total amount.

Segmentation boundaries:

- shift/payable interval start and end
- midnight/day boundary in Company.timeZone
- week boundary based on PayPolicy.weekStartsOn
- TIME_OF_DAY start/end, including ranges crossing midnight
- DAY_OF_WEEK boundary
- HOLIDAY date boundary
- DAILY_OVERTIME threshold crossing
- WEEKLY_OVERTIME threshold crossing
- pause/break-adjusted payable interval boundaries if needed by the existing implementation

Overtime context:

- DAILY_OVERTIME and WEEKLY_OVERTIME consider all relevant approved payable intervals for the same worker and company in the policy day/week.
- Daily and weekly overtime threshold allocation is based on chronological payable interval order in the company/policy timezone.
- Tie-break order is shift actualStartTime, then attendance/payableStartTime, then stable database id.
- Authoritative final calculation uses persisted/closing approved intervals only.
- Previous finalized payable minutes come from CLOSED shifts only. Other ACTIVE shifts are excluded from authoritative final overtime context except the shift currently being closed.
- ACTIVE in-progress estimate endpoints are not part of the MVP. If added later, they must be clearly non-authoritative.
- For the MVP, overtime calculation for a closing shift uses that shift's frozen PayPolicy version and includes previous finalized payable minutes in the same company timezone period as context.
- Previous finalized intervals keep their own historical pay calculations. Closing a later shift must not rewrite older closed calculations.
- Existing finalized closed calculations are not automatically reopened/recalculated in the MVP.
- Therefore teams should close shifts in chronological order for exact overtime allocation until batch recalculation is added.

Pay calculation breakdown:

- Backend stores enough snapshot data to explain historical calculations after policy changes.
- PayCalculation includes totalRawMinutes, totalBaseAmount, totalPremiumAmount, totalAmount, and segments.
- Each PaySegment includes start, end, payableMinutes, baseHourlyRate, appliedRules, stackingStrategy, effectivePremiumPercent, effectiveHourlyRate, and amount.
- Applied rule snapshots include rule id, name, type, and premium percent.

Acceptance examples:

A. Simple regular shift: 20.00/h, 08:00-16:00, no premium => 8h base.
B. Night boundary: 18:00-04:00, night 22:00-06:00 +25% => regular segment then night segment.
C. Configurable percentage: night +37.5% must be used exactly.
D. Daily overtime: 08:00-20:00, after 8h +50% => first 8h regular, 4h overtime.
E. Multiple sessions: 08:00-12:00 and 14:00-20:00 => daily total 10h, final 2h overtime.
F. ADD stacking: night +25%, Sunday +50%, overtime +50%, base 20.00 => effective hourly rate 45.00.
G. HIGHEST_ONLY stacking with the same rules and base 20.00 => effective hourly rate 30.00.
H. Saturday to Sunday shift: Sunday premium starts at the policy timezone day boundary.
I. Policy modification: old finalized calculations preserve old rule values.

Validation:

- Enabled rules must have valid condition config.
- Invalid configs return 400 with field errors.
- premiumPercent must be a decimal from 0.0000 to 1000.0000 inclusive.
- premiumPercent supports a maximum scale of 4 decimal places.
- 0 is allowed to support temporary/no-op enabled rules.
- TIME_OF_DAY start/end cannot be equal.
- TIME_OF_DAY may cross midnight.
- DAILY_OVERTIME and WEEKLY_OVERTIME thresholds are stored as integer minutes; UI may accept hours and convert to minutes.
- Overtime threshold must be greater than 0.
- DAY_OF_WEEK supports any weekday set, not hardcoded Saturday/Sunday.
- HOLIDAY requires explicit local dates and optional labels.
- Updating policy creates a new version and does not mutate old versions.

Authorization and privacy:

- FOREMAN can manage pay policy for their current company.
- WORKER cannot edit policy.
- WORKER can read only calculation results relevant to their own attendance after close.
- ADMIN REST/mobile behavior is deferred unless a later docs update explicitly adds it.
- Worker never sees foreman salary/rate.
- Foreman sees worker premium breakdown for managed shifts and payouts.

## 13. Payroll Requests MVP

Payroll Requests MVP tracks worker payment separately from the shift lifecycle.
Do not add PAID or NOT_PAID to ShiftStatus. Shift lifecycle statuses are:

- OPEN
- ACTIVE
- CLOSED
- CANCELLED
- DISCARDED

CANCELLED is pre-start cancellation. DISCARDED is an active short shift that the
foreman explicitly chose not to save.

Payment lifecycle is tracked on worker attendance and payout requests.

Attendance payment status:

- UNPAID
- PAYMENT_REQUESTED
- PAID

Payout request status for MVP:

- PENDING
- APPROVED

REJECTED and CANCELLED are optional future statuses. They are not required for
the first Payroll Requests MVP unless a later docs update adds reject/cancel
flows.

Business flow:

1. A foreman closes a shift.
2. The backend persists workedMinutes, premium-aware calculatedSalary, and pay
   calculation snapshots for APPROVED worker attendance.
3. CLOSED APPROVED attendance starts with paymentStatus UNPAID.
4. Worker opens Payroll and sees own CLOSED UNPAID attendance records.
5. Worker explicitly selects attendance records, usually from a calendar or list
   with checkboxes next to work days.
6. Worker previews the selected payout request totals through the backend.
7. Worker creates a payout request with attendanceIds.
8. Backend revalidates and recalculates the request during creation.
9. Selected attendance records move to PAYMENT_REQUESTED.
10. Foreman sees the payout request with worker identity, selected shifts/days,
   raw hours/minutes, whole-number payout amount, and detailed premium breakdown
   where the API exposes it for audit.
11. Foreman approves the payout request.
12. Selected attendance records move to PAID.

Validation and conflict rules:

- Worker can request payout only for their own attendance.
- Preview and create requests must reject duplicate attendanceIds with 400 Bad
  Request. The backend must not silently de-duplicate IDs.
- Worker can request payout only for attendance in their current company.
- Worker can request payout only for APPROVED attendance on CLOSED shifts.
- Attendance on DISCARDED shifts is never payable.
- Already PAID attendance cannot be included in a new request.
- PAYMENT_REQUESTED attendance cannot be included in another pending request.
- For MVP, one payout request must contain attendance records managed by one
  foreman so one foreman can approve the whole request.
- Foreman can approve only payout requests for their company and shifts they
  created.
- Payout request approval is transactional. If any selected attendance is no
  longer PAYMENT_REQUESTED, approval fails without partial updates.
- Preview is non-binding. Create revalidates and recalculates server-side
  because attendance payment state can change after preview.

Rounding rules:

- Backend is the source of truth for payroll.
- Mobile must not calculate salary, premium pay, overtime, rounded payable
  minutes, or payout amount.
- Mobile must call the backend preview endpoint for selected totals before
  submission and may display only backend-returned preview totals.
- rawPayableMinutes is the persisted ShiftAttendance.workedMinutes from the
  close flow.
- calculatedSalary remains the exact audit/display amount from the close flow,
  including configured premium pay when a PayPolicy applies, stored with scale 2
  and HALF_UP.
- payoutRoundedMinutes is rawPayableMinutes rounded to the nearest 5 minutes
  with half-up midpoint behavior.
- If rawPayableMinutes is 0, payoutRoundedMinutes is 0.
- If rawPayableMinutes is greater than 0 and rounding would otherwise produce 0,
  payoutRoundedMinutes is 5.
- For non-premium attendance, roundedItemAmountExact = payoutRoundedMinutes / 60 * hourlyRate.
- For premium-aware attendance, exactCalculatedAmount and payoutAmount use
  backend final salary/pay calculation fields and policy snapshots, not
  mobile-calculated formulas.
- payoutAmount is whole-number money with no cents, rounded from the
  backend-owned exact item amount using CEILING.
- Request totals are sums of item-level rawPayableMinutes,
  payoutRoundedMinutes, calculatedSalary, and payoutAmount.
- Examples for payoutRoundedMinutes: 0 -> 0, 1 -> 5, 4 -> 5, 5 -> 5, 7 -> 5,
  8 -> 10, 11 -> 10, 13 -> 15, 25 -> 25, 28 -> 30.
- If product later wants 25 -> 30, that is not nearest-5 half-up rounding and
  must be documented as a separate upward-rounding rule.

Display rules:

- Worker and foreman payout request cards show raw worked/payable time, final
  payoutAmount, status, and selected days/items enough for audit.
- Payout request cards must not show rounded payable minutes or exact calculated
  amount.
- Backend APIs may still return payoutRoundedMinutes and exactCalculatedAmount
  for audit/internal use; mobile hides them from cards unless a later detailed
  audit view is added.
- Backend APIs may expose totalBaseAmount, totalPremiumAmount, and payCalculation
  in detailed views. Cards still show raw payable time and final payoutAmount.

Privacy rules:

- Worker sees only their own payroll data.
- Worker never sees foreman salary or foreman rate fields.
- Foreman sees worker payout requests only for their company and managed shifts.
- Payroll request DTOs must not expose User entities, password hashes, or
  unrelated company/foreman private salary fields.

Payroll Requests MVP is not payment processing, tax calculation, accounting, or
bank transfer automation. It is a request/approval workflow that marks selected
attendance records as PAID after foreman approval.

## 14. Authentication

The system should support:

-registration
-login
-password hashing
-JWT access token
-role-based authorization

Token expiration must not be removed completely.

For MVP, the default JWT/session lifetime should be 8 hours.

Mobile should store the session and automatically restore it by calling GET /api/v1/users/me.

Future biometric unlock or refresh-token/long-lived session support can be added later.

MVP roles:

WORKER
FOREMAN
ADMIN

## 15. Biometric Authentication

Biometric login can be added later on the mobile device.

For MVP, biometric authentication is optional.

Important rule:

Biometrics should not replace backend authentication. It should only unlock locally stored session/token on the device.

## 16. Cross-Platform Requirement

The mobile app should work on:

Android
iOS

Recommended technology:

React Native + Expo + TypeScript

The admin dashboard should be a web UI served by the backend Spring Boot application using Vaadin.
It should not be a separate React, Vue, or Angular frontend project for the MVP.

## 17. Out of Scope for First MVP

The first MVP should not include:

complex payroll beyond configurable premium pay and payout request approval
tax calculation
GPS tracking
biometric login
offline sync
PDF reports
advanced admin dashboard
mobile admin flow
payment processing
accounting integration
country-specific legal premium defaults
country-specific holiday calendars

These can be added later.

## 18. First MVP Features

Required:

backend project
PostgreSQL database
user registration
login
JWT authentication
roles
company creation
company join by code
create shift session
join shift by code
start shift
close shift
cancel shift
dynamic pause tracking
calculate worked time
calculate worker salary
calculate private foreman salary
worker shift history
foreman shift summary
worker payable attendance list
worker payout request creation
worker payout request history
foreman payout request review
foreman payout request approval
cancel shift
dynamic pause tracking

Planned follow-up:

none documented for backend/mobile shift lifecycle at this point

Optional:

QR code join
simple web admin
biometric unlock
