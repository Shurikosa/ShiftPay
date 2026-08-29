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
payroll request workflow
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
PauseService
SalaryCalculationService
PayrollRoundingService
PayoutRequestService
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
- FOREMAN can override ShiftAttendance.hourlyRate while approving attendance for an owned OPEN or ACTIVE shift.
- ADMIN can override ShiftAttendance.hourlyRate while approving attendance for any OPEN or ACTIVE shift.
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
paymentStatus
paidAt
joinedAt
approvedAt
payableStartTime
createdAt
updatedAt

PayoutRequest

Fields:

id
companyId
workerId
managerForemanId
status
rawPayableMinutesTotal
payoutRoundedMinutesTotal
exactCalculatedAmountTotal
payoutAmount
requestedAt
approvedBy
approvedAt
paidAt
createdAt
updatedAt

PayoutRequestItem

Fields:

id
payoutRequestId
attendanceId
shiftSessionId
rawPayableMinutes
payoutRoundedMinutes
hourlyRate
calculatedSalary
roundedItemAmountExact
payoutAmount
createdAt
paidAt

Attendance Approval

- The approval endpoint is available only to FOREMAN and ADMIN.
- FOREMAN ownership is enforced in the service layer against ShiftSession.createdBy.
- FOREMAN access is scoped to shifts in their company.
- Attendance is loaded by both attendance id and shift session id, so a URL shift mismatch is returned as not found.
- Approval is allowed only while the shift is OPEN or ACTIVE.
- The only allowed approval transition is JOINED -> APPROVED.
- approvedAt is recorded using the current server time in UTC.
- payableStartTime is null for pre-start approvals and is set to approvedAt for ACTIVE-shift approvals.
- The optional hourly-rate override uses BigDecimal and is limited to non-negative values with two decimal places.

Attendance Query

- FOREMAN can list attendance only for an owned shift; ADMIN can list attendance for any shift.
- Attendance can be listed for OPEN, ACTIVE, CLOSED, and CANCELLED shifts.
- The repository fetches attendance and worker in one query to avoid N+1 loading.
- Results are ordered by joinedAt ascending and then attendance id ascending.
- Controllers return attendance DTOs and never expose User entities or password hashes.
- Attendance DTOs expose payableStartTime, pauseState, pauseMinutes, workedMinutes, and calculatedSalary so active pause state and close-time salary results can be read without a summary endpoint.
- Attendance DTOs expose paymentStatus where payroll status matters. Shift status and attendance approval status remain separate from payment status.

Worker Shift History

- GET /api/v1/me/shifts is available to any authenticated user.
- The endpoint always filters by the current user's worker attendance records.
- WORKER, FOREMAN, and ADMIN all see only attendance where ShiftAttendance.worker.id equals the current user id.
- FOREMAN and ADMIN do not receive managed-shift attendance through this endpoint unless they also have their own attendance record.
- OPEN, ACTIVE, CLOSED, and CANCELLED shifts are included.
- The endpoint reads persisted workedMinutes and calculatedSalary from ShiftAttendance and never recalculates salary.
- OPEN, ACTIVE, CANCELLED, and unapproved attendance can return null workedMinutes and calculatedSalary.
- CLOSED approved attendance exposes paymentStatus so the worker can distinguish UNPAID, PAYMENT_REQUESTED, and PAID.
- The repository fetches attendance with shift in one query to avoid N+1 loading.
- Results are ordered by joinedAt descending and then attendance id descending.
- DTOs expose shift and attendance fields only, never User entities, emails, password hashes, foremanHourlyRate, foremanWorkedMinutes, foremanPauseMinutes, or foremanSalary.
- DTOs include company name, payableStartTime, pauseState for active shift display, and persisted pauseMinutes after close-time salary calculation.

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
- For attendance approved before shift start, worker payable start is ShiftSession.actualStartTime.
- For attendance approved while the shift is ACTIVE, worker payable start is ShiftAttendance.payableStartTime/approvedAt.
- durationMinutes = minutes_between(worker payable start, actualEndTime).
- unpaidMinutes = attendance.breakMinutes + attendance.pauseMinutes.
- workedMinutes = max(0, durationMinutes - unpaidMinutes).
- calculatedSalary = workedMinutes / 60 * attendance.hourlyRate.
- calculatedSalary is stored with scale 2 and RoundingMode.HALF_UP.
- attendance.pauseMinutes is calculated from the union of all-pause intervals and the worker's personal pause intervals, clipped to the worker payable interval.
- Salary uses ShiftAttendance.hourlyRate, including any attendance-specific approval override.
- Foreman salary is calculated separately from worker attendance.
- The backend must not create a ShiftAttendance row for foreman salary.
- Foreman salary uses ShiftSession.foremanHourlyRate.
- foremanDurationMinutes = minutes_between(actualStartTime, actualEndTime).
- foremanUnpaidMinutes = ShiftSession.defaultBreakMinutes + ShiftSession.foremanPauseMinutes.
- foremanWorkedMinutes = max(0, foremanDurationMinutes - foremanUnpaidMinutes).
- foremanPauseMinutes is calculated from the union of all-pause intervals and the foreman's personal pause intervals.
- foremanSalary = foremanWorkedMinutes / 60 * ShiftSession.foremanHourlyRate.
- foremanSalary is stored or returned with scale 2 and RoundingMode.HALF_UP.
- Static defaultBreakMinutes is optional and defaults to 0.
- Dynamic pauses are separate from defaultBreakMinutes.
- Overlapping pause intervals must not be double-counted.
- Static break minutes, or static break plus effective pause minutes, that exceed the payable duration clamp paid minutes and
salary to zero for workers and the private foreman salary.
- CANCELLED shifts do not calculate salary.
- No client should calculate worker or foreman salary.
- Close fails with 409 if actualStartTime is missing or salary inputs are negative where request validation normally prevents
them.
- Close is transactional: when salary validation fails, the shift remains ACTIVE and attendance salary fields are not written.
- Close initializes approved worker attendance paymentStatus as UNPAID. It does not create payout requests.

Payroll Requests

- Payroll status is separate from ShiftSession.status. Do not add PAID or NOT_PAID to ShiftStatus.
- ShiftSession.status remains OPEN, ACTIVE, CLOSED, and CANCELLED.
- ShiftAttendance.paymentStatus values are UNPAID, PAYMENT_REQUESTED, and PAID.
- PayoutRequest.status values for the MVP are PENDING and APPROVED.
- REJECTED and CANCELLED are future statuses and should not be exposed without a later docs update.
- Worker payable attendance listing reads only the current worker's APPROVED attendance on CLOSED shifts with paymentStatus UNPAID.
- Payout request preview accepts explicit attendanceIds and returns the same total/item calculation shape as create without persistence.
- Preview uses the same validation and authorization as create, including duplicate attendanceIds returning 400 Bad Request.
- Preview does not insert PayoutRequest rows, does not insert PayoutRequestItem rows, and does not change ShiftAttendance.paymentStatus.
- Preview is non-binding. Create always revalidates and recalculates server-side before persisting.
- Mobile selected totals must come from preview responses and must not be summed or calculated locally.
- Payout request creation accepts explicit attendanceIds, matching the mobile checkbox/calendar selection model.
- Payout request creation rejects duplicate attendanceIds with 400 Bad Request. It must not silently de-duplicate IDs.
- Payout request creation locks selected ShiftAttendance rows with PESSIMISTIC_WRITE before validating and updating paymentStatus.
- Selected attendance must belong to the current worker, the worker's current company, CLOSED shifts, and APPROVED attendance.
- Selected attendance must have workedMinutes and calculatedSalary already persisted.
- Already PAID attendance cannot be requested again.
- PAYMENT_REQUESTED attendance cannot be included in another pending request.
- For the MVP, all selected attendance records in one payout request must belong to shifts created by the same foreman.
- On successful creation, PayoutRequest stores companyId, workerId, managerForemanId, PENDING status, requestedAt, total raw payable minutes, total rounded payable minutes, total exact calculated amount, and total whole-number payout amount.
- PayoutRequestItem snapshots attendanceId, shiftSessionId, rawPayableMinutes, payoutRoundedMinutes, hourlyRate, calculatedSalary, roundedItemAmountExact, and payoutAmount.
- Snapshot item fields preserve what the worker requested even if future shift or rate data changes.
- PayoutRequestService sets selected attendance paymentStatus to PAYMENT_REQUESTED in the same transaction that creates the request and items.
- Foreman managed payout listing returns only requests for the foreman's current company where managerForemanId equals the current user id.
- Foreman approval locks the PayoutRequest and its selected ShiftAttendance rows.
- Foreman can approve only PENDING requests where every selected attendance still has paymentStatus PAYMENT_REQUESTED.
- Approval sets PayoutRequest.status to APPROVED, approvedBy, approvedAt, paidAt, each item paidAt, and each selected ShiftAttendance.paymentStatus to PAID.
- For the MVP, paidAt equals approvedAt because approval is the payment-completion event.
- Future payment processing may separate approvedAt from paidAt.
- A database uniqueness constraint should prevent an attendance record from appearing in more than one payout request. If future reject/cancel re-request flows are added, replace this with a partial uniqueness rule for active request statuses.

Payroll Rounding

- PayrollRoundingService owns payout rounding and whole-number payout amount calculation.
- Backend is the source of truth for payroll rounding.
- Mobile must not calculate salary, rounded payable minutes, or payout amounts.
- rawPayableMinutes is ShiftAttendance.workedMinutes from the close flow.
- calculatedSalary remains the exact audit/display amount from rawPayableMinutes and hourlyRate, stored with scale 2 and RoundingMode.HALF_UP.
- payoutRoundedMinutes = ceil(rawPayableMinutes / 15) * 15.
- rawPayableMinutes 0 produces payoutRoundedMinutes 0.
- roundedItemAmountExact = payoutRoundedMinutes / 60 * hourlyRate.
- payoutAmount is whole-number money with no cents, calculated from roundedItemAmountExact using RoundingMode.CEILING.
- Because payout values are non-negative, CEILING rounds any fractional currency amount up to the next whole unit.
- Request totals are sums of item-level rawPayableMinutes, payoutRoundedMinutes, calculatedSalary, and payoutAmount.

Payroll Privacy

- Worker sees only own payroll data.
- Worker never receives foremanHourlyRate, foremanWorkedMinutes, foremanPauseMinutes, or foremanSalary.
- Foreman sees worker payout requests only for their company and managed shifts.
- Payroll DTOs must not expose User entities, password hashes, or unrelated company data.
- Foreman payroll DTOs expose worker identity fields, selected shifts/days, raw hours/minutes, exact calculated amount, rounded payable minutes, and whole-number payout amount needed to approve the request.

Pause System

- Pause tracking is implemented for ACTIVE shifts.
- Pause is separate from static defaultBreakMinutes.
- WORKER can start and stop pause only for themselves.
- WORKER personal pause requires approved attendance on the ACTIVE shift.
- FOREMAN can start and stop self pause on their own active shift.
- FOREMAN can start and stop global pause for everyone on their own active shift.
- ADMIN cannot pause through the REST/mobile API.
- Pause endpoints are `POST /api/v1/shifts/{shiftId}/pauses/me/start`, `POST /api/v1/shifts/{shiftId}/pauses/me/end`, `POST /api/v1/shifts/{shiftId}/pauses/all/start`, and `POST /api/v1/shifts/{shiftId}/pauses/all/end`.
- Pause start/end returns 409 unless the shift status is ACTIVE.
- Duplicate active pause start for the same target/scope returns 409.
- Ending a pause with no active interval for that target/scope returns 409.
- ShiftPauseInterval stores shift, scope, user for PERSONAL pauses, startedAt, and endedAt.
- ALL pause intervals have no user and affect every paid participant on the shift.
- ALL pause intervals affect late workers only from their payable start onward.
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
- Start serializes with join and approval; operations that observe ACTIVE status can still create late joins or approve pending attendance under the ACTIVE rules.
- Cancel serializes with join, approval, start, and close, preventing worker joins and lifecycle transitions after the shift becomes CANCELLED.
- Close serializes concurrent lifecycle transitions and prevents duplicate successful close operations.
- Pause start/end locks ShiftSession first and then active pause intervals so pause operations serialize with close and lifecycle state changes.
- Payout request preview does not persist changes but still validates against current attendance state.
- Payout request creation locks selected ShiftAttendance rows before inserting request items and setting paymentStatus to PAYMENT_REQUESTED.
- Payout request approval locks PayoutRequest first and selected ShiftAttendance rows second before setting paymentStatus to PAID.
- Concurrent payout request creation for the same attendance serializes so only the first request succeeds.
- Concurrent approval for the same payout request serializes so only the first PENDING -> APPROVED transition succeeds.

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
- join OPEN shifts and ACTIVE shifts in their company
- pause/resume self on ACTIVE shifts where they have approved attendance
- list own payable CLOSED attendance
- create payout requests for own CLOSED, APPROVED, UNPAID attendance
- list own payout requests

FOREMAN:
- create own company
- create shift
- manage own shifts
- approve attendance
- cancel own OPEN shifts before start
- pause/resume self and global pause on own ACTIVE shifts
- see shift summaries
- list payout requests for their company and managed shifts
- approve PENDING payout requests for their company and managed shifts

ADMIN:
- read shift detail, list/approve attendance, and read worker-only shift summaries through REST where implemented
- no REST/mobile shift create/start/close/cancel/pause access
- no REST/mobile payout request creation or approval access for the MVP
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
WorkerPayrollScreen
ForemanDashboardScreen
ForemanPayrollRequestsScreen
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

11. Tests Needed For Payroll Implementation

Backend tests should cover:

- close initializes approved CLOSED attendance with paymentStatus UNPAID
- payable attendance list returns only the current worker's CLOSED, APPROVED, UNPAID attendance
- worker cannot list or request payout for another worker's attendance
- worker cannot request attendance outside their company
- worker cannot request OPEN, ACTIVE, CANCELLED, unapproved, PAID, or PAYMENT_REQUESTED attendance
- preview and create reject duplicate attendanceIds with 400 Bad Request
- preview returns selected totals and item calculations without creating requests or mutating attendance
- worker cannot create a payout request with attendance managed by multiple foremen in the MVP
- create revalidates and recalculates after preview before persisting
- payout request creation snapshots exact calculated amount, rounded payable minutes, and whole-number payout amount
- payout request creation sets selected attendance to PAYMENT_REQUESTED transactionally
- foreman sees only payout requests for their company and shifts they created
- foreman cannot approve another foreman's or another company's payout request
- approval requires PENDING request and PAYMENT_REQUESTED attendance
- approval sets request status APPROVED, approvedAt, paidAt, item paidAt, and attendance paymentStatus PAID
- rounding cases: 0 -> 0, exact 15-minute values unchanged, 1 minute -> 15 minutes, 467 minutes -> 480 minutes, fractional money rounded with CEILING
- concurrent create/approve attempts do not duplicate payout request items or double-pay attendance
