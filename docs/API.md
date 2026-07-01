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
 
 
1. Authentication
Register
POST /api/v1/auth/register

No authentication required.

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

Request:

{
  "title": "Monday construction shift",
  "location": "Cologne",
  "plannedStartTime": "2026-07-01T08:00:00",
  "plannedEndTime": "2026-07-01T17:00:00",
  "defaultBreakMinutes": 60
}

Response:

{
  "id": 100,
  "title": "Monday construction shift",
  "joinCode": "ABCD12",
  "status": "OPEN",
  "createdBy": 5
}
Get shift by id
GET /api/v1/shifts/{shiftId}

Response:

{
  "id": 100,
  "title": "Monday construction shift",
  "location": "Cologne",
  "status": "OPEN",
  "joinCode": "ABCD12",
  "plannedStartTime": "2026-07-01T08:00:00",
  "plannedEndTime": "2026-07-01T17:00:00",
  "defaultBreakMinutes": 60
}
Start shift

Only FOREMAN or ADMIN.

POST /api/v1/shifts/{shiftId}/start

Response:

{
  "id": 100,
  "status": "ACTIVE",
  "actualStartTime": "2026-07-01T08:05:00"
}
Close shift

Only FOREMAN or ADMIN.

POST /api/v1/shifts/{shiftId}/close

Request:

{
  "actualEndTime": "2026-07-01T17:00:00"
}

Response:

{
  "id": 100,
  "status": "CLOSED",
  "actualEndTime": "2026-07-01T17:00:00"
}

4. Shift Join
Join shift by code

Only WORKER.

POST /api/v1/shifts/join

Request:

{
  "joinCode": "ABCD12",
  "hourlyRate": 15.00
}

Response:

{
  "attendanceId": 500,
  "shiftId": 100,
  "workerId": 1,
  "status": "JOINED",
  "hourlyRate": 15.00
}
Approve worker attendance

Only FOREMAN or ADMIN.

POST /api/v1/shifts/{shiftId}/attendance/{attendanceId}/approve

Response:

{
  "attendanceId": 500,
  "status": "APPROVED"
}

5. Salary Calculation
Get shift summary

Only FOREMAN or ADMIN.

GET /api/v1/shifts/{shiftId}/summary

Response:

{
  "shiftId": 100,
  "status": "CLOSED",
  "totalWorkers": 3,
  "workers": [
    {
      "workerId": 1,
      "fullName": "John Worker",
      "workedMinutes": 480,
      "hourlyRate": 15.00,
      "salary": 120.00
    }
  ]
}
Get my shift history

Only authenticated user.

GET /api/v1/me/shifts

Response:

[
  {
    "shiftId": 100,
    "title": "Monday construction shift",
    "date": "2026-07-01",
    "workedMinutes": 480,
    "hourlyRate": 15.00,
    "salary": 120.00
  }
]

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
