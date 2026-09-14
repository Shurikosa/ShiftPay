# ShiftPay Tasks

This file is the development backlog for the MVP.

Do not work on many tasks at the same time.

Each Codex session should take one small task from this file.

## Milestone 0: Project Setup

- [x] Create monorepo structure
- [x] Add root `README.md`
- [x] Add root `AGENTS.md`
- [x] Add `docs/SPEC.md`
- [x] Add `docs/API.md`
- [x] Add `docs/ARCHITECTURE.md`
- [x] Add `.gitignore`
- [x] Create initial Git commit

## Milestone 1: Backend Foundation

- [x] Create Spring Boot project in `backend/`
- [x] Use Java 21
- [x] Use Maven
- [x] Add Spring Web
- [x] Add Spring Data JPA
- [x] Add PostgreSQL driver
- [x] Add Flyway
- [x] Add Validation
- [x] Add Lombok
- [x] Add Spring Security
- [x] Add basic health endpoint
- [x] Add test that application context starts

## Milestone 2: Database Foundation

- [x] Add Docker Compose for PostgreSQL
- [x] Configure backend database connection
- [x] Create Flyway migration for users
- [x] Model roles in the users migration with enum/check constraint
- [x] Create Flyway migration for companies
- [x] Create Flyway migration for shift sessions
- [x] Create Flyway migration for attendance

## Milestone 3: Authentication

- [x] Implement user registration
- [x] Hash passwords
- [x] Implement login
- [x] Generate JWT access token
- [x] Add role-based authorization
- [x] Add current user endpoint
- [x] Add authentication tests

## Milestone 4: Shift Sessions

- [x] Implement shift creation
- [x] Generate join code
- [x] Implement shift status
- [x] Implement start shift
- [x] Implement close shift
- [x] Add validation rules
- [x] Add tests for shift lifecycle

Short-shift correction tasks:

- [x] Add `DISCARDED` ShiftStatus for active short shifts the foreman chooses not to save
- [x] Update close shift to return `SHORT_SHIFT_REQUIRES_DECISION` when backend actual duration is 0 or less than 15 minutes and `saveShortShift` is not true
- [x] Support close shift request body `{ "saveShortShift": true }` so the foreman can explicitly save a short shift
- [x] Add `POST /api/v1/shifts/{shiftId}/discard` for owner FOREMAN to discard ACTIVE shifts whose backend actual duration is 0 or less than 15 minutes
- [x] Persist discardedAt, discardedBy, discardReason, and audit actualEndTime for DISCARDED shifts
- [x] Ensure DISCARDED shifts do not calculate salary, initialize payroll, appear as payable attendance, or return shift summary
- [x] Add lifecycle tests for short close warning, explicit save, discard, non-owner/role rejection, non-short discard conflict, pause auto-end audit behavior, and payroll exclusion

## Milestone 5: Attendance

- [x] Worker joins shift by code
- [x] Foreman approves worker
- [x] Store hourly rate
- [x] Store attendance status
- [x] Add attendance tests

## Milestone 6: Salary Calculation

- [x] Implement worked minutes calculation
- [x] Implement break deduction
- [x] Implement salary calculation
- [x] Prevent negative salary
- [x] Prevent invalid break duration
- [x] Use BigDecimal for money
- [x] Add unit tests for salary calculation

## Milestone 6.1: Payroll Requests MVP

Backend tasks:

- [x] Add attendance payment status: UNPAID, PAYMENT_REQUESTED, PAID
- [x] Initialize APPROVED CLOSED attendance as UNPAID during close flow
- [x] Add payout_requests table/entity with worker, company, manager foreman, status, totals, requestedAt, approvedAt, paidAt
- [x] Add payout_request_items table/entity with attendance snapshots, exact amount, rounded minutes, whole-number payout amount, and paidAt
- [x] Add payroll rounding service: round raw payable minutes to nearest 5 minutes with half-up midpoint behavior and round item payout amount up to whole money units
- [x] Implement `GET /api/v1/me/payable-attendances`
- [x] Implement `POST /api/v1/me/payout-requests/preview`
- [x] Implement `POST /api/v1/me/payout-requests`
- [x] Implement `GET /api/v1/me/payout-requests`
- [x] Implement `GET /api/v1/me/managed-payout-requests`
- [x] Implement `POST /api/v1/me/managed-payout-requests/{requestId}/approve`
- [x] Enforce worker ownership, company scope, CLOSED shift, APPROVED attendance, UNPAID payment status, and same-manager-foreman request validation
- [x] Reject duplicate attendanceIds with 400 Bad Request for preview and create
- [x] Prevent PAID or PAYMENT_REQUESTED attendance from being added to a new pending request
- [x] Enforce foreman approval only for own company and own managed shifts
- [x] Add transactional locking for payout request creation and approval
- [x] Add backend tests for payroll authorization, conflicts, transactional status updates, privacy, and rounding edge cases
- [x] Update OpenAPI/Swagger docs for payroll endpoints after implementation

Mobile tasks:

- [x] Add payroll API client methods and TypeScript DTOs
- [x] Add Worker Payroll screen with selectable CLOSED unpaid attendance days
- [x] Add backend preview call for selected payout totals
- [x] Add payout request creation flow using explicit attendanceIds
- [x] Show worker payout request history with PENDING and APPROVED status badges
- [x] Add Foreman Payroll Requests screen for pending/approved requests
- [x] Add foreman approve action and refresh behavior
- [x] Display backend `paymentStatus`, raw payable time, and whole-number `payoutAmount` on payroll cards
- [x] Hide `payoutRoundedMinutes` and exact calculated amount on payout request cards unless a later detailed audit view is added
- [x] Ensure mobile formats time only and does not calculate or sum salary, rounded payroll minutes, payout amounts, or selected totals
- [x] Add short-shift close decision flow: handle `SHORT_SHIFT_REQUIRES_DECISION`, save with `{ "saveShortShift": true }`, or call discard

## Milestone 6.2: Configurable Pay Rules / Premium Pay

Phase dependencies:

- Phase 1 must finish and pass review before Phase 2A starts.
- Phase 2A must finish and pass review before Phase 2B starts.
- Phase 2B must finish and pass review before Phase 2C starts.
- Phase 2C backend work must finish and pass review before Phase 2D starts.
- Backend/mobile agents must not redefine business rules. If a phase exposes a spec gap, report "docs change required".

Phase 1 - Pay policy configuration foundation:

- [x] Add Company.timeZone with IANA timezone validation and configured backend timezone default for existing companies
- [x] Add default/current PayPolicy initialization for every company after creation and migration
- [x] Add PayPolicy/PayPolicyVersion and PayPolicyRule migrations/entities
- [x] Store PayPolicy as immutable company-owned versions; updating policy creates a new version and does not mutate old versions
- [x] Add active/default policy initialization with weekStartsOn MONDAY, stackingStrategy ADD, no default premium percentages, and migration/onboarding backfill for companies missing a current policy
- [x] Add PayPolicy rule persistence
- [x] Add PayPolicy validation for rule condition configs, premiumPercent 0.0000..1000.0000 with max scale 4, time ranges, overtime thresholds, weekdays, and manual holidays
- [x] Implement `GET /api/v1/me/pay-policy`
- [x] Implement `PUT /api/v1/me/pay-policy`
- [x] Implement `GET /api/v1/me/pay-policy/versions` for audit if included in the backend scope
- [x] Freeze current PayPolicyVersion id on ShiftSession at shift start and return PAY_POLICY_REQUIRED if the current policy invariant is broken
- [x] Do not integrate premium calculation into closeShift in Phase 1
- [x] Do not change calculatedSalary or payout behavior in Phase 1
- [x] Update OpenAPI/Swagger docs for pay policy endpoints after implementation

Phase 2A - Premium calculation foundation, no production salary change:

- [x] Add internal premium calculation service
- [x] Add explainable PayCalculation/PaySegment result objects with seconds/exact minutes audit fields, display-oriented payableMinutes, segment base/premium/total amounts, and applied rule snapshots, without production persistence
- [x] Implement TIME_OF_DAY rule evaluation
- [x] Implement DAY_OF_WEEK rule evaluation
- [x] Implement HOLIDAY rule evaluation
- [x] Implement ADD and HIGHEST_ONLY stacking strategies through PayPolicy.stackingStrategy
- [x] Build segmentation for payable interval start/end, dynamic pause removal by timestamp, earliest-first static break deduction, company timezone day boundaries, midnight, TIME_OF_DAY boundaries, DAY_OF_WEEK boundaries, HOLIDAY boundaries, and DST-safe real instants/durations
- [x] Add unit tests for acceptance scenarios A, B, C, F, G, and H from SPEC/API
- [x] Add unit tests for holiday and day-of-week rule evaluation
- [x] Add unit tests for static break placement: 20:00-04:00 with static break 60 removes 20:00-21:00, and dynamic pause 22:00-22:30 is removed before earliest-first static break deduction
- [x] Do not integrate the premium calculation service with closeShift in Phase 2A
- [x] Do not change calculatedSalary or payout behavior in Phase 2A

Phase 2B - Overtime calculation context:

- [x] Implement DAILY_OVERTIME rule evaluation
- [x] Implement WEEKLY_OVERTIME rule evaluation
- [x] Add previous finalized payable intervals context for the same worker/company and policy timezone period
- [x] Use frozen policy version plus previous finalized payable minutes for MVP overtime context when closing a shift
- [x] Implement deterministic chronological overtime allocation by company/policy timezone payable interval order
- [x] Tie-break chronological allocation by payable interval/piece start, attendancePayableStartTime fallback, required stable DB/test id, then current flag only as final deterministic fallback
- [x] Document and test MVP chronological-close limitation for overtime allocation; teams should close shifts chronologically until batch recalculation exists
- [x] Add tests for acceptance scenarios D and E from SPEC/API
- [x] Add tests for weekly overtime boundary behavior
- [x] Do not integrate overtime premium calculation into production closeShift in Phase 2B unless the phase is explicitly promoted to Phase 2C
- [x] Do not change calculatedSalary or payout behavior in Phase 2B unless the phase is explicitly promoted to Phase 2C

Phase 2C - Production salary integration and persisted breakdown:

- [x] Add PayCalculation and PaySegment persistence/snapshot model
- [x] Add and expose PayCalculation/PaySegment snapshotStatus (`COMPLETE` or `UNAVAILABLE`); invalid/unreadable appliedRulesSnapshot JSON must produce `UNAVAILABLE` with `appliedRules: null`, never an empty list, and must be logged/observed as persistence corruption
- [x] Integrate premium calculation into closeShift using the frozen PayPolicyVersion
- [x] Make worker calculatedSalary the premium-included worker total for approved attendance
- [x] Persist PayCalculation/PaySegment base, premium, and total audit amounts at decimal scale 8; compute each segment once from seconds/exact duration without independent currency rounding, persist headers as segment sums, and enforce all four audit identities
- [x] Round ShiftAttendance.calculatedSalary once from PayCalculation.totalAmount to scale 2 with HALF_UP; keep detailed audit components separate from currency-settlement salary and payout totals
- [x] Persist calculation breakdown/snapshot data needed to explain historical calculations after policy changes
- [x] Keep foreman premium pay deferred; foreman salary remains separate and base-rate only
- [x] Ensure CANCELLED/DISCARDED shifts remain non-payable and excluded from premium/payroll calculations
- [x] Ensure short saved CLOSED shifts can persist zero payable, premium, and total amounts
- [x] Expose worker pay breakdown in shift summary for owner FOREMAN
- [x] Expose own read-only pay breakdown in worker history/details after close
- [x] Expose premium totals/breakdown in payout/payable detailed DTOs according to API docs while keeping mobile cards simple
- [x] Ensure payout requests use stored premium-included salary/backend payroll service amounts, expose aggregate totalBaseAmount/totalPremiumAmount/totalCalculatedSalary or exact total naming, and keep rounded minutes informational for premium-aware salary
- [x] Apply the legacy CLOSED APPROVED attendance fallback consistently in worker history/details, foreman summary/details, and payout preview/create/list/approve: persisted calculatedSalary is final, totalBaseAmount equals it, totalPremiumAmount is 0, optional payCalculation is null/absent, and no snapshot is backfilled or salary recalculated
- [x] Add regression tests for earliest-first static break placement, dynamic pauses, late join payableStartTime, discard, cancellation, and privacy
- [x] Add tests for historical policy snapshot/version immutability
- [x] Add acceptance tests that legacy summary and payout fallback totals/basis remain consistent
- [x] Add acceptance tests that corrupt applied-rule JSON is explicit `UNAVAILABLE` with `appliedRules: null`, never empty rules
- [x] Add acceptance tests for a one-second or other sub-minute premium segment, no independent segment currency rounding, exact persisted header-to-segment audit identities, once-only final calculatedSalary rounding from header total, and payout using that stored final salary
- [x] Add production close-flow tests for premium calculation, frozen policy immutability, daily/weekly overtime, pause/static-break placement, DST, payout integration, and privacy
- [x] Add acceptance scenario tests A-I from SPEC/API against production close salary behavior
- [x] Update OpenAPI/Swagger docs for pay breakdown DTOs after implementation

Phase 2C backend follow-up:

- [x] Enforce role-aware payCalculation omission for `GET /api/v1/shifts/{shiftId}/attendance` and `GET /api/v1/me/shifts`, and add privacy (including ADMIN omission), finalized-state, legacy-absence, and UNAVAILABLE snapshot tests

Phase 2D - Mobile pay rules and breakdown UI:

- [x] Add pay policy API client methods and TypeScript DTOs
- [x] Add Foreman Pay Rules settings screen
- [x] Add policy API integration for load/save/version display
- [x] Add stacking strategy segmented control for ADD/HIGHEST_ONLY
- [x] Add enable/disable toggles and percentage inputs for premium rules
- [x] Add TIME_OF_DAY start/end inputs
- [x] Add DAILY_OVERTIME and WEEKLY_OVERTIME threshold inputs
- [x] Add DAY_OF_WEEK multi-select
- [x] Add manual HOLIDAY local date list with optional labels
- [x] Add pay policy loading, validation, error, and save states
- [x] Display read-only worker pay breakdown after close for own attendance
- [x] Display foreman-managed worker premium breakdown in summary/detail views
- [x] Keep payroll cards limited to raw payable time, final payout amount, status, and selected days/items
- [x] Ensure mobile does not calculate premium pay, overtime, effective rates, rule matches, payroll totals, or pay breakdown totals
- [x] Prevent stale overlapping `ForemanShiftDetailsScreen` loads from rendering an older attendance/payCalculation response
- [x] Align mobile payroll DTOs with required totalBaseAmount and totalPremiumAmount fields without expanding payroll-card presentation

Future hardening:

- [ ] Add batch recalculation/reopening of affected closed pay calculations when out-of-order shift closure would change overtime allocation

## Milestone 6.5: Backend API Contract Stabilization

- [x] Implement worker shift history endpoint
- [x] Implement foreman/admin shift summary endpoint
- [x] Document implemented backend API contract
- [x] Add backend local run instructions
- [x] Add Swagger/OpenAPI documentation for backend MVP
- [x] Decide whether managed foreman-created shifts should appear in a separate foreman history endpoint
- [x] Decide whether ADMIN user management is needed before or after mobile MVP

Decisions:

- Managed foreman-created shifts should use a separate endpoint. `GET /api/v1/me/shifts` remains worker attendance history only.
- Planned endpoint: `GET /api/v1/me/managed-shifts`.
- ADMIN user management is deferred until after the mobile MVP and should be implemented as part of the Vaadin admin dashboard work.

Follow-up backend tasks:

- [x] Implement `GET /api/v1/me/managed-shifts` for the Foreman mobile dashboard
- [x] Implement company creation
- [x] Implement company join by code
- [x] Enforce company membership before worker joins shift
- [x] Attach shifts to foreman company
- [x] Remove Default Company fallback for real MVP shifts
- [x] Remove planned time inputs from create shift API/mobile contract
- [x] Generate shift title automatically from date/time and company name
- [x] Add `foremanHourlyRate` to shift creation and ShiftSession
- [x] Calculate private foreman salary on close and summary
- [x] Keep foreman salary separate from worker attendance; do not create ShiftAttendance for foreman salary
- [x] Implement shift cancel endpoint and lifecycle rules
- [x] Make `defaultBreakMinutes` optional and default it to 0
- [x] Implement pause system for active shifts
- [x] Allow late worker join/approval for ACTIVE shifts with payable-start salary calculation
- [ ] Set default JWT expiration to 8 hours

Follow-up mobile tasks:

- [x] Add foreman company onboarding
- [x] Add worker company join
- [x] Show company name in dashboards/menu
- [x] Update `CreateShiftScreen` after backend create-shift contract changes
- [x] Update shift details to show generated title, backend actual times, and owner-foreman rate visibility
- [x] Update summary screen to show worker summary plus private owner-foreman salary fields
- [x] Implement shift cancel UI after backend endpoint is ready
- [x] Make `defaultBreakMinutes` optional and default it to 0 in mobile forms
- [x] Implement pause UI and API client calls using backend pause endpoints
- [x] Update join/approval UI copy for ACTIVE late joins and backend `payableStartTime`

## Milestone 7: Mobile Foundation

- [x] Add mobile MVP UX plan
- [x] Create React Native / Expo project in `mobile/`
- [x] Add TypeScript
- [x] Add navigation
- [x] Add API client structure
- [x] Add environment configuration
- [x] Create login screen
- [x] Create register screen

## Milestone 8: Mobile MVP Screens

- [x] Worker dashboard
- [x] Foreman dashboard
- [x] Join shift screen
- [x] Create shift screen
- [x] Shift details screen
- [x] Shift summary screen
- [x] My shift history screen

## Milestone 9: Infrastructure

- [x] Add Docker Compose for PostgreSQL
- [ ] Add backend Dockerfile
- [x] Add local development compose file
- [x] Add README instructions for running locally

## Milestone 10: Web Admin

This is optional for first MVP.

Admin dashboard is planned as Vaadin UI inside the backend Spring Boot application.
A separate `web-admin/` project is no longer planned for the MVP.

- [ ] Add Vaadin dependency to `backend/`
- [ ] Configure Vaadin routes and ADMIN role security
- [ ] Create admin layout
- [ ] Add admin login/access behavior if needed
- [ ] Add users admin view
- [ ] Implement ADMIN user management after mobile MVP
- [ ] Add shifts admin view
- [ ] Add reports/admin summary view
