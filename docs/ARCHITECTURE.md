# ShiftPay Architecture

## 1. Overview

ShiftPay is planned as a monorepo with these main areas:

backend/      Spring Boot REST API and Vaadin admin UI
mobile/       React Native / Expo app
webadmin/     Historical or placeholder admin directory; not planned as a separate MVP frontend
infra/        Docker and deployment files
docs/         Documentation

2. Backend Architecture

The backend is responsible for:

authentication
authorization
user management
shift sessions
attendance
salary calculation
reports
admin dashboard served with Vaadin

Recommended backend layers:

controller/
service/
repository/
entity/
dto/
mapper/
security/
exception/
config/
Controllers

Controllers should only handle HTTP requests and responses.

They should not contain business logic.

Services

Services contain business logic.

Examples:

AuthService
CompanyService
ShiftService
AttendanceService
SalaryCalculationService
Repositories

Repositories handle database access.

Entities

Entities represent database tables.

DTOs

DTOs are used for API requests and responses.

Do not expose entities directly through the API.

Admin UI Architecture

- Vaadin runs in the same Spring Boot application as the backend REST API.
- The admin dashboard is implemented as Vaadin routes, layouts, and views inside `backend/`.
- Admin UI shares backend services and repositories.
- REST API remains the contract for mobile clients.
- Admin UI should not duplicate business logic.
- Controllers are for REST/mobile API endpoints.
- Vaadin views call services directly or use dedicated admin application services for UI-specific workflows.
- Core business rules stay in backend services and remain testable outside Vaadin views.
- Security must protect Vaadin routes by the ADMIN role.
- Admin UI changes that alter services, API behavior, security, or business rules must update docs and tests.

3. Main Backend Entities
User

Fields:

id
email
passwordHash
firstName
lastName
role
createdAt
updatedAt
Company

Fields:

id
name
joinCode
ownerForemanId
createdAt
updatedAt

CompanyMembership

Fields:

id
companyId
userId
role
joinedAt
createdAt
updatedAt
ShiftSession

Fields:

id
companyId
title
location
joinCode
status
actualStartTime
actualEndTime
defaultBreakMinutes
defaultHourlyRate
foremanHourlyRate
foremanWorkedMinutes
foremanPauseMinutes
foremanCalculatedSalary
createdBy
createdAt
updatedAt

ShiftPauseInterval

Fields:

id
shiftSessionId
scope
userId
startedAt
endedAt
createdAt
updatedAt

Company Ownership and Membership

- Company onboarding is part of the mobile MVP.
- FOREMAN creates a company after registration if they do not already have one.
- FOREMAN must have a company before creating or starting shifts.
- The backend must not use Default Company for real MVP shifts.
- Company has a backend-generated joinCode.
- WORKER joins a company by company join code.
- WORKER can join a shift only if they are already a member of that shift's company.
- ShiftSession.companyId is required for real MVP shifts.
- Company name is exposed in current-user, shift, managed-shift, and worker-history DTOs where useful for mobile dashboards and menus.
- ADMIN user management remains deferred until after the mobile MVP and should be implemented in Vaadin.
- The mobile MVP should not add an ADMIN flow.

Shift Creation

- For the mobile MVP, ShiftSession creation does not require plannedStartTime or plannedEndTime.
- The foreman does not enter planned start or planned end times in mobile.
- The foreman does not manually enter title in mobile.
- The backend generates ShiftSession.title automatically from date/time and the real company name.
- Example generated title format: `Tuesday 10:00 - Acme Construction`.
- Exact locale and format can be refined during implementation.
- actualStartTime is set by the backend when the foreman starts the shift.
- actualEndTime is set by the backend when the foreman closes the shift.
- Shift creation keeps optional location, defaultBreakMinutes, defaultHourlyRate, and foremanHourlyRate.
- defaultBreakMinutes is optional and defaults to 0 when omitted.
- Dynamic pause tracking is separate from defaultBreakMinutes and is available only while the shift is ACTIVE.

Shift Cancellation

- ShiftSession status includes CANCELLED for shifts cancelled before start.
- Owner FOREMAN can cancel only their own OPEN shift before it starts.
- ADMIN cannot cancel shifts through the REST/mobile API.
- CANCELLED shifts do not calculate salary.
- CANCELLED shifts cannot be started, closed, joined by workers, or summarized.
- Cancel does not write actualStartTime, actualEndTime, foremanWorkedMinutes, or foremanCalculatedSalary.
- Worker history can include CANCELLED shifts/status.

Hourly Rate Ownership

- WORKER does not provide or modify hourly rates.
- FOREMAN sets defaultHourlyRate when creating an owned shift.
- FOREMAN sets foremanHourlyRate when creating an owned shift.
- ADMIN cannot create shifts or set defaultHourlyRate through the REST/mobile API.
- ShiftAttendance.hourlyRate is copied from ShiftSession.defaultHourlyRate when a worker joins.
- ShiftAttendance.hourlyRate is a snapshot for that worker and shift, so later shift-rate changes do not rewrite historical attendance.
- FOREMAN can override ShiftAttendance.hourlyRate while approving attendance for an owned OPEN shift.
- ADMIN can override ShiftAttendance.hourlyRate while approving attendance for any OPEN shift.
- Approval without an override preserves the join-time attendance rate snapshot.
- An attendance-specific override does not modify ShiftSession.defaultHourlyRate or other attendance records.
- ShiftSession.foremanHourlyRate is private to the owner FOREMAN in the REST/mobile MVP.
- WORKER DTOs never expose ShiftSession.foremanHourlyRate.
- ADMIN REST/mobile DTOs do not expose ShiftSession.foremanHourlyRate for the MVP; future ADMIN/Vaadin visibility can be decided later.
ShiftAttendance

Fields:

id
shiftSessionId
workerId
status
hourlyRate
breakMinutes
pauseMinutes
workedMinutes
calculatedSalary
joinedAt
approvedAt
createdAt
updatedAt

Attendance Approval

- The approval endpoint is available only to FOREMAN and ADMIN.
- FOREMAN ownership is enforced in the service layer against ShiftSession.createdBy.
- FOREMAN access is scoped to shifts in their company.
- Attendance is loaded by both attendance id and shift session id, so a URL shift mismatch is returned as not found.
- Approval is allowed only while the shift is OPEN.
- The only allowed approval transition is JOINED -> APPROVED.
- approvedAt is recorded using the current server time in UTC.
- The optional hourly-rate override uses BigDecimal and is limited to non-negative values with two decimal places.

Attendance Query

- FOREMAN can list attendance only for an owned shift; ADMIN can list attendance for any shift.
- Attendance can be listed for OPEN, ACTIVE, CLOSED, and CANCELLED shifts.
- The repository fetches attendance and worker in one query to avoid N+1 loading.
- Results are ordered by joinedAt ascending and then attendance id ascending.
- Controllers return attendance DTOs and never expose User entities or password hashes.
- Attendance DTOs expose pauseState, pauseMinutes, workedMinutes, and calculatedSalary so active pause state and close-time salary results can be read without a summary endpoint.

Worker Shift History

- GET /api/v1/me/shifts is available to any authenticated user.
- The endpoint always filters by the current user's worker attendance records.
- WORKER, FOREMAN, and ADMIN all see only attendance where ShiftAttendance.worker.id equals the current user id.
- FOREMAN and ADMIN do not receive managed-shift attendance through this endpoint unless they also have their own attendance record.
- OPEN, ACTIVE, CLOSED, and CANCELLED shifts are included.
- The endpoint reads persisted workedMinutes and calculatedSalary from ShiftAttendance and never recalculates salary.
- OPEN, ACTIVE, CANCELLED, and unapproved attendance can return null workedMinutes and calculatedSalary.
- The repository fetches attendance with shift in one query to avoid N+1 loading.
- Results are ordered by joinedAt descending and then attendance id descending.
- DTOs expose shift and attendance fields only, never User entities, emails, password hashes, foremanHourlyRate, foremanWorkedMinutes, foremanPauseMinutes, or foremanSalary.
- DTOs include company name, pauseState for active shift display, and persisted pauseMinutes after close-time salary calculation.

Foreman Managed Shifts

- Foreman-created shift lists should not be mixed into worker attendance history.
- `GET /api/v1/me/shifts` remains personal worker attendance history.
- `GET /api/v1/me/managed-shifts` supports the Foreman mobile dashboard.
- The endpoint is available only to FOREMAN and ADMIN.
- WORKER receives 403 Forbidden.
- FOREMAN sees shifts where ShiftSession.createdBy equals the current user id.
- FOREMAN managed-shift DTOs include companyId and companyName.
- ADMIN can call the endpoint and sees shifts where ShiftSession.createdBy equals the current user id. Because ADMIN cannot create shifts through the REST/mobile API, this is normally empty for admins. Full admin listing is deferred to Vaadin admin UI.
- The endpoint reuses ShiftSession service/repository logic and does not recalculate salary.
- Results are ordered by createdAt descending and shift id descending.
- Response DTOs expose shift/session fields needed by the mobile dashboard and do not expose User entities, password hashes, company entity, createdAt, or updatedAt.
- Response DTOs include pauseState for the foreman's own personal pause plus any all-participant pause.
- foremanHourlyRate is included only for the owner FOREMAN in the REST/mobile MVP.
- ADMIN responses do not include foremanHourlyRate or foreman salary fields.

Admin User Management

- ADMIN role and role-based authorization remain supported in the backend.
- Public registration must continue to reject ADMIN accounts.
- Full ADMIN user management is deferred until after the mobile MVP.
- User management should be implemented through the Vaadin admin dashboard rather than mobile screens.
- Vaadin admin user management must keep business logic in services and protect routes by ADMIN role.

Salary Calculation

- SalaryCalculationService owns worked-minute and salary math.
- ShiftSessionService.closeShift invokes SalaryCalculationService after locking the ShiftSession and before setting status CLOSED.
- Close locks all attendance rows for the shift with PESSIMISTIC_WRITE after locking the ShiftSession.
- Worker salary is calculated only for APPROVED attendance.
- JOINED, REJECTED, and CANCELLED attendance keep workedMinutes and calculatedSalary null.
- workedMinutes = minutes_between(actualStartTime, actualEndTime) - attendance.breakMinutes - attendance.pauseMinutes.
- calculatedSalary = workedMinutes / 60 * attendance.hourlyRate.
- calculatedSalary is stored with scale 2 and RoundingMode.HALF_UP.
- attendance.pauseMinutes is calculated from the union of all-pause intervals and the worker's personal pause intervals.
- Salary uses ShiftAttendance.hourlyRate, including any attendance-specific approval override.
- Foreman salary is calculated separately from worker attendance.
- The backend must not create a ShiftAttendance row for foreman salary.
- Foreman salary uses ShiftSession.foremanHourlyRate.
- foremanWorkedMinutes = minutes_between(actualStartTime, actualEndTime) - ShiftSession.defaultBreakMinutes - ShiftSession.foremanPauseMinutes.
- foremanPauseMinutes is calculated from the union of all-pause intervals and the foreman's personal pause intervals.
- foremanSalary = foremanWorkedMinutes / 60 * ShiftSession.foremanHourlyRate.
- foremanSalary is stored or returned with scale 2 and RoundingMode.HALF_UP.
- Static defaultBreakMinutes is optional and defaults to 0.
- Dynamic pauses are separate from defaultBreakMinutes.
- CANCELLED shifts do not calculate salary.
- No client should calculate worker or foreman salary.
- Close fails with 409 if actualStartTime is missing, an attendance breakMinutes is greater than shift duration, ShiftSession.defaultBreakMinutes is greater than shift duration, or break plus effective pause minutes are greater than shift duration.
- Close is transactional: when salary validation fails, the shift remains ACTIVE and attendance salary fields are not written.

Pause System

- Pause tracking is implemented for ACTIVE shifts.
- Pause is separate from static defaultBreakMinutes.
- WORKER can start and stop pause only for themselves.
- FOREMAN can start and stop self pause on their own active shift.
- FOREMAN can start and stop global pause for everyone on their own active shift.
- ADMIN cannot pause through the REST/mobile API.
- Pause endpoints are `POST /api/v1/shifts/{shiftId}/pauses/me/start`, `POST /api/v1/shifts/{shiftId}/pauses/me/end`, `POST /api/v1/shifts/{shiftId}/pauses/all/start`, and `POST /api/v1/shifts/{shiftId}/pauses/all/end`.
- Pause start/end returns 409 unless the shift status is ACTIVE.
- Duplicate active pause start for the same target/scope returns 409.
- Ending a pause with no active interval for that target/scope returns 409.
- ShiftPauseInterval stores shift, scope, user for PERSONAL pauses, startedAt, and endedAt.
- ALL pause intervals have no user and affect every paid participant on the shift.
- Pause status must be visible in mobile dashboards and details.
- Worker views show whether the worker is paused or global pause is active.
- Foreman views show global pause status, foreman self pause status, and worker pause status.
- Close auto-ends active pause intervals at actualEndTime before salary calculation.
- Salary calculation merges all applicable pause intervals as a union to avoid double-counting overlaps.
- Salary calculation consumes backend pause data; clients never calculate pause-adjusted salary.

Shift Summary

- ShiftSessionService owns summary business rules.
- Summary is available only for CLOSED shifts.
- FOREMAN can get summary only for a shift they created.
- ADMIN can get worker summary for any shift.
- Summary reads persisted ShiftAttendance.workedMinutes and ShiftAttendance.calculatedSalary.
- Summary does not recalculate worker or foreman salary.
- Summary includes only APPROVED attendance.
- Summary is not available for CANCELLED shifts.
- The repository fetches approved attendance with worker in one query to avoid N+1 loading.
- Workers are ordered by worker lastName, firstName, and worker id.
- totalWorkers is the count of included attendance rows.
- totalSalary is the sum of included worker calculatedSalary values with scale 2.
- If approved attendance is missing workedMinutes or calculatedSalary, summary returns a conflict.
- Summary DTOs expose worker identity fields but never expose User entities or password hashes.
- Worker summary remains based on approved ShiftAttendance rows.
- Worker summary exposes pauseMinutes for approved closed attendance.
- Foreman private salary fields are separate from worker rows: foremanWorkedMinutes, foremanPauseMinutes, foremanHourlyRate, and foremanSalary.
- Foreman salary fields are returned only to the owner FOREMAN.
- WORKER never receives foreman salary fields.
- ADMIN REST/mobile MVP does not receive foreman salary fields; future ADMIN/Vaadin visibility can be decided later.

Concurrency Control

- Company creation, company join, shift join, start, cancel, close, approval, and pause start/end run inside transactions with pessimistic write locks where state can change concurrently.
- ShiftSession is locked by id for start, cancel, close, and approval.
- ShiftSession is locked by joinCode for worker join.
- ShiftAttendance is locked by attendance id and shift id for approval.
- ShiftAttendance is locked by shift id during close before salary fields are updated.
- ShiftPauseInterval rows are locked during close before active intervals are auto-ended and salary deductions are calculated.
- Operations that require both rows always lock ShiftSession first and ShiftAttendance second.
- Concurrent approvals serialize so only the first JOINED -> APPROVED transition succeeds.
- Start serializes with join and approval, preventing either operation from succeeding after the shift becomes ACTIVE.
- Cancel serializes with join, approval, start, and close, preventing worker joins and lifecycle transitions after the shift becomes CANCELLED.
- Close serializes concurrent lifecycle transitions and prevents duplicate successful close operations.
- Pause start/end locks ShiftSession first and then active pause intervals so pause operations serialize with close and lifecycle state changes.

4. Database

Use PostgreSQL.

Use Flyway for database migrations.

Do not manually change database schema without Flyway migration.

Migration files should be placed in:

backend/src/main/resources/db/migration/

Example:

V1__create_users_table.sql
V2__create_shift_sessions_table.sql

5. Authentication

Use JWT authentication.

Login flow:

User sends email and password.
Backend validates credentials.
Backend returns JWT token.
Mobile app stores token securely.
Mobile app sends token in Authorization header.
JWT expiration remains enabled.
Default MVP JWT/session lifetime should be 8 hours.
Mobile restores a stored session by calling GET /api/v1/users/me.
Future biometric unlock or refresh-token/long-lived session support can be added later.

Header:

Authorization: Bearer <token>

6. Authorization

Roles:

WORKER
FOREMAN
ADMIN

Authorization rules:

WORKER:
- own profile
- join company
- own shifts
- join shift
- pause/resume self on ACTIVE shifts they joined in their company

FOREMAN:
- create own company
- create shift
- manage own shifts
- approve attendance
- cancel own OPEN shifts before start
- pause/resume self and global pause on own ACTIVE shifts
- see shift summaries

ADMIN:
- read shift detail, list/approve attendance, and read worker-only shift summaries through REST where implemented
- no REST/mobile shift create/start/close/cancel/pause access
- user management after mobile MVP through Vaadin
- no mobile admin flow

7. Mobile Architecture

The mobile app should use:

React Native
Expo
TypeScript

Recommended structure:

mobile/
  src/
    api/
    screens/
    components/
    navigation/
    store/
    types/
    utils/
API Layer

All backend calls should be inside:

src/api/

Do not call fetch directly from screen components.

Screens

Basic MVP screens:

LoginScreen
RegisterScreen
WorkerDashboardScreen
ForemanDashboardScreen
JoinShiftScreen
CreateShiftScreen
ShiftDetailsScreen
ShiftSummaryScreen

8. Infrastructure

Use Docker Compose for local development.

Main services:

postgres
backend

Mobile app can connect to local backend during development.

Deployment model:

- Build and deploy one backend artifact/container that contains both the REST API and Vaadin admin UI.
- PostgreSQL remains a separate service.
- Mobile app continues to consume the REST API.
- The admin dashboard is served by the backend application; no separate web-admin frontend artifact is planned for the MVP.

9. Development Workflow with Codex

Recommended agents:

Root Codex session:
- architecture
- documentation
- task planning

Backend Codex session:
- Spring Boot backend and Vaadin admin UI

Mobile Codex session:
- React Native app

Infra Codex session:
- Docker and deployment

Review Codex session:
- security review
- API review
- test coverage review

10. Important Rule

The backend API is the contract between backend and mobile.

Whenever backend API changes, update:

docs/API.md
mobile API client
backend tests
