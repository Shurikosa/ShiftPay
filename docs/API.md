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

Response:

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

defaultBreakMinutes is optional, must be greater than or equal to 0 when provided, and defaults to 0 when omitted. Pause tracking is planned separately and is not part of the current implemented DTOs.

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
  "createdBy": 5
}

foremanHourlyRate is included only when the current user is the owner FOREMAN of the shift. WORKER never receives it. For the MVP REST/mobile API, ADMIN does not receive foremanHourlyRate.

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

Cancel shift planned

POST /api/v1/shifts/{shiftId}/cancel

Planned, not implemented yet.

The current backend has no implemented cancel endpoint. Planned rules remain: owner FOREMAN cancels only their own OPEN shift before start; cancelled shifts do not calculate salary. Backend and mobile cancel tasks remain unchecked until implemented with tests and docs.
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
- workedMinutes = minutes_between(actualStartTime, actualEndTime) - attendance.breakMinutes.
- calculatedSalary = workedMinutes / 60 * attendance.hourlyRate, rounded to 2 decimal places with HALF_UP.
- Salary uses the attendance hourlyRate snapshot or attendance-specific override, not shift.defaultHourlyRate.
- JOINED, REJECTED, and CANCELLED attendance keep workedMinutes and calculatedSalary as null.
- The backend calculates foremanWorkedMinutes and foremanSalary separately from worker attendance.
- foremanWorkedMinutes = minutes_between(actualStartTime, actualEndTime) - shift.defaultBreakMinutes.
- foremanSalary = foremanWorkedMinutes / 60 * shift.foremanHourlyRate, rounded to 2 decimal places with HALF_UP.
- Foreman salary uses ShiftSession.foremanHourlyRate.
- The backend must not create a ShiftAttendance row for foreman salary.
- Cancelled shifts are planned and not currently produced by an implemented REST endpoint.
- If breakMinutes is greater than the shift duration, close returns 409 and the shift remains ACTIVE.
- If defaultBreakMinutes is greater than the shift duration, close returns 409 and the shift remains ACTIVE.

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

Break is greater than shift duration:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T17:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Break minutes cannot be greater than shift duration",
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
- The shift must have status OPEN.
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

Shift is not OPEN:

Status: 409 Conflict

{
  "timestamp": "2026-07-01T07:55:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Workers can only join shifts with status OPEN",
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
- The endpoint is available while the shift is OPEN, ACTIVE, or CLOSED.
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
    "workedMinutes": null,
    "calculatedSalary": null,
    "joinedAt": "2026-07-06T18:00:00Z",
    "approvedAt": null
  }
]

For APPROVED attendance after the shift is closed, workedMinutes and calculatedSalary contain the close-time calculation.
For JOINED, REJECTED, and CANCELLED attendance, workedMinutes and calculatedSalary remain null.

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
- The shift must have status OPEN.
- The attendance must belong to the shift identified by shiftId.
- Only the JOINED -> APPROVED transition is allowed.
- The request body is optional.
- If hourlyRate is omitted, the attendance keeps the rate snapshot assigned when the worker joined.
- If hourlyRate is provided, it overrides the rate only for this attendance.
- hourlyRate must be non-negative and have at most two decimal places.
- approvedAt is set by the backend to the current server time in UTC.

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

Shift is not OPEN:

Status: 409 Conflict

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Attendance can only be approved while shift status is OPEN",
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

6. Salary Calculation

Pause system planning

Pause is separate from static defaultBreakMinutes. Planned, not implemented yet.

The exact pause endpoints can be refined during a separate backend/mobile task, but the API should eventually support these use cases:

- WORKER starts/stops pause only for their own approved attendance on an ACTIVE shift.
- FOREMAN starts/stops a self pause on their own ACTIVE shift.
- FOREMAN starts/stops a global pause for everyone on their own ACTIVE shift.
- Pause status is visible in future shift detail, attendance list, worker history/detail, and foreman managed shift/detail responses where relevant.
- Salary calculation will subtract accumulated pause minutes after pause is implemented.
- The backend persists pause intervals or an equivalent auditable model.
- The backend avoids double-counting overlapping pause intervals, such as a worker self pause during a global pause.
- No client-side salary calculation is allowed.

Planned pause endpoints can use this shape:

POST /api/v1/shifts/{shiftId}/pauses/self/start

POST /api/v1/shifts/{shiftId}/pauses/self/stop

POST /api/v1/shifts/{shiftId}/pauses/global/start

POST /api/v1/shifts/{shiftId}/pauses/global/stop

Pause implementation should be a separate backend/mobile task.

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
- Salary results currently subtract static break minutes. Pause-minute subtraction is planned with the pause system.
- CANCELLED shifts do not return summary because salary is not calculated.
- Workers are sorted by lastName ascending, firstName ascending, then workerId ascending.
- If an APPROVED attendance has null workedMinutes or calculatedSalary, the endpoint returns 409.
- The owner FOREMAN receives private foreman salary fields separately from workers: foremanWorkedMinutes, foremanHourlyRate, and foremanSalary.
- foremanWorkedMinutes uses actualEndTime - actualStartTime - ShiftSession.defaultBreakMinutes.
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
  "foremanHourlyRate": 25.00,
  "foremanSalary": 200.00,
  "workers": [
    {
      "attendanceId": 500,
      "workerId": 1,
      "firstName": "John",
      "lastName": "Worker",
      "workedMinutes": 480,
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
  "workers": [
    {
      "attendanceId": 500,
      "workerId": 1,
      "firstName": "John",
      "lastName": "Worker",
      "workedMinutes": 480,
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
    "hourlyRate": 15.00,
    "breakMinutes": 0,
    "workedMinutes": 480,
    "calculatedSalary": 120.00
  }
]

Worker history never returns foremanHourlyRate, foremanWorkedMinutes, or foremanSalary.

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

7. Error Response Format

All API errors should use this format:

{
  "timestamp": "2026-07-01T10:00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Break time cannot be greater than shift duration",
  "path": "/api/v1/shifts/100/summary"
}

8. Authorization Rules
WORKER:
- can see own profile
- can join company by company join code
- can join shift
- can see own shift history
- pause/resume self is planned, not implemented yet

FOREMAN:
- can create own company
- can create shift
- can start shift
- can close shift
- cancel own OPEN shift before start is planned, not implemented yet
- can approve attendance
- can see own managed shifts
- can see shift summary
- pause/resume self and global pause are planned, not implemented yet

ADMIN:
- can read shift detail, list attendance, approve attendance, and see worker-only shift summary through current REST endpoints
- cannot create, start, close, or cancel shifts through the REST/mobile API
- can call `GET /api/v1/me/managed-shifts`, normally returning an empty list because ADMIN REST shift creation is disabled
- does not receive foremanHourlyRate, foremanWorkedMinutes, or foremanSalary through the MVP REST/mobile API
- full user management is deferred until after the mobile MVP and should be implemented through the Vaadin admin dashboard
- mobile MVP has no ADMIN flow
