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
- [ ] Add payroll rounding service: ceil raw payable minutes to 15-minute intervals and round item payout amount up to whole money units
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
- [ ] Display backend `paymentStatus`, `payoutRoundedMinutes`, `calculatedSalary`, and whole-number `payoutAmount`
- [ ] Ensure mobile formats time only and does not calculate or sum salary, rounded payroll minutes, payout amounts, or selected totals

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
