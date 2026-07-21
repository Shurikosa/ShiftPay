
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
- join an active shift session
- join without entering or selecting an hourly rate
- leave or finish a shift if allowed
- see own worked hours
- see own salary calculation
- see shift history

### 4.2 Foreman

A foreman can:

- create a shift session
- start a shift
- close a shift
- invite workers or share join code
- approve joined workers
- set break duration
- set the default hourly rate for a shift
- view shifts they created and manage
- view shift summary
- view worker salary summary

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

## 5. Shift Session Flow

Basic flow:

1. Foreman logs in.
2. Foreman creates a shift session and sets its default hourly rate.
3. System generates a join code.
4. Worker logs in.
5. Worker enters the join code.
6. Worker joins the session without providing an hourly rate.
7. System copies the shift default hourly rate into the worker attendance record as a snapshot.
8. While the shift is OPEN, the foreman approves joined workers and may override the rate for an individual attendance.
9. If no rate override is provided, the attendance keeps its join-time rate snapshot.
10. Foreman starts the shift.
11. System records shift start time.
12. Foreman closes the shift.
13. System records shift end time.
14. System calculates worked time for approved attendance.
15. System calculates salary for approved attendance.
16. Worker can view result.
17. Foreman can view shift summary.
18. Foreman can view the list of shifts they created and manage.

## 6. Shift Statuses

A shift can have these statuses:

CREATED
OPEN
ACTIVE
CLOSED
CANCELLED

8. Salary Calculation

Basic formula:

worked_minutes = shift_end_time - shift_start_time - break_minutes
salary = worked_minutes / 60 * hourly_rate

Example:

start time: 08:00
end time: 17:00
break: 60 minutes
hourly rate: 15 EUR/DOL

worked time = 8 hours
salary = 8 * 15 = 120 EUR/DOL

9. Important Salary Rules
-Salary must not be negative.
-Break time cannot be greater than total shift time.
-If shift is not closed, final salary should not be calculated.
-Hourly rate should be stored for the attendance record, because rates can change later.
-WORKER never sets an hourly rate.
-FOREMAN sets one default hourly rate for a shift that they own.
-ADMIN can set the default hourly rate for any shift.
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
-Calculated salary is rounded to 2 decimal places with HALF_UP.
-Closing fails if actualStartTime is missing or break time is greater than the shift duration.

10. Authentication

The system should support:

-registration
-login
-password hashing
-JWT access token
-role-based authorization

MVP roles:

WORKER
FOREMAN
ADMIN

11. Biometric Authentication

Biometric login can be added later on the mobile device.

For MVP, biometric authentication is optional.

Important rule:

Biometrics should not replace backend authentication. It should only unlock locally stored session/token on the device.

12. Cross-Platform Requirement

The mobile app should work on:

Android
iOS

Recommended technology:

React Native + Expo + TypeScript

The admin dashboard should be a web UI served by the backend Spring Boot application using Vaadin.
It should not be a separate React, Vue, or Angular frontend project for the MVP.

13. Out of Scope for First MVP

The first MVP should not include:

complex payroll system
tax calculation
GPS tracking
biometric login
offline sync
PDF reports
advanced admin dashboard
payment processing
accounting integration

These can be added later.

14. First MVP Features

Required:

backend project
PostgreSQL database
user registration
login
JWT authentication
roles
create shift session
join shift by code
start shift
close shift
calculate worked time
calculate salary
worker shift history
foreman shift summary

Optional:

QR code join
simple web admin
biometric unlock
