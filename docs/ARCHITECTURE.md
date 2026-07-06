# ShiftPay Architecture

## 1. Overview

ShiftPay is planned as a monorepo with separate modules:

backend/      Spring Boot REST API
mobile/       React Native / Expo app
web-admin/    Future admin dashboard
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
plannedStartTime
plannedEndTime
actualStartTime
actualEndTime
defaultBreakMinutes
defaultHourlyRate
createdBy
createdAt
updatedAt

Hourly Rate Ownership

- WORKER does not provide or modify hourly rates.
- FOREMAN sets defaultHourlyRate when creating an owned shift.
- ADMIN can set defaultHourlyRate for any shift.
- ShiftAttendance.hourlyRate is copied from ShiftSession.defaultHourlyRate when a worker joins.
- ShiftAttendance.hourlyRate is a snapshot for that worker and shift, so later shift-rate changes do not rewrite historical attendance.
- FOREMAN can override ShiftAttendance.hourlyRate while approving attendance for an owned OPEN shift.
- ADMIN can override ShiftAttendance.hourlyRate while approving attendance for any OPEN shift.
- Approval without an override preserves the join-time attendance rate snapshot.
- An attendance-specific override does not modify ShiftSession.defaultHourlyRate or other attendance records.
ShiftAttendance

Fields:

id
shiftSessionId
workerId
status
hourlyRate
breakMinutes
workedMinutes
calculatedSalary
joinedAt
approvedAt
createdAt
updatedAt

Attendance Approval

- The approval endpoint is available only to FOREMAN and ADMIN.
- FOREMAN ownership is enforced in the service layer against ShiftSession.createdBy.
- Attendance is loaded by both attendance id and shift session id, so a URL shift mismatch is returned as not found.
- Approval is allowed only while the shift is OPEN.
- The only allowed approval transition is JOINED -> APPROVED.
- approvedAt is recorded using the current server time in UTC.
- The optional hourly-rate override uses BigDecimal and is limited to non-negative values with two decimal places.

Attendance Query

- FOREMAN can list attendance only for an owned shift; ADMIN can list attendance for any shift.
- Attendance can be listed for OPEN, ACTIVE, and CLOSED shifts.
- The repository fetches attendance and worker in one query to avoid N+1 loading.
- Results are ordered by joinedAt ascending and then attendance id ascending.
- Controllers return attendance DTOs and never expose User entities or password hashes.

Concurrency Control

- Join, start, close, and approval run inside transactions with pessimistic write locks.
- ShiftSession is locked by id for start, close, and approval.
- ShiftSession is locked by joinCode for worker join.
- ShiftAttendance is locked by attendance id and shift id for approval.
- Operations that require both rows always lock ShiftSession first and ShiftAttendance second.
- Concurrent approvals serialize so only the first JOINED -> APPROVED transition succeeds.
- Start serializes with join and approval, preventing either operation from succeeding after the shift becomes ACTIVE.
- Close serializes concurrent lifecycle transitions and prevents duplicate successful close operations.

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
- own shifts
- join shift

FOREMAN:
- create shift
- manage own shifts
- approve attendance
- see shift summaries

ADMIN:
- full access

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

9. Development Workflow with Codex

Recommended agents:

Root Codex session:
- architecture
- documentation
- task planning

Backend Codex session:
- Spring Boot backend

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
