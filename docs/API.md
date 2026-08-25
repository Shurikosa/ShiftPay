# ShiftPay API Draft

This document describes the first draft of the ShiftPay backend API.

The API is not final. It should be updated whenever endpoints change.

Base path:

/api/v1

Health Check
GET /api/v1/health

No authentication required.

Response:

{
"status": "UP"
}

OpenAPI and Swagger UI

No authentication required.

OpenAPI JSON:

GET /v3/api-docs
GET /v3/api-docs/**

Swagger UI:

GET /swagger-ui.html
GET /swagger-ui/**

Local Swagger UI URL:

http://localhost:8080/swagger-ui/index.html

Swagger UI supports JWT authentication through Authorize with a Bearer token.
Business endpoints keep their normal JWT and role-based authorization rules.
 
 
1. Authentication
Register
POST /api/v1/auth/register

No authentication required.

Public registration supports only the WORKER and FOREMAN roles. ADMIN accounts cannot be created through this endpoint.

Request:

{
  "email": "worker@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Worker",
  "role": "WORKER"
}

Response:

Status: 201 Created

{
  "id": 1,
  "email": "worker@example.com",
  "firstName": "John",
  "lastName": "Worker",
  "role": "WORKER",
  "company": null
}

Validation error:

Status: 400 Bad Request

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "email: must be a well-formed email address",
  "path": "/api/v1/auth/register"
}

Unsupported public role:

Status: 400 Bad Request

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Public registration supports only WORKER and FOREMAN",
  "path": "/api/v1/auth/register"
}

Duplicate email:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "User with email already exists: worker@example.com",
  "path": "/api/v1/auth/register"
}
Login
POST /api/v1/auth/login

No authentication required.

JWT access tokens keep an expiration. For the MVP, the default JWT/session lifetime should be 8 hours. The mobile app should persist the session token and restore the session by calling `GET /api/v1/users/me` on app start.

Future biometric unlock or refresh-token/long-lived session support can be added later.

Request:

{
  "email": "worker@example.com",
  "password": "password123"
}

Response:

Status: 200 OK

{
  "accessToken": "jwt-token",
  "tokenType": "Bearer",
  "user": {
    "id": 1,
    "email": "worker@example.com",
    "firstName": "John",
    "lastName": "Worker",
    "role": "WORKER",
    "company": null
  }
}

Validation error:

Status: 400 Bad Request

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "email: must be a well-formed email address",
  "path": "/api/v1/auth/login"
}

Invalid credentials:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Invalid email or password",
  "path": "/api/v1/auth/login"
}

2. Current User
Get current user
GET /api/v1/users/me

Headers:

Authorization: Bearer <token>

Response for a new user without a company:

Status: 200 OK

{
  "id": 1,
  "email": "worker@example.com",
  "firstName": "John",
  "lastName": "Worker",
  "role": "WORKER",
  "company": null
}

Response after company assignment:

Status: 200 OK

{
  "id": 1,
  "email": "worker@example.com",
  "firstName": "John",
  "lastName": "Worker",
  "role": "WORKER",
  "company": {
    "id": 10,
    "name": "Acme Construction"
  }
}

company is null when the authenticated user has not created or joined a company yet.

For the owner FOREMAN, company may also include joinCode so it can be shared with workers:

{
  "id": 5,
  "email": "foreman@example.com",
  "firstName": "Frank",
  "lastName": "Foreman",
  "role": "FOREMAN",
  "company": {
    "id": 10,
    "name": "Acme Construction",
    "joinCode": "CMP123"
  }
}

The mobile app uses this endpoint during session restore and can display company.name in the main menu or dashboard when present.

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/users/me"
}

3. Companies
Create company

Only FOREMAN.

POST /api/v1/companies

Headers:

Authorization: Bearer <token>

Rules:

- FOREMAN creates a company after registration if they do not already have one.
- FOREMAN can own only one company for the mobile MVP.
- The backend generates a company join code.
- Company name is shown in the mobile main menu or dashboard.
- ADMIN company management is deferred to Vaadin after the mobile MVP.

Request:

{
  "name": "Acme Construction"
}

Response:

Status: 201 Created

{
  "id": 10,
  "name": "Acme Construction",
  "joinCode": "CMP123"
}

Validation error:

Status: 400 Bad Request

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "name: must not be blank",
  "path": "/api/v1/companies"
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/companies"
}

Forbidden role:

Status: 403 Forbidden

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/companies"
}

FOREMAN already has a company:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Foreman already has a company",
  "path": "/api/v1/companies"
}

Join company by code

Only WORKER.

POST /api/v1/companies/join

Headers:

Authorization: Bearer <token>

Rules:

- joinCode is normalized with trim and uppercase.
- WORKER can join a company by company join code.
- WORKER can join shifts only inside their company.
- WORKER can belong to only one company for the mobile MVP.

Request:

{
  "joinCode": "CMP123"
}

Response:

Status: 200 OK

{
  "id": 10,
  "name": "Acme Construction"
}

Validation error:

Status: 400 Bad Request

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "joinCode: must not be blank",
  "path": "/api/v1/companies/join"
}

Unknown company join code:

Status: 404 Not Found

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Company not found",
  "path": "/api/v1/companies/join"
}

WORKER already has a company:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Worker already belongs to a company",
  "path": "/api/v1/companies/join"
}

4. Shift Sessions
Create shift session

Only FOREMAN.

POST /api/v1/shifts

Headers:

Authorization: Bearer <token>

Request:

{
  "location": "Cologne",
  "defaultHourlyRate": 15.00,
  "foremanHourlyRate": 25.00
}

Response for owner FOREMAN:

Status: 201 Created

{
  "id": 100,
  "companyId": 10,
  "companyName": "Acme Construction",
  "title": "Tuesday 10:00 - Acme Construction",
  "location": "Cologne",
  "joinCode": "ABCD12",
  "status": "OPEN",
  "actualStartTime": null,
  "actualEndTime": null,
  "defaultBreakMinutes": 0,
  "defaultHourlyRate": 15.00,
  "foremanHourlyRate": 25.00,
  "createdBy": 5
}

FOREMAN must have a company before creating a shift. The backend attaches the shift to the foreman's company. Real MVP shifts must not use Default Company.

The mobile MVP create-shift contract does not accept title, plannedStartTime, or plannedEndTime. The backend generates a default title automatically from date/time and company name. Example format: `Tuesday 10:00 - Acme Construction`. Exact locale and format can be refined during implementation.

location is optional.

defaultBreakMinutes is optional, must be greater than or equal to 0 when provided, and defaults to 0 when omitted. Dynamic pauses are separate from defaultBreakMinutes and are tracked through pause endpoints while the shift is ACTIVE.

defaultHourlyRate is required, must be greater than or equal to 0, and supports up to two decimal places. It is used only as the worker attendance rate snapshot when workers join.

foremanHourlyRate is required, must be greater than or equal to 0, supports up to two decimal places, and is stored on ShiftSession for the foreman's private salary calculation. The owner FOREMAN can see foremanHourlyRate. WORKER never receives it. For the MVP REST/mobile API, ADMIN does not create shifts and does not receive foremanHourlyRate or foreman salary fields in read responses.

Validation error:

Status: 400 Bad Request

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "foremanHourlyRate: must be greater than or equal to 0.00",
  "path": "/api/v1/shifts"
}

FOREMAN has no company:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Foreman must create a company before creating shifts",
  "path": "/api/v1/shifts"
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/shifts"
}

Forbidden role:

Status: 403 Forbidden

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/shifts"
}
Get shift by id

GET /api/v1/shifts/{shiftId}

Headers:

Authorization: Bearer <token>

Access rules:

- FOREMAN can get only a shift created by that FOREMAN.
- ADMIN can get any shift.
- WORKER is not allowed until worker attendance access is implemented.

Response for owner FOREMAN:

Status: 200 OK

{
  "id": 100,
  "companyId": 10,
  "companyName": "Acme Construction",
  "title": "Tuesday 10:00 - Acme Construction",
  "location": "Cologne",
  "status": "OPEN",
  "joinCode": "ABCD12",
  "actualStartTime": null,
  "actualEndTime": null,
  "defaultBreakMinutes": 0,
  "defaultHourlyRate": 15.00,
  "foremanHourlyRate": 25.00,
  "pauseState": {
    "allPaused": false,
    "allPauseStartedAt": null,
    "personallyPaused": false,
    "personalPauseStartedAt": null,
    "effectivePauseMinutes": null
  },
  "createdBy": 5
}

foremanHourlyRate is included only when the current user is the owner FOREMAN of the shift. WORKER never receives it. For the MVP REST/mobile API, ADMIN does not receive foremanHourlyRate.

pauseState is included for shift detail and managed-shift DTOs. For the owner FOREMAN it represents the foreman's own personal pause plus any all-participant pause.

Response for ADMIN:

Status: 200 OK

{
  "id": 100,
  "companyId": 10,
  "companyName": "Acme Construction",
  "title": "Tuesday 10:00 - Acme Construction",
  "location": "Cologne",
  "status": "OPEN",
  "joinCode": "ABCD12",
  "actualStartTime": null,
  "actualEndTime": null,
  "defaultBreakMinutes": 0,
  "defaultHourlyRate": 15.00,
  "pauseState": {
    "allPaused": false,
    "allPauseStartedAt": null,
    "personallyPaused": false,
    "personalPauseStartedAt": null,
    "effectivePauseMinutes": null
  },
  "createdBy": 5
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/shifts/100"
}

Forbidden role or non-owner FOREMAN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/shifts/100"
}

Shift not found:

Status: 404 Not Found

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Shift not found",
  "path": "/api/v1/shifts/100"
}
Start shift

POST /api/v1/shifts/{shiftId}/start

Headers:

Authorization: Bearer <token>

Access and state rules:

- FOREMAN can start only a shift created by that FOREMAN.
- ADMIN is not allowed to start shifts through the REST/mobile API.
- WORKER is not allowed.
- Only a shift with status OPEN can be started.
- FOREMAN must still have the company that owns the shift.
- The backend sets actualStartTime to the current server time in UTC.

Response:

Status: 200 OK

{
  "id": 100,
  "status": "ACTIVE",
  "actualStartTime": "2026-07-01T08:05:00Z"
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-01T08:05:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/shifts/100/start"
}

Forbidden role or non-owner FOREMAN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-01T08:05:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/shifts/100/start"
}

Shift not found:

Status: 404 Not Found

{
  "timestamp": "2026-07-01T08:05:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Shift not found",
  "path": "/api/v1/shifts/100/start"
}

Shift is not OPEN:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T08:05:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Shift can only be started when status is OPEN",
  "path": "/api/v1/shifts/100/start"
}

Cancel shift

POST /api/v1/shifts/{shiftId}/cancel

Headers:

Authorization: Bearer <token>

This endpoint does not accept a request body.

Access and state rules:

- FOREMAN can cancel only a shift created by that FOREMAN.
- ADMIN is not allowed to cancel shifts through the REST/mobile API.
- WORKER is not allowed.
- Only a shift with status OPEN can be cancelled.
- The backend sets status to CANCELLED.
- The backend does not set actualStartTime or actualEndTime.
- The backend does not calculate worker salary or private foreman salary.
- CANCELLED shifts cannot be started, closed, joined by workers, or summarized.

Response for owner FOREMAN:

Status: 200 OK

{
  "id": 100,
  "companyId": 10,
  "companyName": "Acme Construction",
  "title": "Tuesday 10:00 - Acme Construction",
  "location": "Cologne",
  "status": "CANCELLED",
  "joinCode": "ABCD12",
  "actualStartTime": null,
  "actualEndTime": null,
  "defaultBreakMinutes": 0,
  "defaultHourlyRate": 15.00,
  "foremanHourlyRate": 25.00,
  "pauseState": {
    "allPaused": false,
    "allPauseStartedAt": null,
    "personallyPaused": false,
    "personalPauseStartedAt": null,
    "effectivePauseMinutes": null
  },
  "createdBy": 5
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-01T08:10:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/shifts/100/cancel"
}

Forbidden role or non-owner FOREMAN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-01T08:10:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/shifts/100/cancel"
}

Shift not found:

Status: 404 Not Found

{
  "timestamp": "2026-07-01T08:10:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Shift not found",
  "path": "/api/v1/shifts/100/cancel"
}

Shift is not OPEN:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T08:10:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Shift can only be cancelled before it starts",
  "path": "/api/v1/shifts/100/cancel"
}
Close shift

POST /api/v1/shifts/{shiftId}/close

Headers:

Authorization: Bearer <token>

This endpoint does not accept a request body. The backend sets actualEndTime to the current server time in UTC.

Access and state rules:

- FOREMAN can close only a shift created by that FOREMAN.
- ADMIN is not allowed to close shifts through the REST/mobile API.
- WORKER is not allowed.
- Only a shift with status ACTIVE can be closed.
- actualStartTime must exist.
- For each APPROVED attendance, the backend calculates and stores workedMinutes and calculatedSalary.
- Close auto-ends any active personal or all-participant pause intervals at actualEndTime.
- durationMinutes = minutes_between(worker payable start, actualEndTime).
- unpaidMinutes = attendance.breakMinutes + effective pause minutes.
- workedMinutes = max(0, durationMinutes - unpaidMinutes).
- calculatedSalary = workedMinutes / 60 * attendance.hourlyRate, rounded to 2 decimal places with HALF_UP.
- Effective pause minutes are the union of all-pause intervals and that user's personal pause intervals; overlapping intervals are not double-counted.
- The backend persists each approved attendance pauseMinutes.
- Salary uses the attendance hourlyRate snapshot or attendance-specific override, not shift.defaultHourlyRate.
- JOINED, REJECTED, and CANCELLED attendance keep workedMinutes and calculatedSalary as null.
- The backend calculates foremanWorkedMinutes and foremanSalary separately from worker attendance.
- foremanDurationMinutes = minutes_between(actualStartTime, actualEndTime).
- foremanUnpaidMinutes = shift.defaultBreakMinutes + foreman effective pause minutes.
- foremanWorkedMinutes = max(0, foremanDurationMinutes - foremanUnpaidMinutes).
- The backend persists foremanPauseMinutes.
- foremanSalary = foremanWorkedMinutes / 60 * shift.foremanHourlyRate, rounded to 2 decimal places with HALF_UP.
- Foreman salary uses ShiftSession.foremanHourlyRate.
- The backend must not create a ShiftAttendance row for foreman salary.
- CANCELLED shifts cannot be closed and do not calculate salary.
- If static break minutes or static break plus effective pause minutes exceed the payable duration, close still succeeds and persists workedMinutes/foremanWorkedMinutes and salary/foremanSalary as zero.

Response:

Status: 200 OK

{
  "id": 100,
  "status": "CLOSED",
  "actualEndTime": "2026-07-01T17:00:00Z"
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-01T17:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/shifts/100/close"
}

Forbidden role or non-owner FOREMAN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-01T17:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/shifts/100/close"
}

Shift not found:

Status: 404 Not Found

{
  "timestamp": "2026-07-01T17:00:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Shift not found",
  "path": "/api/v1/shifts/100/close"
}

Shift is not ACTIVE:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T17:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Shift can only be closed when status is ACTIVE",
  "path": "/api/v1/shifts/100/close"
}

Missing actualStartTime:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T17:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Shift actualStartTime is required before closing",
  "path": "/api/v1/shifts/100/close"
}

5. Shift Join
Join shift by code

Only WORKER.

POST /api/v1/shifts/join

Headers:

Authorization: Bearer <token>

Rules:

- joinCode is normalized with trim and uppercase.
- The shift must have status OPEN or ACTIVE.
- A WORKER should join an OPEN shift before it starts, or may join an ACTIVE shift as a late worker.
- CLOSED and CANCELLED shifts cannot be joined and return 409.
- The worker must already be a member of the company that owns the shift.
- A worker can join the same shift only once.
- A worker never sets hourlyRate.
- The backend copies shift.defaultHourlyRate into shift_attendance.hourly_rate as a rate snapshot.
- If a client includes hourlyRate in the JSON, it is ignored and cannot change the assigned rate.
- breakMinutes is copied from the shift defaultBreakMinutes, which defaults to 0 if omitted during shift creation.
- joinedAt is set by the backend to the current server time in UTC.

Request:

{
  "joinCode": "ABCD12"
}

Response:

Status: 200 OK

{
  "attendanceId": 500,
  "shiftId": 100,
  "workerId": 1,
  "status": "JOINED",
  "hourlyRate": 15.00
}

Validation error:

Status: 400 Bad Request

{
  "timestamp": "2026-07-01T07:55:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "joinCode: must not be blank",
  "path": "/api/v1/shifts/join"
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-01T07:55:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/shifts/join"
}

FOREMAN or ADMIN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-01T07:55:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/shifts/join"
}

Unknown join code:

Status: 404 Not Found

{
  "timestamp": "2026-07-01T07:55:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Shift not found",
  "path": "/api/v1/shifts/join"
}

Duplicate join:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T07:55:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Worker has already joined this shift",
  "path": "/api/v1/shifts/join"
}

Shift is not joinable:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T07:55:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Workers can only join shifts with status OPEN or ACTIVE",
  "path": "/api/v1/shifts/join"
}

Worker is not a company member:

Status: 403 Forbidden

{
  "timestamp": "2026-07-01T07:55:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Worker must join the company before joining this shift",
  "path": "/api/v1/shifts/join"
}

Worker is not a company member:

Status: 403 Forbidden

{
  "timestamp": "2026-07-01T07:55:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Worker must join the company before joining this shift",
  "path": "/api/v1/shifts/join"
}

List shift attendance

Only FOREMAN or ADMIN.

GET /api/v1/shifts/{shiftId}/attendance

Headers:

Authorization: Bearer <token>

Rules:

- FOREMAN can list attendance only for a shift they created.
- ADMIN can list attendance for any shift.
- WORKER is not allowed.
- The endpoint is available while the shift is OPEN, ACTIVE, CLOSED, or CANCELLED.
- Results are sorted by joinedAt ascending, then attendanceId ascending.
- Worker data is returned through the attendance DTO; passwordHash and the User entity are never exposed.

Response:

Status: 200 OK

[
  {
    "attendanceId": 500,
    "workerId": 10,
    "firstName": "John",
    "lastName": "Worker",
    "status": "JOINED",
    "hourlyRate": 15.00,
    "breakMinutes": 0,
    "payableStartTime": null,
    "pauseMinutes": null,
    "workedMinutes": null,
    "calculatedSalary": null,
    "pauseState": {
      "allPaused": false,
      "allPauseStartedAt": null,
      "personallyPaused": false,
      "personalPauseStartedAt": null,
      "effectivePauseMinutes": null
    },
    "joinedAt": "2026-07-06T18:00:00Z",
    "approvedAt": null
  }
]

For APPROVED attendance after the shift is closed, pauseMinutes, workedMinutes, and calculatedSalary contain the close-time calculation.
For JOINED, REJECTED, and CANCELLED attendance, pauseMinutes, workedMinutes, and calculatedSalary remain null.
payableStartTime is null until the worker has approved attendance and an effective payable start. For a worker approved before the shift starts, the effective payable start is the shift actualStartTime and may be returned after start. For a worker approved during an ACTIVE shift, payableStartTime is the approval time.
pauseState shows the all-pause state plus the listed worker's personal pause state. It does not expose foreman salary or rate fields.

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/shifts/100/attendance"
}

WORKER or non-owner FOREMAN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/shifts/100/attendance"
}

Shift not found:

Status: 404 Not Found

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Shift not found",
  "path": "/api/v1/shifts/100/attendance"
}

Approve worker attendance

Only FOREMAN or ADMIN.

POST /api/v1/shifts/{shiftId}/attendance/{attendanceId}/approve

Headers:

Authorization: Bearer <token>

Rules:

- FOREMAN can approve attendance only for a shift they created.
- ADMIN can approve attendance for any shift.
- The shift must have status OPEN or ACTIVE.
- The attendance must belong to the shift identified by shiftId.
- Only the JOINED -> APPROVED transition is allowed.
- The request body is optional.
- If hourlyRate is omitted, the attendance keeps the rate snapshot assigned when the worker joined.
- If hourlyRate is provided, it overrides the rate only for this attendance.
- hourlyRate must be non-negative and have at most two decimal places.
- approvedAt is set by the backend to the current server time in UTC.
- If approval happens before the shift starts, the worker's payable start is shift actualStartTime.
- If approval happens while the shift is already ACTIVE, the worker's payable start is approvedAt.

Request without a rate override:

{}

The request body may also be omitted.

Request with an attendance-specific rate override:

{
  "hourlyRate": 18.50
}

Response:

Status: 200 OK

{
  "attendanceId": 500,
  "status": "APPROVED",
  "hourlyRate": 18.50,
  "approvedAt": "2026-07-06T20:00:00Z"
}

Invalid hourlyRate:

Status: 400 Bad Request

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "hourlyRate: must be greater than or equal to 0.00",
  "path": "/api/v1/shifts/100/attendance/500/approve"
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/shifts/100/attendance/500/approve"
}

WORKER or non-owner FOREMAN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/shifts/100/attendance/500/approve"
}

Shift not found:

Status: 404 Not Found

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Shift not found",
  "path": "/api/v1/shifts/100/attendance/500/approve"
}

Attendance not found or does not belong to the shift:

Status: 404 Not Found

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Attendance not found",
  "path": "/api/v1/shifts/100/attendance/500/approve"
}

Shift is not approvable:

Status: 409 Conflict

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Attendance can only be approved while shift status is OPEN or ACTIVE",
  "path": "/api/v1/shifts/100/attendance/500/approve"
}

Attendance is not JOINED:

Status: 409 Conflict

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Attendance can only be approved when status is JOINED",
  "path": "/api/v1/shifts/100/attendance/500/approve"
}

6. Shift Pauses

Pause is implemented for ACTIVE shifts. Pause is separate from static defaultBreakMinutes; close-time salary calculation subtracts both static break minutes and backend-tracked dynamic pause minutes.

Pause endpoints do not accept a request body.

Start my pause

POST /api/v1/shifts/{shiftId}/pauses/me/start

End my pause

POST /api/v1/shifts/{shiftId}/pauses/me/end

Start pause for all

POST /api/v1/shifts/{shiftId}/pauses/all/start

End pause for all

POST /api/v1/shifts/{shiftId}/pauses/all/end

Access and state rules:

- `/pauses/me/*` is available to WORKER and FOREMAN.
- WORKER can start/end only their own personal pause after they have APPROVED attendance on the ACTIVE shift in their company.
- FOREMAN can start/end only their own personal pause on a shift they created.
- `/pauses/all/*` is available only to the owner FOREMAN.
- ADMIN is not allowed to pause through the REST/mobile API.
- Pause start/end is allowed only while shift status is ACTIVE.
- OPEN, CLOSED, and CANCELLED shifts return 409 for pause start/end.
- Duplicate start for the same active scope/target returns 409.
- Ending when there is no active pause for that scope/target returns 409.
- All-pause applies to the foreman and all workers on the shift.
- All-pause affects late workers only inside their payable work interval.
- Personal pause applies only to the targeted current user.
- If personal and all-pause intervals overlap, close-time salary calculation subtracts the union of intervals without double-counting.
- Close auto-ends active pause intervals at actualEndTime before calculating salary.
- No client-side salary calculation is allowed.

Response:

Status: 200 OK

{
  "shiftId": 100,
  "pauseId": 700,
  "scope": "PERSONAL",
  "userId": 10,
  "active": true,
  "startedAt": "2026-07-01T09:15:00Z",
  "endedAt": null
}

All-pause responses omit userId:

{
  "shiftId": 100,
  "pauseId": 701,
  "scope": "ALL",
  "active": false,
  "startedAt": "2026-07-01T10:00:00Z",
  "endedAt": "2026-07-01T10:15:00Z"
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-01T09:15:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/shifts/100/pauses/me/start"
}

Forbidden role, non-owner FOREMAN, or worker who did not join the shift:

Status: 403 Forbidden

{
  "timestamp": "2026-07-01T09:15:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Worker must join this shift before pausing",
  "path": "/api/v1/shifts/100/pauses/me/start"
}

Shift not found:

Status: 404 Not Found

{
  "timestamp": "2026-07-01T09:15:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Shift not found",
  "path": "/api/v1/shifts/100/pauses/me/start"
}

Shift is not ACTIVE:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T09:15:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Pause is available only while shift status is ACTIVE",
  "path": "/api/v1/shifts/100/pauses/me/start"
}

Duplicate start:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T09:15:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Personal pause is already active",
  "path": "/api/v1/shifts/100/pauses/me/start"
}

End without an active pause:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T09:15:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "No active personal pause to end",
  "path": "/api/v1/shifts/100/pauses/me/end"
}

7. Salary Calculation

The backend is the source of truth for salary. Mobile clients must display server fields and must not calculate worker or foreman salary locally.

Static break minutes and dynamic pause minutes are both unpaid deductions. Dynamic pause minutes are calculated from persisted pause intervals and merged as a union for each participant so overlapping personal and all-participant pauses are not double-counted.

Worker salary formula after close:

worker_payable_start = actualStartTime for attendance approved before shift start, or approvedAt/payableStartTime for attendance approved while ACTIVE
worker_duration_minutes = actualEndTime - worker_payable_start
worker_unpaid_minutes = attendance.breakMinutes + attendance.pauseMinutes
worker_worked_minutes = max(0, worker_duration_minutes - worker_unpaid_minutes)
worker_salary = worker_worked_minutes / 60 * attendance.hourlyRate

Worker worked minutes cannot be negative. Static break minutes, or static break plus pause minutes, that exceed a worker's payable duration clamp worker_worked_minutes and worker_salary to zero. Pause calculations are clipped to the worker payable work interval, so all-pause or personal pause time before a late worker's payable start is not deducted from that worker.

Foreman salary formula after close:

foreman_duration_minutes = actualEndTime - actualStartTime
foreman_unpaid_minutes = shift.defaultBreakMinutes + shift.foremanPauseMinutes
foreman_worked_minutes = max(0, foreman_duration_minutes - foreman_unpaid_minutes)
foreman_salary = foreman_worked_minutes / 60 * shift.foremanHourlyRate

Foreman worked minutes cannot be negative. Static break minutes, or static break plus pause minutes, that exceed the foreman's payable duration clamp foreman_worked_minutes and foreman_salary to zero.

Salary is rounded to 2 decimal places with HALF_UP. Salary is calculated only when close succeeds.

Get shift summary

Only FOREMAN or ADMIN.

GET /api/v1/shifts/{shiftId}/summary

Headers:

Authorization: Bearer <token>

Rules:

- FOREMAN can get summary only for a shift they created.
- ADMIN can get worker summary for any shift.
- WORKER is not allowed.
- Summary is available only for CLOSED shifts.
- The endpoint uses stored workedMinutes and calculatedSalary from shift_attendance.
- The endpoint does not recalculate salary.
- Only APPROVED attendance is included in workers.
- JOINED, REJECTED, and CANCELLED attendance is excluded.
- totalWorkers is the number of included APPROVED attendance records.
- totalSalary is the sum of included worker calculatedSalary values with scale 2.
- Worker summary remains limited to APPROVED worker attendance.
- Salary results subtract static break minutes and effective pause minutes, then clamp paid minutes to zero when unpaid minutes exceed the payable duration.
- Late approved worker salary starts from the worker payable start time, not the global shift actualStartTime.
- CANCELLED shifts do not return summary because salary is not calculated.
- Workers are sorted by lastName ascending, firstName ascending, then workerId ascending.
- If an APPROVED attendance has null workedMinutes or calculatedSalary, the endpoint returns 409.
- The owner FOREMAN receives private foreman salary fields separately from workers: foremanWorkedMinutes, foremanPauseMinutes, foremanHourlyRate, and foremanSalary.
- foremanWorkedMinutes uses max(0, actualEndTime - actualStartTime - ShiftSession.defaultBreakMinutes - foremanPauseMinutes).
- foremanSalary uses ShiftSession.foremanHourlyRate.
- WORKER never receives foreman salary fields.
- For the MVP REST/mobile API, ADMIN does not receive foreman salary fields.
- Future ADMIN/Vaadin visibility for foreman salary can be decided later.

Response for owner FOREMAN:

Status: 200 OK

{
  "shiftId": 100,
  "status": "CLOSED",
  "totalWorkers": 2,
  "totalSalary": 240.00,
  "foremanWorkedMinutes": 480,
  "foremanPauseMinutes": 0,
  "foremanHourlyRate": 25.00,
  "foremanSalary": 200.00,
  "workers": [
    {
      "attendanceId": 500,
      "workerId": 1,
      "firstName": "John",
      "lastName": "Worker",
      "workedMinutes": 480,
      "pauseMinutes": 0,
      "hourlyRate": 15.00,
      "salary": 120.00
    }
  ]
}

Response for ADMIN:

Status: 200 OK

{
  "shiftId": 100,
  "status": "CLOSED",
  "totalWorkers": 2,
  "totalSalary": 240.00,
  "foremanWorkedMinutes": 480,
  "foremanHourlyRate": 25.00,
  "foremanSalary": 200.00,
  "workers": [
    {
      "attendanceId": 500,
      "workerId": 1,
      "firstName": "John",
      "lastName": "Worker",
      "workedMinutes": 480,
      "pauseMinutes": 0,
      "hourlyRate": 15.00,
      "salary": 120.00
    }
  ]
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/shifts/100/summary"
}

WORKER or non-owner FOREMAN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/shifts/100/summary"
}

Shift not found:

Status: 404 Not Found

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Shift not found",
  "path": "/api/v1/shifts/100/summary"
}

Shift is not CLOSED:

Status: 409 Conflict

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Shift summary is available only for CLOSED shifts",
  "path": "/api/v1/shifts/100/summary"
}

Approved attendance has incomplete salary calculation:

Status: 409 Conflict

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Approved attendance has incomplete salary calculation",
  "path": "/api/v1/shifts/100/summary"
}

Get my shift history

Only authenticated user.

GET /api/v1/me/shifts

Rules:

- WORKER sees only attendance records where the current user is the worker.
- FOREMAN and ADMIN also see only their own worker-attendance records for this endpoint, not shifts they manage.
- OPEN, ACTIVE, CLOSED, and CANCELLED shifts are included.
- CLOSED shifts return workedMinutes and calculatedSalary when those values were already calculated and stored.
- OPEN, ACTIVE, CANCELLED, and unapproved attendance may return null workedMinutes and calculatedSalary.
- This endpoint reads stored attendance salary fields and does not recalculate salary.
- The response includes pauseState for active shift display and pauseMinutes after close-time salary calculation.
- The response includes payableStartTime when the backend knows the worker's effective salary start.
- Results are sorted by joinedAt descending, then attendanceId descending.
- The response does not expose User entities, worker records, email, or passwordHash.
- The repository fetches attendance with shift in one query to avoid N+1 loading.

Response:

[
  {
    "shiftId": 100,
    "attendanceId": 500,
    "companyId": 10,
    "companyName": "Acme Construction",
    "title": "Tuesday 10:00 - Acme Construction",
    "location": "Cologne",
    "status": "CLOSED",
    "actualStartTime": "2026-07-01T08:05:00Z",
    "actualEndTime": "2026-07-01T17:00:00Z",
    "attendanceStatus": "APPROVED",
    "paused": false,
    "globalPauseActive": false,
    "hourlyRate": 15.00,
    "breakMinutes": 0,
    "payableStartTime": "2026-07-01T08:05:00Z",
    "pauseMinutes": 0,
    "workedMinutes": 480,
    "calculatedSalary": 120.00,
    "pauseState": {
      "allPaused": false,
      "allPauseStartedAt": null,
      "personallyPaused": false,
      "personalPauseStartedAt": null,
      "effectivePauseMinutes": 0
    }
  }
]

Worker history never returns foremanHourlyRate, foremanWorkedMinutes, foremanPauseMinutes, or foremanSalary.
Salary remains backend-calculated. Mobile should display persisted workedMinutes, pauseMinutes, payableStartTime, and calculatedSalary without recalculating them.

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/me/shifts"
}

Get my managed shifts

GET /api/v1/me/managed-shifts

Purpose:

- The Foreman mobile dashboard needs a list of shifts created and managed by the current foreman.
- This endpoint must stay separate from `GET /api/v1/me/shifts`.
- `GET /api/v1/me/shifts` remains personal worker attendance history only.

Access rules:

- FOREMAN can list shifts where `createdBy` is the current user.
- ADMIN can call this endpoint and receives shifts where `createdBy` is the current user. Because ADMIN cannot create shifts through the REST/mobile API, this is normally empty for admins. Full admin listing is deferred to the Vaadin admin UI.
- WORKER is not allowed.
- Missing, invalid, or expired JWT returns 401.
- The endpoint does not include attendance data and does not recalculate salary.
- Results are sorted by createdAt descending, then shift id descending.
- The response uses shift DTO fields and does not expose User entities, passwordHash, company entity, createdAt, or updatedAt.

Response for owner FOREMAN:

Status: 200 OK

[
  {
    "id": 100,
    "companyId": 10,
    "companyName": "Acme Construction",
    "title": "Tuesday 10:00 - Acme Construction",
    "location": "Cologne",
    "status": "OPEN",
    "joinCode": "ABCD12",
    "actualStartTime": null,
    "actualEndTime": null,
    "defaultBreakMinutes": 0,
    "defaultHourlyRate": 15.00,
    "foremanHourlyRate": 25.00,
    "pauseState": {
      "allPaused": false,
      "allPauseStartedAt": null,
      "personallyPaused": false,
      "personalPauseStartedAt": null,
      "effectivePauseMinutes": null
    },
    "createdBy": 5
  }
]

foremanHourlyRate is included only for FOREMAN users who own the managed shift. WORKER cannot call this endpoint. For the MVP REST/mobile API, ADMIN does not receive foremanHourlyRate.

Response for ADMIN:

Status: 200 OK

[]

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/me/managed-shifts"
}

WORKER:

Status: 403 Forbidden

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/me/managed-shifts"
}

8. Error Response Format

All API errors should use this format:

{
  "timestamp": "2026-07-01T10:00:00",
  "status": 409,
  "error": "Conflict",
  "message": "Shift can only be closed when status is ACTIVE",
  "path": "/api/v1/shifts/100/close"
}

9. Authorization Rules
WORKER:
- can see own profile
- can join company by company join code
- can join OPEN shifts and ACTIVE shifts in their company
- can see own shift history
- can pause/resume self on ACTIVE shifts where they have approved attendance

FOREMAN:
- can create own company
- can create shift
- can start shift
- can close shift
- can cancel own OPEN shift before start
- can approve attendance
- can see own managed shifts
- can see shift summary
- can pause/resume self on own ACTIVE shifts
- can pause/resume all participants on own ACTIVE shifts

ADMIN:
- can read shift detail, list attendance, approve attendance, and see worker-only shift summary through current REST endpoints
- cannot create, start, close, cancel, or pause shifts through the REST/mobile API
- can call `GET /api/v1/me/managed-shifts`, normally returning an empty list because ADMIN REST shift creation is disabled
- does not receive foremanHourlyRate, foremanWorkedMinutes, foremanPauseMinutes, or foremanSalary through the MVP REST/mobile API
- full user management is deferred until after the mobile MVP and should be implemented through the Vaadin admin dashboard
- mobile MVP has no ADMIN flow
