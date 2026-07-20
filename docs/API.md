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
  "role": "WORKER"
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
    "role": "WORKER"
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

Response:

Status: 200 OK

{
  "id": 1,
  "email": "worker@example.com",
  "firstName": "John",
  "lastName": "Worker",
  "role": "WORKER"
}

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/users/me"
}

3. Shift Sessions
Create shift session

Only FOREMAN or ADMIN.

POST /api/v1/shifts

Headers:

Authorization: Bearer <token>

Request:

{
  "title": "Monday construction shift",
  "location": "Cologne",
  "plannedStartTime": "2026-07-01T08:00:00",
  "plannedEndTime": "2026-07-01T17:00:00",
  "defaultBreakMinutes": 60,
  "defaultHourlyRate": 15.00
}

Response:

Status: 201 Created

{
  "id": 100,
  "title": "Monday construction shift",
  "joinCode": "ABCD12",
  "status": "OPEN",
  "defaultHourlyRate": 15.00,
  "createdBy": 5
}

defaultHourlyRate is required, must be greater than or equal to 0, and supports up to two decimal places. It is set by the FOREMAN creating the shift or by an ADMIN.

Validation error:

Status: 400 Bad Request

{
  "timestamp": "2026-07-01T10:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "plannedEndTime must be after plannedStartTime",
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

Response:

Status: 200 OK

{
  "id": 100,
  "title": "Monday construction shift",
  "location": "Cologne",
  "status": "OPEN",
  "joinCode": "ABCD12",
  "plannedStartTime": "2026-07-01T08:00:00Z",
  "plannedEndTime": "2026-07-01T17:00:00Z",
  "actualStartTime": null,
  "actualEndTime": null,
  "defaultBreakMinutes": 60,
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
- ADMIN can start any shift.
- WORKER is not allowed.
- Only a shift with status OPEN can be started.

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
Close shift

POST /api/v1/shifts/{shiftId}/close

Headers:

Authorization: Bearer <token>

This endpoint does not accept a request body. The backend sets actualEndTime to the current server time in UTC.

Access and state rules:

- FOREMAN can close only a shift created by that FOREMAN.
- ADMIN can close any shift.
- WORKER is not allowed.
- Only a shift with status ACTIVE can be closed.
- actualStartTime must exist.
- For each APPROVED attendance, the backend calculates and stores workedMinutes and calculatedSalary.
- workedMinutes = minutes_between(actualStartTime, actualEndTime) - attendance.breakMinutes.
- calculatedSalary = workedMinutes / 60 * attendance.hourlyRate, rounded to 2 decimal places with HALF_UP.
- Salary uses the attendance hourlyRate snapshot or attendance-specific override, not shift.defaultHourlyRate.
- JOINED, REJECTED, and CANCELLED attendance keep workedMinutes and calculatedSalary as null.
- If breakMinutes is greater than the shift duration, close returns 409 and the shift remains ACTIVE.

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

4. Shift Join
Join shift by code

Only WORKER.

POST /api/v1/shifts/join

Headers:

Authorization: Bearer <token>

Rules:

- joinCode is normalized with trim and uppercase.
- The shift must have status OPEN.
- A worker can join the same shift only once.
- A worker never sets hourlyRate.
- The backend copies shift.defaultHourlyRate into shift_attendance.hourly_rate as a rate snapshot.
- If a client includes hourlyRate in the JSON, it is ignored and cannot change the assigned rate.
- breakMinutes is copied from the shift defaultBreakMinutes.
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
    "breakMinutes": 60,
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

5. Salary Calculation
Get shift summary

Only FOREMAN or ADMIN.

GET /api/v1/shifts/{shiftId}/summary

Headers:

Authorization: Bearer <token>

Rules:

- FOREMAN can get summary only for a shift they created.
- ADMIN can get summary for any shift.
- WORKER is not allowed.
- Summary is available only for CLOSED shifts.
- The endpoint uses stored workedMinutes and calculatedSalary from shift_attendance.
- The endpoint does not recalculate salary.
- Only APPROVED attendance is included in workers.
- JOINED, REJECTED, and CANCELLED attendance is excluded.
- totalWorkers is the number of included APPROVED attendance records.
- totalSalary is the sum of included calculatedSalary values with scale 2.
- Workers are sorted by lastName ascending, firstName ascending, then workerId ascending.
- If an APPROVED attendance has null workedMinutes or calculatedSalary, the endpoint returns 409.

Response:

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
- OPEN, ACTIVE, and CLOSED shifts are included.
- CLOSED shifts return workedMinutes and calculatedSalary when those values were already calculated and stored.
- OPEN, ACTIVE, and unapproved attendance may return null workedMinutes and calculatedSalary.
- This endpoint reads stored attendance salary fields and does not recalculate salary.
- Results are sorted by joinedAt descending, then attendanceId descending.
- The response does not expose User entities, worker records, email, or passwordHash.
- The repository fetches attendance with shift in one query to avoid N+1 loading.

Response:

[
  {
    "shiftId": 100,
    "attendanceId": 500,
    "title": "Monday construction shift",
    "location": "Cologne",
    "status": "CLOSED",
    "plannedStartTime": "2026-07-01T08:00:00Z",
    "plannedEndTime": "2026-07-01T17:00:00Z",
    "actualStartTime": "2026-07-01T08:05:00Z",
    "actualEndTime": "2026-07-01T17:00:00Z",
    "attendanceStatus": "APPROVED",
    "hourlyRate": 15.00,
    "breakMinutes": 60,
    "workedMinutes": 480,
    "calculatedSalary": 120.00
  }
]

Missing, invalid, or expired token:

Status: 401 Unauthorized

{
  "timestamp": "2026-07-06T20:00:00Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/api/v1/me/shifts"
}

6. Error Response Format

All API errors should use this format:

{
  "timestamp": "2026-07-01T10:00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Break time cannot be greater than shift duration",
  "path": "/api/v1/shifts/100/summary"
}

7. Authorization Rules
WORKER:
- can see own profile
- can join shift
- can see own shift history

FOREMAN:
- can create shift
- can start shift
- can close shift
- can approve attendance
- can see shift summary

ADMIN:
- can do everything
