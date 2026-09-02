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

- [ ] Add `DISCARDED` ShiftStatus for active short shifts the foreman chooses not to save
- [ ] Update close shift to return `SHORT_SHIFT_REQUIRES_DECISION` when backend actual duration is 0 or less than 15 minutes and `saveShortShift` is not true
- [ ] Support close shift request body `{ "saveShortShift": true }` so the foreman can explicitly save a short shift
- [ ] Add `POST /api/v1/shifts/{shiftId}/discard` for owner FOREMAN to discard ACTIVE shifts whose backend actual duration is 0 or less than 15 minutes
- [ ] Persist discardedAt, discardedBy, discardReason, and audit actualEndTime for DISCARDED shifts
- [ ] Ensure DISCARDED shifts do not calculate salary, initialize payroll, appear as payable attendance, or return shift summary
- [ ] Add lifecycle tests for short close warning, explicit save, discard, non-owner/role rejection, non-short discard conflict, pause auto-end audit behavior, and payroll exclusion

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

- [ ] Add attendance payment status: UNPAID, PAYMENT_REQUESTED, PAID
- [ ] Initialize APPROVED CLOSED attendance as UNPAID during close flow
- [ ] Add payout_requests table/entity with worker, company, manager foreman, status, totals, requestedAt, approvedAt, paidAt
- [ ] Add payout_request_items table/entity with attendance snapshots, exact amount, rounded minutes, whole-number payout amount, and paidAt
- [ ] Add payroll rounding service: round raw payable minutes to nearest 5 minutes with half-up midpoint behavior and round item payout amount up to whole money units
- [ ] Implement `GET /api/v1/me/payable-attendances`
- [ ] Implement `POST /api/v1/me/payout-requests/preview`
- [ ] Implement `POST /api/v1/me/payout-requests`
- [ ] Implement `GET /api/v1/me/payout-requests`
- [ ] Implement `GET /api/v1/me/managed-payout-requests`
- [ ] Implement `POST /api/v1/me/managed-payout-requests/{requestId}/approve`
- [ ] Enforce worker ownership, company scope, CLOSED shift, APPROVED attendance, UNPAID payment status, and same-manager-foreman request validation
- [ ] Reject duplicate attendanceIds with 400 Bad Request for preview and create
- [ ] Prevent PAID or PAYMENT_REQUESTED attendance from being added to a new pending request
- [ ] Enforce foreman approval only for own company and own managed shifts
- [ ] Add transactional locking for payout request creation and approval
- [ ] Add backend tests for payroll authorization, conflicts, transactional status updates, privacy, and rounding edge cases
- [ ] Update OpenAPI/Swagger docs for payroll endpoints after implementation

Mobile tasks:

- [ ] Add payroll API client methods and TypeScript DTOs
- [ ] Add Worker Payroll screen with selectable CLOSED unpaid attendance days
- [ ] Add backend preview call for selected payout totals
- [ ] Add payout request creation flow using explicit attendanceIds
- [ ] Show worker payout request history with PENDING and APPROVED status badges
- [ ] Add Foreman Payroll Requests screen for pending/approved requests
- [ ] Add foreman approve action and refresh behavior
- [ ] Display backend `paymentStatus`, raw payable time, and whole-number `payoutAmount` on payroll cards
- [ ] Hide `payoutRoundedMinutes` and exact calculated amount on payout request cards unless a later detailed audit view is added
- [ ] Ensure mobile formats time only and does not calculate or sum salary, rounded payroll minutes, payout amounts, or selected totals
- [ ] Add short-shift close decision flow: handle `SHORT_SHIFT_REQUIRES_DECISION`, save with `{ "saveShortShift": true }`, or call discard

## Milestone 6.2: Configurable Pay Rules / Premium Pay

Phase dependencies:

- Phase 1 must finish and pass review before Phase 2A starts.
- Phase 2A must finish and pass review before Phase 2B starts.
- Phase 2B must finish and pass review before Phase 2C starts.
- Phase 2C backend work must finish and pass review before Phase 2D starts.
- Backend/mobile agents must not redefine business rules. If a phase exposes a spec gap, report "docs change required".

Phase 1 - Pay policy configuration foundation:

- [ ] Add Company.timeZone with IANA timezone validation and configured backend timezone default for existing companies
- [ ] Add default/current PayPolicy initialization for every company after creation and migration
- [ ] Add PayPolicy/PayPolicyVersion and PayPolicyRule migrations/entities
- [ ] Store PayPolicy as immutable company-owned versions; updating policy creates a new version and does not mutate old versions
- [ ] Add active/default policy initialization with weekStartsOn MONDAY, stackingStrategy ADD, no default premium percentages, and migration/onboarding backfill for companies missing a current policy
- [ ] Add PayPolicy rule persistence
- [ ] Add PayPolicy validation for rule condition configs, premiumPercent 0.0000..1000.0000 with max scale 4, time ranges, overtime thresholds, weekdays, and manual holidays
- [ ] Implement `GET /api/v1/me/pay-policy`
- [ ] Implement `PUT /api/v1/me/pay-policy`
- [ ] Implement `GET /api/v1/me/pay-policy/versions` for audit if included in the backend scope
- [ ] Freeze current PayPolicyVersion id on ShiftSession at shift start and return PAY_POLICY_REQUIRED if the current policy invariant is broken
- [ ] Do not integrate premium calculation into closeShift in Phase 1
- [ ] Do not change calculatedSalary or payout behavior in Phase 1
- [ ] Update OpenAPI/Swagger docs for pay policy endpoints after implementation

Phase 2A - Premium calculation foundation, no production salary change:

- [ ] Add internal premium calculation service
- [ ] Add explainable PayCalculation/PaySegment result objects without production persistence
- [ ] Implement TIME_OF_DAY rule evaluation
- [ ] Implement DAY_OF_WEEK rule evaluation
- [ ] Implement HOLIDAY rule evaluation
- [ ] Implement ADD and HIGHEST_ONLY stacking strategies through PayPolicy.stackingStrategy
- [ ] Build segmentation for payable interval start/end, company timezone day boundaries, midnight, TIME_OF_DAY boundaries, DAY_OF_WEEK boundaries, HOLIDAY boundaries, and DST-safe real instants/durations
- [ ] Add unit tests for acceptance scenarios A, B, C, F, G, and H from SPEC/API
- [ ] Add unit tests for holiday and day-of-week rule evaluation
- [ ] Do not integrate the premium calculation service with closeShift in Phase 2A
- [ ] Do not change calculatedSalary or payout behavior in Phase 2A

Phase 2B - Overtime calculation context:

- [ ] Implement DAILY_OVERTIME rule evaluation
- [ ] Implement WEEKLY_OVERTIME rule evaluation
- [ ] Add previous finalized payable intervals context for the same worker/company and policy timezone period
- [ ] Use frozen policy version plus previous finalized payable minutes for MVP overtime context when closing a shift
- [ ] Implement deterministic chronological overtime allocation by company/policy timezone payable interval order
- [ ] Tie-break chronological allocation by shift actualStartTime, then attendance/payableStartTime, then stable database id
- [ ] Document and test MVP chronological-close limitation for overtime allocation; teams should close shifts chronologically until batch recalculation exists
- [ ] Add tests for acceptance scenarios D and E from SPEC/API
- [ ] Add tests for weekly overtime boundary behavior
- [ ] Do not integrate overtime premium calculation into production closeShift in Phase 2B unless the phase is explicitly promoted to Phase 2C
- [ ] Do not change calculatedSalary or payout behavior in Phase 2B unless the phase is explicitly promoted to Phase 2C

Phase 2C - Production salary integration and persisted breakdown:

- [ ] Add PayCalculation and PaySegment persistence/snapshot model
- [ ] Integrate premium calculation into closeShift using the frozen PayPolicyVersion
- [ ] Make worker calculatedSalary the premium-included worker total for approved attendance
- [ ] Persist calculation breakdown/snapshot data needed to explain historical calculations after policy changes
- [ ] Keep foreman premium pay deferred; foreman salary remains separate and base-rate only
- [ ] Ensure CANCELLED/DISCARDED shifts remain non-payable and excluded from premium/payroll calculations
- [ ] Ensure short saved CLOSED shifts can persist zero payable, premium, and total amounts
- [ ] Expose worker pay breakdown in shift summary for owner FOREMAN
- [ ] Expose own read-only pay breakdown in worker history/details after close
- [ ] Expose premium totals/breakdown in payout/payable detailed DTOs according to API docs while keeping mobile cards simple
- [ ] Ensure payout requests use stored premium-included salary and backend-owned payout fields
- [ ] Add regression tests for static breaks, dynamic pauses, late join payableStartTime, discard, cancellation, and privacy
- [ ] Add tests for historical policy snapshot/version immutability
- [ ] Add acceptance scenario tests A-I from SPEC/API against production close salary behavior
- [ ] Update OpenAPI/Swagger docs for pay breakdown DTOs after implementation

Phase 2D - Mobile pay rules and breakdown UI:

- [ ] Add pay policy API client methods and TypeScript DTOs
- [ ] Add Foreman Pay Rules settings screen
- [ ] Add policy API integration for load/save/version display
- [ ] Add stacking strategy segmented control for ADD/HIGHEST_ONLY
- [ ] Add enable/disable toggles and percentage inputs for premium rules
- [ ] Add TIME_OF_DAY start/end inputs
- [ ] Add DAILY_OVERTIME and WEEKLY_OVERTIME threshold inputs
- [ ] Add DAY_OF_WEEK multi-select
- [ ] Add manual HOLIDAY local date list with optional labels
- [ ] Add pay policy loading, validation, error, and save states
- [ ] Display read-only worker pay breakdown after close for own attendance
- [ ] Display foreman-managed worker premium breakdown in summary/detail views
- [ ] Keep payroll cards limited to raw payable time, final payout amount, status, and selected days/items
- [ ] Ensure mobile does not calculate premium pay, overtime, effective rates, rule matches, payroll totals, or pay breakdown totals

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
- [ ] Remove planned time inputs from create shift API/mobile contract
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
- [ ] Add local development compose file
- [ ] Add README instructions for running locally

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
