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
- CANCELLED shifts cannot be started, closed, joined by workers, paused, resumed, or summarized.

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

Optional request body:

{
  "saveShortShift": true
}

The backend sets actualEndTime to the current server time in UTC when close succeeds. If the request body is omitted, empty, or `saveShortShift` is false, the backend treats the request as a normal close without short-shift override.

Access and state rules:

- FOREMAN can close only a shift created by that FOREMAN.
- ADMIN is not allowed to close shifts through the REST/mobile API.
- WORKER is not allowed.
- Only a shift with status ACTIVE can be closed.
- actualStartTime must exist.
- The backend is the source of truth for the actual duration decision.
- actualDurationMinutes = minutes_between(actualStartTime, proposed actualEndTime).
- shortShiftMinimumMinutes = 15.
- If actualDurationMinutes is 0 or less than 15 and `saveShortShift` is not true, the backend returns 409 Conflict with code SHORT_SHIFT_REQUIRES_DECISION.
- A short-shift warning response does not mutate the shift, does not close active pause intervals, does not calculate salary, and does not change attendance paymentStatus.
- If actualDurationMinutes is 0 or less than 15 and `saveShortShift` is true, close proceeds normally and payroll is calculated from the actual persisted inputs.
- For each APPROVED attendance, the backend calculates and stores workedMinutes and calculatedSalary.
- For each APPROVED attendance, the backend sets paymentStatus to UNPAID after close.
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
- CANCELLED and DISCARDED shifts cannot be closed and do not calculate salary.
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

Short shift requires foreman decision:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T08:12:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Shift duration is less than 15 minutes; confirm whether to save or discard",
  "path": "/api/v1/shifts/100/close",
  "code": "SHORT_SHIFT_REQUIRES_DECISION",
  "actualDurationMinutes": 7,
  "minimumDurationMinutes": 15
}

Discard short active shift

POST /api/v1/shifts/{shiftId}/discard

Headers:

Authorization: Bearer <token>

This endpoint does not accept a request body. The backend sets discardedAt to the current server time in UTC.

Access and state rules:

- FOREMAN can discard only a shift created by that FOREMAN.
- ADMIN is not allowed to discard shifts through the REST/mobile API.
- WORKER is not allowed.
- Only a shift with status ACTIVE can be discarded.
- actualStartTime must exist.
- The backend is the source of truth for whether a shift is short enough to discard.
- actualDurationMinutes = minutes_between(actualStartTime, discardedAt).
- A shift can be discarded only when actualDurationMinutes is 0 or less than 15.
- If actualDurationMinutes is 15 or greater, the backend returns 409 Conflict and the foreman must close normally instead.
- The backend sets status to DISCARDED.
- The backend sets actualEndTime to discardedAt for audit, but DISCARDED is not treated as normal completed work.
- The backend records discardedAt, discardedBy, and discardReason. The MVP discardReason is SHORT_SHIFT_NOT_SAVED.
- Discard auto-ends active personal or all-participant pause intervals at discardedAt for audit only.
- Discard does not calculate worker salary or private foreman salary.
- Discard does not initialize or change attendance paymentStatus for payroll.
- JOINED, APPROVED, REJECTED, and CANCELLED attendance on a DISCARDED shift keep workedMinutes, pauseMinutes, and calculatedSalary as null.
- DISCARDED attendance is never payable and cannot be included in payout preview or payout request creation.
- DISCARDED shifts cannot be started, closed, joined by workers, paused, resumed, or summarized.
- Worker history may show DISCARDED shift/status as non-payable history with no payroll action.
- Foreman managed shifts may show DISCARDED shift/status for audit, but it must not appear as normal completed work.

Response:

Status: 200 OK

{
  "id": 100,
  "status": "DISCARDED",
  "actualEndTime": "2026-07-01T08:12:00Z",
  "discardedAt": "2026-07-01T08:12:00Z",
  "discardedBy": 5,
  "discardReason": "SHORT_SHIFT_NOT_SAVED"
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-01T08:12:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/shifts/100/discard"
}

Forbidden role or non-owner FOREMAN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-01T08:12:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/shifts/100/discard"
}

Shift not found:

Status: 404 Not Found

{
  "timestamp": "2026-07-01T08:12:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Shift not found",
  "path": "/api/v1/shifts/100/discard"
}

Shift is not ACTIVE:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T08:12:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Shift can only be discarded when status is ACTIVE",
  "path": "/api/v1/shifts/100/discard"
}

Shift is no longer short:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T08:20:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Only shifts shorter than 15 minutes can be discarded",
  "path": "/api/v1/shifts/100/discard"
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
- CLOSED, CANCELLED, and DISCARDED shifts cannot be joined and return 409.
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
- The endpoint is available while the shift is OPEN, ACTIVE, CLOSED, CANCELLED, or DISCARDED.
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
    "paymentStatus": "UNPAID",
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
For JOINED, REJECTED, CANCELLED, and DISCARDED-shift attendance, pauseMinutes, workedMinutes, and calculatedSalary remain null.
paymentStatus is separate from shift status and attendance approval status. Payroll endpoints are the source of truth for payout request and rounded payout fields.
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
- OPEN, CLOSED, CANCELLED, and DISCARDED shifts return 409 for pause start/end.
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
- CANCELLED and DISCARDED shifts do not return summary because salary is not calculated.
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

Private foreman salary fields are omitted. ADMIN summary responses contain worker totals and worker rows only.

Status: 200 OK

{
  "shiftId": 100,
  "status": "CLOSED",
  "totalWorkers": 2,
  "totalSalary": 240.00,
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
- OPEN, ACTIVE, CLOSED, CANCELLED, and DISCARDED shifts are included.
- CLOSED shifts return workedMinutes and calculatedSalary when those values were already calculated and stored.
- OPEN, ACTIVE, CANCELLED, DISCARDED, and unapproved attendance may return null workedMinutes and calculatedSalary.
- This endpoint reads stored attendance salary fields and does not recalculate salary.
- CLOSED approved attendance includes paymentStatus so the worker can see whether the payroll item is UNPAID, PAYMENT_REQUESTED, or PAID.
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
    "paymentStatus": "UNPAID",
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
Rounded payout minutes and payout amounts are returned by payroll endpoints. Mobile must not derive them from worker history.

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

8. Payroll Requests

Payroll Requests MVP adds a payment lifecycle separate from ShiftStatus.

ShiftStatus values are:

OPEN
ACTIVE
CLOSED
CANCELLED
DISCARDED

Do not add PAID or NOT_PAID to ShiftStatus.
Use CANCELLED only for pre-start cancellation. Use DISCARDED for an active short shift that the foreman explicitly chooses not to save.

Attendance payment status:

UNPAID
PAYMENT_REQUESTED
PAID

paymentStatus is stored on every ShiftAttendance row. New attendance starts as UNPAID, but only CLOSED, APPROVED, UNPAID attendance with persisted workedMinutes and calculatedSalary is payable. DISCARDED shift attendance is never payable.

Payout request status for MVP:

PENDING
APPROVED

REJECTED and CANCELLED are reserved future statuses. Do not expose reject or cancel endpoints in the MVP unless a later docs update explicitly adds them.

Backend is the source of truth for payroll. Mobile must not calculate salary, rounded payable minutes, or payout amounts.

Data model proposal:

shift_attendance additions:

- paymentStatus
- paidAt

payout_requests:

- id
- companyId
- workerId
- managerForemanId
- status
- rawPayableMinutesTotal
- payoutRoundedMinutesTotal
- exactCalculatedAmountTotal
- payoutAmount
- requestedAt
- approvedBy
- approvedAt
- paidAt
- createdAt
- updatedAt

payout_request_items:

- id
- payoutRequestId
- attendanceId
- shiftSessionId
- rawPayableMinutes
- payoutRoundedMinutes
- hourlyRate
- calculatedSalary
- roundedItemAmountExact
- payoutAmount
- createdAt
- paidAt

Payroll rounding:

- rawPayableMinutes is the already persisted ShiftAttendance.workedMinutes from the close flow.
- calculatedSalary remains the exact audit/display amount from rawPayableMinutes and hourlyRate, stored with scale 2 and HALF_UP.
- payoutRoundedMinutes is calculated per attendance item by rounding rawPayableMinutes to the nearest 5 minutes with half-up midpoint behavior.
- If rawPayableMinutes is 0, payoutRoundedMinutes is 0.
- If rawPayableMinutes is greater than 0 and rounding would otherwise produce 0, payoutRoundedMinutes is 5.
- roundedItemAmountExact is `payoutRoundedMinutes / 60 * hourlyRate`.
- payoutAmount is a whole-number money amount with no cents, calculated per attendance item from roundedItemAmountExact using RoundingMode.CEILING.
- Because amounts are non-negative, CEILING means round up to the next whole currency unit when there is any fractional part.
- Request totals are sums of item-level rawPayableMinutes, payoutRoundedMinutes, calculatedSalary, and payoutAmount.
- Preview and create use the same backend calculation rules. Preview is non-binding; create always revalidates and recalculates server-side.
- Examples for payoutRoundedMinutes: 0 -> 0, 1 -> 5, 4 -> 5, 5 -> 5, 7 -> 5, 8 -> 10, 11 -> 10, 13 -> 15, 25 -> 25, 28 -> 30.

Example:

- rawPayableMinutes 467, hourlyRate 15.00
- payoutRoundedMinutes 465
- calculatedSalary from close flow: 116.75
- roundedItemAmountExact: 116.25
- payoutAmount: 117

Zero example:

- rawPayableMinutes 0, hourlyRate 15.00
- payoutRoundedMinutes 0
- calculatedSalary from close flow: 0.00
- roundedItemAmountExact: 0.00
- payoutAmount: 0

### List my payable attendances

Only WORKER.

GET /api/v1/me/payable-attendances

Headers:

Authorization: Bearer <token>

Rules:

- Returns only attendance records owned by the current user.
- Returns only APPROVED attendance on CLOSED shifts.
- Returns only attendance with paymentStatus UNPAID.
- Results are sorted by shift actualEndTime descending, then attendanceId descending.
- Worker must belong to the same company as the attendance shift.
- The endpoint reads persisted workedMinutes and calculatedSalary. It does not recalculate close-time salary.
- The endpoint calculates payoutRoundedMinutes and payoutAmount on the backend for display and selection.
- Zero-minute, zero-amount attendance may be returned when it is otherwise payable so the worker can include it in a payout request and clear the payroll state.
- Worker never receives foremanHourlyRate, foremanWorkedMinutes, foremanPauseMinutes, or foremanSalary.

Response:

Status: 200 OK

[
  {
    "attendanceId": 500,
    "shiftId": 100,
    "companyId": 10,
    "companyName": "Acme Construction",
    "title": "Tuesday 10:00 - Acme Construction",
    "location": "Cologne",
    "actualStartTime": "2026-07-01T08:05:00Z",
    "actualEndTime": "2026-07-01T17:00:00Z",
    "paymentStatus": "UNPAID",
    "rawPayableMinutes": 467,
    "payoutRoundedMinutes": 465,
    "hourlyRate": 15.00,
    "calculatedSalary": 116.75,
    "payoutAmount": 117
  },
  {
    "attendanceId": 501,
    "shiftId": 101,
    "companyId": 10,
    "companyName": "Acme Construction",
    "title": "Wednesday 10:00 - Acme Construction",
    "location": "Cologne",
    "actualStartTime": "2026-07-02T10:00:00Z",
    "actualEndTime": "2026-07-02T10:00:00Z",
    "paymentStatus": "UNPAID",
    "rawPayableMinutes": 0,
    "payoutRoundedMinutes": 0,
    "hourlyRate": 15.00,
    "calculatedSalary": 0.00,
    "payoutAmount": 0
  }
]

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/me/payable-attendances"
}

FOREMAN or ADMIN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/me/payable-attendances"
}

### Preview my payout request

Only WORKER.

POST /api/v1/me/payout-requests/preview

Headers:

Authorization: Bearer <token>

Request:

{
  "attendanceIds": [500, 501]
}

Rules:

- attendanceIds is explicit selection by the worker.
- attendanceIds must not be empty.
- Duplicate attendanceIds return 400 Bad Request. The backend must not silently de-duplicate them.
- All selected attendance records must belong to the current worker.
- All selected attendance records must belong to the worker's current company.
- All selected attendance records must be APPROVED attendance on CLOSED shifts.
- DISCARDED shift attendance cannot be previewed because it is not payable.
- All selected attendance records must have workedMinutes and calculatedSalary already persisted.
- All selected attendance records must have paymentStatus UNPAID.
- Attendance with rawPayableMinutes 0 and payoutAmount 0 is allowed when it otherwise satisfies the payable rules.
- Already PAID attendance cannot be previewed for a new request.
- PAYMENT_REQUESTED attendance cannot be previewed for another pending request.
- For the MVP, all selected attendance records must belong to shifts created by the same foreman so one foreman can approve the whole request.
- Preview does not create PayoutRequest rows, does not create PayoutRequestItem rows, and does not change attendance paymentStatus.
- Preview is non-binding. Create revalidates and recalculates server-side because attendance payment state can change after preview.

Response:

Status: 200 OK

{
  "rawPayableMinutes": 467,
  "payoutRoundedMinutes": 465,
  "exactCalculatedAmount": 116.75,
  "payoutAmount": 117,
  "items": [
    {
      "attendanceId": 500,
      "shiftId": 100,
      "title": "Tuesday 10:00 - Acme Construction",
      "actualStartTime": "2026-07-01T08:05:00Z",
      "actualEndTime": "2026-07-01T17:00:00Z",
      "paymentStatus": "UNPAID",
      "rawPayableMinutes": 467,
      "payoutRoundedMinutes": 465,
      "hourlyRate": 15.00,
      "calculatedSalary": 116.75,
      "payoutAmount": 117
    },
    {
      "attendanceId": 501,
      "shiftId": 101,
      "title": "Wednesday 10:00 - Acme Construction",
      "actualStartTime": "2026-07-02T10:00:00Z",
      "actualEndTime": "2026-07-02T10:00:00Z",
      "paymentStatus": "UNPAID",
      "rawPayableMinutes": 0,
      "payoutRoundedMinutes": 0,
      "hourlyRate": 15.00,
      "calculatedSalary": 0.00,
      "payoutAmount": 0
    }
  ]
}

Validation error:

Status: 400 Bad Request

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "attendanceIds: must not be empty",
  "path": "/api/v1/me/payout-requests/preview"
}

Duplicate attendanceIds:

Status: 400 Bad Request

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "attendanceIds: must not contain duplicates",
  "path": "/api/v1/me/payout-requests/preview"
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/me/payout-requests/preview"
}

FOREMAN or ADMIN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/me/payout-requests/preview"
}

Attendance not owned by current worker or not found:

Status: 404 Not Found

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Attendance not found",
  "path": "/api/v1/me/payout-requests/preview"
}

Attendance is not payable:

Status: 409 Conflict

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Attendance is not payable",
  "path": "/api/v1/me/payout-requests/preview"
}

Attendance is already included in another pending request:

Status: 409 Conflict

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Attendance is already included in a pending payout request",
  "path": "/api/v1/me/payout-requests/preview"
}

Attendance is already paid:

Status: 409 Conflict

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Attendance is already paid",
  "path": "/api/v1/me/payout-requests/preview"
}

Selected attendances have different approvers:

Status: 409 Conflict

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Payout request items must belong to shifts managed by the same foreman",
  "path": "/api/v1/me/payout-requests/preview"
}

### Create my payout request

Only WORKER.

POST /api/v1/me/payout-requests

Headers:

Authorization: Bearer <token>

Request:

{
  "attendanceIds": [500, 501]
}

Rules:

- attendanceIds is explicit selection by the worker.
- attendanceIds must not be empty.
- Duplicate attendanceIds return 400 Bad Request. The backend must not silently de-duplicate them.
- All selected attendance records must belong to the current worker.
- All selected attendance records must belong to the worker's current company.
- All selected attendance records must be APPROVED attendance on CLOSED shifts.
- DISCARDED shift attendance cannot be requested because it is not payable.
- All selected attendance records must have workedMinutes and calculatedSalary already persisted.
- All selected attendance records must have paymentStatus UNPAID.
- Attendance with rawPayableMinutes 0 and payoutAmount 0 is allowed when it otherwise satisfies the payable rules.
- Already PAID attendance cannot be included in a new request.
- PAYMENT_REQUESTED attendance cannot be included in another pending request.
- For the MVP, all selected attendance records must belong to shifts created by the same foreman so one foreman can approve the whole request.
- Creation is transactional. If any selected attendance is invalid, no request is created and no attendance paymentStatus changes.
- Create recalculates all totals server-side and does not trust preview totals or client-side totals.
- On success, the backend creates a PENDING payout request, creates payout request items, snapshots exact and rounded item values, and sets selected attendance paymentStatus to PAYMENT_REQUESTED.
- requestedAt is set by the backend to the current server time in UTC.

Response:

Status: 201 Created

{
  "id": 900,
  "companyId": 10,
  "companyName": "Acme Construction",
  "workerId": 1,
  "workerFirstName": "John",
  "workerLastName": "Worker",
  "status": "PENDING",
  "rawPayableMinutes": 467,
  "payoutRoundedMinutes": 465,
  "exactCalculatedAmount": 116.75,
  "payoutAmount": 117,
  "requestedAt": "2026-07-06T20:00:00Z",
  "approvedAt": null,
  "paidAt": null,
  "items": [
    {
      "attendanceId": 500,
      "shiftId": 100,
      "title": "Tuesday 10:00 - Acme Construction",
      "actualStartTime": "2026-07-01T08:05:00Z",
      "actualEndTime": "2026-07-01T17:00:00Z",
      "paymentStatus": "PAYMENT_REQUESTED",
      "rawPayableMinutes": 467,
      "payoutRoundedMinutes": 465,
      "hourlyRate": 15.00,
      "calculatedSalary": 116.75,
      "payoutAmount": 117
    },
    {
      "attendanceId": 501,
      "shiftId": 101,
      "title": "Wednesday 10:00 - Acme Construction",
      "actualStartTime": "2026-07-02T10:00:00Z",
      "actualEndTime": "2026-07-02T10:00:00Z",
      "paymentStatus": "PAYMENT_REQUESTED",
      "rawPayableMinutes": 0,
      "payoutRoundedMinutes": 0,
      "hourlyRate": 15.00,
      "calculatedSalary": 0.00,
      "payoutAmount": 0
    }
  ]
}

Validation error:

Status: 400 Bad Request

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "attendanceIds: must not be empty",
  "path": "/api/v1/me/payout-requests"
}

Duplicate attendanceIds:

Status: 400 Bad Request

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "attendanceIds: must not contain duplicates",
  "path": "/api/v1/me/payout-requests"
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/me/payout-requests"
}

FOREMAN or ADMIN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/me/payout-requests"
}

Attendance not owned by current worker or not found:

Status: 404 Not Found

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Attendance not found",
  "path": "/api/v1/me/payout-requests"
}

Attendance is not payable:

Status: 409 Conflict

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Attendance is not payable",
  "path": "/api/v1/me/payout-requests"
}

Attendance is already included in another pending request:

Status: 409 Conflict

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Attendance is already included in a pending payout request",
  "path": "/api/v1/me/payout-requests"
}

Attendance is already paid:

Status: 409 Conflict

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Attendance is already paid",
  "path": "/api/v1/me/payout-requests"
}

Selected attendances have different approvers:

Status: 409 Conflict

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Payout request items must belong to shifts managed by the same foreman",
  "path": "/api/v1/me/payout-requests"
}

### List my payout requests

Only WORKER.

GET /api/v1/me/payout-requests

Optional query:

status=PENDING
status=APPROVED

Rules:

- Returns payout requests created by the current worker.
- Worker sees only own payroll data.
- Worker never receives foreman salary or rate fields.
- Results are sorted by requestedAt descending, then request id descending.

Response:

Status: 200 OK

[
  {
    "id": 900,
    "companyId": 10,
    "companyName": "Acme Construction",
    "workerId": 1,
    "workerFirstName": "John",
    "workerLastName": "Worker",
    "status": "PENDING",
    "rawPayableMinutes": 467,
    "payoutRoundedMinutes": 465,
    "exactCalculatedAmount": 116.75,
    "payoutAmount": 117,
    "requestedAt": "2026-07-06T20:00:00Z",
    "approvedAt": null,
    "paidAt": null,
    "items": [
      {
        "attendanceId": 500,
        "shiftId": 100,
        "title": "Tuesday 10:00 - Acme Construction",
        "actualStartTime": "2026-07-01T08:05:00Z",
        "actualEndTime": "2026-07-01T17:00:00Z",
        "paymentStatus": "PAYMENT_REQUESTED",
        "rawPayableMinutes": 467,
        "payoutRoundedMinutes": 465,
        "hourlyRate": 15.00,
        "calculatedSalary": 116.75,
        "payoutAmount": 117
      }
    ]
  }
]

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/me/payout-requests"
}

FOREMAN or ADMIN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/me/payout-requests"
}

### List managed payout requests

Only FOREMAN.

GET /api/v1/me/managed-payout-requests

Optional query:

status=PENDING
status=APPROVED

Rules:

- Returns payout requests for the current foreman's company and shifts created by the current foreman.
- Default status filter is PENDING if status is omitted.
- A foreman does not see payout requests for another company.
- A foreman does not see payout requests containing shifts they do not manage.
- Worker identity, selected shifts/days, raw hours/minutes, exactCalculatedAmount, payoutRoundedMinutes, and whole-number payoutAmount are available to the approving foreman through payroll DTOs for approval/audit data.
- Mobile request cards should display only raw payable time, whole-number payoutAmount, status, and selected days/items. They should hide exactCalculatedAmount and payoutRoundedMinutes unless a later detailed audit view is added.
- Foreman never receives another foreman's private salary or rate fields through payroll request DTOs.
- Results are sorted by requestedAt ascending, then request id ascending for PENDING requests.

Response:

Status: 200 OK

[
  {
    "id": 900,
    "companyId": 10,
    "companyName": "Acme Construction",
    "workerId": 1,
    "workerFirstName": "John",
    "workerLastName": "Worker",
    "status": "PENDING",
    "rawPayableMinutes": 467,
    "payoutRoundedMinutes": 465,
    "exactCalculatedAmount": 116.75,
    "payoutAmount": 117,
    "requestedAt": "2026-07-06T20:00:00Z",
    "approvedAt": null,
    "paidAt": null,
    "items": [
      {
        "attendanceId": 500,
        "shiftId": 100,
        "title": "Tuesday 10:00 - Acme Construction",
        "actualStartTime": "2026-07-01T08:05:00Z",
        "actualEndTime": "2026-07-01T17:00:00Z",
        "paymentStatus": "PAYMENT_REQUESTED",
        "rawPayableMinutes": 467,
        "payoutRoundedMinutes": 465,
        "hourlyRate": 15.00,
        "calculatedSalary": 116.75,
        "payoutAmount": 117
      }
    ]
  }
]

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/me/managed-payout-requests"
}

WORKER or ADMIN:

Status: 403 Forbidden

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/me/managed-payout-requests"
}

### Approve managed payout request

Only FOREMAN.

POST /api/v1/me/managed-payout-requests/{requestId}/approve

Headers:

Authorization: Bearer <token>

This endpoint does not accept a request body.

Rules:

- FOREMAN can approve only payout requests for their current company.
- FOREMAN can approve only payout requests where every selected attendance belongs to a shift created by that FOREMAN.
- The payout request must be PENDING.
- Every selected attendance must still have paymentStatus PAYMENT_REQUESTED.
- Approval is transactional. If any selected attendance is no longer PAYMENT_REQUESTED, the request is not approved.
- On success, the backend sets payout request status to APPROVED, sets approvedBy and approvedAt, sets item paidAt, and sets every selected attendance paymentStatus to PAID.
- Attendance paidAt is set to approvedAt in the MVP because approval is the payment-completion event.
- Future payment processing may separate approvedAt from paidAt.

Response:

Status: 200 OK

{
  "id": 900,
  "companyId": 10,
  "companyName": "Acme Construction",
  "workerId": 1,
  "workerFirstName": "John",
  "workerLastName": "Worker",
  "status": "APPROVED",
  "rawPayableMinutes": 467,
  "payoutRoundedMinutes": 465,
  "exactCalculatedAmount": 116.75,
  "payoutAmount": 117,
  "requestedAt": "2026-07-06T20:00:00Z",
  "approvedAt": "2026-07-07T09:30:00Z",
  "paidAt": "2026-07-07T09:30:00Z",
  "items": [
    {
      "attendanceId": 500,
      "shiftId": 100,
      "title": "Tuesday 10:00 - Acme Construction",
      "actualStartTime": "2026-07-01T08:05:00Z",
      "actualEndTime": "2026-07-01T17:00:00Z",
      "paymentStatus": "PAID",
      "rawPayableMinutes": 467,
      "payoutRoundedMinutes": 465,
      "hourlyRate": 15.00,
      "calculatedSalary": 116.75,
      "payoutAmount": 117
    }
  ]
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-07T09:30:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/me/managed-payout-requests/900/approve"
}

WORKER, ADMIN, non-owner FOREMAN, or wrong company:

Status: 403 Forbidden

{
  "timestamp": "2026-07-07T09:30:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Forbidden",
  "path": "/api/v1/me/managed-payout-requests/900/approve"
}

Payout request not found:

Status: 404 Not Found

{
  "timestamp": "2026-07-07T09:30:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Payout request not found",
  "path": "/api/v1/me/managed-payout-requests/900/approve"
}

Payout request is not pending:

Status: 409 Conflict

{
  "timestamp": "2026-07-07T09:30:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Payout request can only be approved when status is PENDING",
  "path": "/api/v1/me/managed-payout-requests/900/approve"
}

Selected attendance changed payment state:

Status: 409 Conflict

{
  "timestamp": "2026-07-07T09:30:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Payout request attendance is no longer payment requested",
  "path": "/api/v1/me/managed-payout-requests/900/approve"
}

9. Error Response Format

All API errors should use this format:

{
  "timestamp": "2026-07-01T10:00:00",
  "status": 409,
  "error": "Conflict",
  "message": "Shift can only be closed when status is ACTIVE",
  "path": "/api/v1/shifts/100/close"
}

10. Authorization Rules
WORKER:
- can see own profile
- can join company by company join code
- can join OPEN shifts and ACTIVE shifts in their company
- can see own shift history
- can pause/resume self on ACTIVE shifts where they have approved attendance
- can list own payable CLOSED attendance
- can create payout requests only from own CLOSED, APPROVED, UNPAID attendance in their company
- can list own payout requests

FOREMAN:
- can create own company
- can create shift
- can start shift
- can close shift
- can save or discard an own short ACTIVE shift after backend short-shift validation
- can cancel own OPEN shift before start
- can approve attendance
- can see own managed shifts
- can see shift summary
- can pause/resume self on own ACTIVE shifts
- can pause/resume all participants on own ACTIVE shifts
- can list payout requests for their company and shifts they created
- can approve only PENDING payout requests for their company and shifts they created

ADMIN:
- can read shift detail, list attendance, approve attendance, and see worker-only shift summary through current REST endpoints
- cannot create, start, close, cancel, or pause shifts through the REST/mobile API
- can call `GET /api/v1/me/managed-shifts`, normally returning an empty list because ADMIN REST shift creation is disabled
- does not receive foremanHourlyRate, foremanWorkedMinutes, foremanPauseMinutes, or foremanSalary through the MVP REST/mobile API
- cannot create or approve payout requests through the MVP REST/mobile API
- full user management is deferred until after the mobile MVP and should be implemented through the Vaadin admin dashboard
- mobile MVP has no ADMIN flow
