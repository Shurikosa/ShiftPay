
---

# 3. `docs/SPEC.md`

```md
# ShiftPay Specification

## 1. Product Overview

ShiftPay is an application for tracking work shifts, worked hours, and salary.

The main users are:

- foremen
- workers
- admins

The application should support teams where a foreman manages a work shift and workers join that shift.

The product should be cross-platform:

- Android mobile app
- iOS mobile app
- web admin dashboard served by the backend using Vaadin

## 2. Main Problem

Manual tracking of working hours can be inaccurate.

Workers may forget start or end time.

Foremen may need a simple way to manage shift attendance.

Salary calculation can become confusing when there are:

- different hourly rates
- breaks
- incomplete shifts
- multiple workers
- daily or weekly summaries

ShiftPay should make this process simple.

## 3. MVP Goal

The MVP should allow:

- user registration
- user login
- role-based access
- foreman creates a shift session
- workers join a shift session
- system tracks time
- system calculates salary
- users can view basic shift history

## 4. Roles

### 4.1 Worker

A worker can:

- create an account
- log in
- join a company by company join code
- join an open shift session
- join only shifts that belong to their company
- join without entering or selecting an hourly rate
- leave or finish a shift if allowed
- see own worked hours
- see own salary calculation
- see shift history
- see company name in the mobile app

### 4.2 Foreman

A foreman can:

- create a company after registration if they do not have one
- create a shift session
- start a shift
- close a shift
- invite workers or share join code
- approve joined workers
- set break duration
- set the default hourly rate for a shift
- set their own hourly rate for a shift
- cancel an OPEN shift before it starts
- pause themselves during an ACTIVE shift
- pause everyone during an ACTIVE shift
- view shifts they created and manage
- view shift summary
- view worker salary summary
- view their own private foreman salary summary
- see company name in the mobile app

### 4.3 Admin

An admin can:

- manage companies
- manage users
- assign roles
- view reports
- manage system settings

Admin features will be available through the Vaadin admin dashboard.
Advanced admin features are not required for the first MVP, but the backend architecture should support them later.
ADMIN user management is deferred until after the mobile MVP.
The mobile MVP should not include an ADMIN flow.

## 5. Shift Session Flow

Basic flow:

1. Foreman logs in.
2. If the FOREMAN does not have a company, the foreman creates one.
3. System generates a company join code.
4. Foreman creates a shift session attached to their company with optional location, optional default break minutes, default worker hourly rate, and foreman hourly rate.
5. System generates a default title from date/time and company name.
6. System generates a shift join code.
7. Worker logs in.
8. If the WORKER is not a company member, the worker joins the company by company join code.
9. Worker enters the shift join code.
10. Worker joins the session only if they are already a member of that shift's company.
11. Worker joins the session without providing an hourly rate.
12. System copies the shift default hourly rate into the worker attendance record as a snapshot.
13. While the shift is OPEN, the foreman approves joined workers and may override the rate for an individual attendance.
14. If no rate override is provided, the attendance keeps its join-time rate snapshot.
15. If the shift should not happen, Foreman cancels the OPEN shift before it starts.
16. Otherwise, Foreman starts the shift.
17. System records shift start time as actualStartTime.
18. During the ACTIVE shift, workers can pause and resume themselves.
19. During the ACTIVE shift, foreman can pause and resume themselves or everyone.
20. Foreman closes the shift.
21. System records shift end time as actualEndTime and closes any active pause intervals at actualEndTime.
22. System calculates worked time for approved worker attendance, subtracting static break minutes and effective pause minutes.
23. System calculates salary for approved worker attendance.
24. System calculates the foreman's private salary from ShiftSession.foremanHourlyRate without creating ShiftAttendance for the foreman.
25. Worker can view their own worker result.
26. Foreman can view shift summary, including worker salary summary and their own private foreman salary.
27. Foreman can view the list of shifts they created and manage.

## 6. Shift Statuses

A shift can have these statuses:

CREATED
OPEN
ACTIVE
CLOSED
CANCELLED

## 7. Shift Creation Rules

FOREMAN must have a company before creating or starting a shift.

Each shift belongs to a real company through ShiftSession.companyId.

The backend must not use Default Company for real MVP shifts.

For the mobile MVP, the foreman does not enter plannedStartTime or plannedEndTime when creating a shift.

Shift creation should not require planned times.

The foreman should not manually enter a shift title in the mobile MVP.

The backend generates a default title automatically from date/time and the real company name.
Example format:

Tuesday 10:00 - Acme Construction

The exact locale and format can be refined during implementation.

Shift creation still includes:

- optional location
- optional defaultBreakMinutes
- defaultHourlyRate for workers
- foremanHourlyRate for the foreman

If defaultBreakMinutes is not provided, the backend uses 0.

actualStartTime is set by the backend when the foreman starts the shift.

actualEndTime is set by the backend when the foreman closes the shift.

## 8. Company Rules

Company onboarding is part of the mobile MVP.

FOREMAN creates a company after registration if they do not already have one.

Company has a join code generated by the backend.

WORKER joins a company by company join code.

WORKER can join a shift only if they are already a member of that shift's company.

Company name must be visible in the main menu or dashboard for FOREMAN and WORKER.

The mobile MVP should not use or show Default Company for real shifts.

## 9. Shift Cancellation Rules

Implemented for the mobile MVP.

Endpoint:

POST /api/v1/shifts/{shiftId}/cancel

Rules:

- owner FOREMAN can cancel only their own OPEN shift before it starts
- cancelled shift has status CANCELLED
- cancelled shift does not set actualStartTime or actualEndTime
- cancelled shift does not calculate salary
- cancelled shift cannot be started, closed, joined by workers, or summarized
- worker history can show CANCELLED shift/status
- ADMIN is not allowed to cancel through the REST/mobile API

## 10. Pause Rules

Implemented for the mobile MVP.

Pause is separate from static defaultBreakMinutes.

Endpoints:

POST /api/v1/shifts/{shiftId}/pauses/me/start

POST /api/v1/shifts/{shiftId}/pauses/me/end

POST /api/v1/shifts/{shiftId}/pauses/all/start

POST /api/v1/shifts/{shiftId}/pauses/all/end

WORKER can start and stop pause only for themselves.

FOREMAN can:

- pause themselves
- pause everyone on the shift

Rules:

- Pause is available only while shift status is ACTIVE.
- OPEN, CLOSED, and CANCELLED shifts cannot be paused or resumed.
- WORKER must already have joined the shift in their company.
- FOREMAN must own the shift.
- ADMIN cannot pause through the REST/mobile API.
- duplicate start for the same active pause target/scope returns conflict
- ending when no pause is active for the target/scope returns conflict
- pause for all applies to the foreman and all workers on the shift
- personal pause applies only to the target user
- overlapping personal and all-pause intervals are merged as a union for salary calculation, without double-counting
- closing the shift automatically closes any active pause intervals at actualEndTime

Pause status must be visible:

- worker dashboard/details shows whether the worker is paused or global pause is active
- foreman details/dashboard shows global pause status, foreman self pause status, and worker pause status

Salary calculation subtracts accumulated effective pause minutes.

The backend persists pause intervals with start/end timestamps, scope, shift, and affected user for personal pauses.

No client-side salary calculation is allowed.

## 11. Salary Calculation

Basic formula:

worked_minutes = shift_end_time - shift_start_time - break_minutes - effective_pause_minutes
salary = worked_minutes / 60 * hourly_rate

Example:

start time: 08:00
end time: 17:00
break: 60 minutes
hourly rate: 15 EUR/DOL

worked time = 8 hours
salary = 8 * 15 = 120 EUR/DOL

Worker salary:

worker_worked_minutes = actualEndTime - actualStartTime - attendance.breakMinutes - attendance.pauseMinutes
worker_salary = worker_worked_minutes / 60 * attendance.hourlyRate

Foreman salary:

foreman_worked_minutes = actualEndTime - actualStartTime - shift.defaultBreakMinutes - shift.foremanPauseMinutes
foreman_salary = foreman_worked_minutes / 60 * shift.foremanHourlyRate

## 12. Important Salary Rules
-Salary must not be negative.
-Break time cannot be greater than total shift time.
-If shift is not closed, final salary should not be calculated.
-Cancelled shifts do not calculate final salary.
-Hourly rate should be stored for the attendance record, because rates can change later.
-WORKER never sets an hourly rate.
-FOREMAN sets one default hourly rate for a shift that they own.
-FOREMAN sets foremanHourlyRate for their own salary on the shift.
-ADMIN cannot create shifts or set shift default hourly rates through the REST/mobile API.
-The attendance hourly rate is copied from the shift default hourly rate when the worker joins and remains a snapshot for that attendance record.
-During approval, FOREMAN may override the hourly rate for an attendance on a shift they own.
-During approval, ADMIN may override the hourly rate for an attendance on any shift.
-An approval without an hourly rate override preserves the attendance rate snapshot.
-An attendance-specific override does not change the shift default hourly rate or another worker's attendance rate.
-Salary calculation should use precise decimal values, not floating-point double.
-Salary is calculated when a shift closes successfully.
-Only APPROVED attendance receives worked minutes and calculated salary.
-JOINED, REJECTED, and CANCELLED attendance keep worked minutes and calculated salary empty.
-Salary calculation uses the attendance hourly rate snapshot or override.
-Salary calculation subtracts accumulated effective pause minutes.
-Static defaultBreakMinutes is optional and defaults to 0.
-Dynamic pauses are separate from defaultBreakMinutes.
-Worker salary is calculated from ShiftAttendance.hourlyRate and must not use ShiftSession.foremanHourlyRate.
-Foreman salary is calculated separately from worker attendance using ShiftSession.foremanHourlyRate.
-The system must not create a ShiftAttendance row for foreman salary.
-Foreman salary fields are private and visible only to the owner FOREMAN of the shift.
-WORKER never receives foreman salary fields.
-For the MVP REST/mobile API, ADMIN does not receive foreman salary fields.
-Calculated salary is rounded to 2 decimal places with HALF_UP.
-Closing fails if actualStartTime is missing, break time is greater than the shift duration, or break plus pause minutes are greater than the shift duration.

13. Authentication

The system should support:

-registration
-login
-password hashing
-JWT access token
-role-based authorization

Token expiration must not be removed completely.

For MVP, the default JWT/session lifetime should be 8 hours.

Mobile should store the session and automatically restore it by calling GET /api/v1/users/me.

Future biometric unlock or refresh-token/long-lived session support can be added later.

MVP roles:

WORKER
FOREMAN
ADMIN

14. Biometric Authentication

Biometric login can be added later on the mobile device.

For MVP, biometric authentication is optional.

Important rule:

Biometrics should not replace backend authentication. It should only unlock locally stored session/token on the device.

15. Cross-Platform Requirement

The mobile app should work on:

Android
iOS

Recommended technology:

React Native + Expo + TypeScript

The admin dashboard should be a web UI served by the backend Spring Boot application using Vaadin.
It should not be a separate React, Vue, or Angular frontend project for the MVP.

16. Out of Scope for First MVP

The first MVP should not include:

complex payroll system
tax calculation
GPS tracking
biometric login
offline sync
PDF reports
advanced admin dashboard
mobile admin flow
payment processing
accounting integration

These can be added later.

17. First MVP Features

Required:

backend project
PostgreSQL database
user registration
login
JWT authentication
roles
company creation
company join by code
create shift session
join shift by code
start shift
close shift
calculate worked time
calculate worker salary
calculate private foreman salary
worker shift history
foreman shift summary
cancel shift
dynamic pause tracking

Planned follow-up:

none documented for backend/mobile shift lifecycle at this point

Optional:

QR code join
simple web admin
biometric unlock
